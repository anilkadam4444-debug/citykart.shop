import { NextRequest, NextResponse } from 'next/server';
import {
  broadcastAdminAnnouncement,
  notifyCustomerInteraction,
} from '@/lib/notification-events';
import {
  dispatchUnifiedNotification,
  getNotificationSystemDiagnostics,
  getUserNotificationPreferences,
  markAllNotificationsAsReadForRecipient,
  markNotificationAsRead,
  NotificationCategory,
  NotificationEntityType,
  NotificationRole,
  NotificationSeverity,
  queryNotificationsForRecipient,
} from '@/lib/notifications-service';
import { getAllRegisteredFcmTokensSummary } from '@/lib/fcm-registry';
import {
  isDesignatedOwnerPhone,
  normalizePhoneE164,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const [caller, adminCheck] = await Promise.all([
      verifyAuthenticatedCaller(req),
      verifyAdminRequest(req),
    ]);

    const rawPhone =
      searchParams.get('phoneE164') ||
      searchParams.get('phone') ||
      caller.phoneE164 ||
      adminCheck.phoneE164 ||
      undefined;
    const phoneE164 = rawPhone ? normalizePhoneE164(rawPhone) : undefined;
    const uid =
      searchParams.get('uid') || caller.uid || adminCheck.firebaseUid || undefined;
    const sellerId =
      searchParams.get('sellerId') || caller.sellerId || undefined;
    const storeId = searchParams.get('storeId') || undefined;
    const partnerId = searchParams.get('partnerId') || undefined;
    const requestedRole = (searchParams.get('role') || 'ALL').toUpperCase() as
      | NotificationRole
      | 'ALL';
    const statusFilter = (
      searchParams.get('status') || 'ALL'
    ).toUpperCase() as 'ALL' | 'UNREAD' | 'READ';
    const categoryFilter = (
      searchParams.get('category') || 'ALL'
    ).toUpperCase() as NotificationCategory | 'ALL';
    const limit = Number(searchParams.get('limit') || 30);
    const offset = Number(searchParams.get('offset') || 0);
    const includeDiagnostics = searchParams.get('diagnostics') === 'true';

    const isSuperAdmin = Boolean(
      adminCheck.isSuperAdmin ||
        (phoneE164 && isDesignatedOwnerPhone(phoneE164))
    );
    const isAdmin = Boolean(adminCheck.authorized || isSuperAdmin);

    // Prevent non-admins from querying ADMIN or SUPER_ADMIN role notifications
    if (
      (requestedRole === 'ADMIN' || requestedRole === 'SUPER_ADMIN') &&
      !isAdmin
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden: Administrator authorization is required to read Admin or Super Admin notifications.',
        },
        { status: 403 }
      );
    }

    if (
      requestedRole === 'SUPER_ADMIN' &&
      !isSuperAdmin
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden: Super Admin authorization is required to read Super Admin notifications.',
        },
        { status: 403 }
      );
    }

    const result = queryNotificationsForRecipient({
      uid,
      phoneE164,
      sellerId,
      storeId,
      storeIds: caller.storeIds,
      partnerId,
      role: requestedRole,
      roles: caller.roles,
      isAdmin,
      isSuperAdmin,
      statusFilter,
      categoryFilter,
      limit,
      offset,
    });

    const preferences = getUserNotificationPreferences({
      uid,
      phoneE164,
      sellerId,
      partnerId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      preferences,
      ...(includeDiagnostics && isAdmin
        ? {
            diagnostics: {
              ...getNotificationSystemDiagnostics(),
              fcmTokens: getAllRegisteredFcmTokensSummary(),
            },
          }
        : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load notifications.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || 'MARK_READ').toUpperCase();
    const [caller, adminCheck] = await Promise.all([
      verifyAuthenticatedCaller(req),
      verifyAdminRequest(req),
    ]);

    const isSuperAdmin = Boolean(
      adminCheck.isSuperAdmin ||
        (caller.phoneE164 && isDesignatedOwnerPhone(caller.phoneE164))
    );
    const isAdmin = Boolean(adminCheck.authorized || isSuperAdmin);

    if (action === 'MARK_READ') {
      const notificationId = String(body.notificationId || '').trim();
      if (!notificationId) {
        return NextResponse.json(
          { ok: false, error: 'notificationId is required.' },
          { status: 400 }
        );
      }

      // Verify ownership before marking read (unless caller is Admin/Super Admin)
      if (!isAdmin) {
        const callerOwned = queryNotificationsForRecipient({
          uid: caller.uid,
          phoneE164: caller.phoneE164,
          sellerId: caller.sellerId,
          storeIds: caller.storeIds,
          role: 'ALL',
          limit: 500,
        });
        const ownsTarget = callerOwned.notifications.some(
          (n) => n.id === notificationId
        );
        if (!ownsTarget) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Forbidden: You are not authorized to modify another user notification.',
            },
            { status: 403 }
          );
        }
      }

      const updated = await markNotificationAsRead({ notificationId });
      return NextResponse.json({
        ok: true,
        notification: updated
          ? {
              ...updated,
              status: updated.isRead ? 'READ' : 'UNREAD',
            }
          : null,
      });
    }

    if (action === 'MARK_ALL_READ') {
      const rawPhone =
        body.phoneE164 ||
        body.phone ||
        caller.phoneE164 ||
        adminCheck.phoneE164 ||
        undefined;
      const phoneE164 = rawPhone ? normalizePhoneE164(rawPhone) : undefined;
      const uid = body.uid || caller.uid || adminCheck.firebaseUid || undefined;
      const sellerId = body.sellerId || caller.sellerId || undefined;
      const storeId = body.storeId || undefined;
      const partnerId = body.partnerId || undefined;
      const role = (body.role || 'ALL').toUpperCase() as
        | NotificationRole
        | 'ALL';

      const markedCount = await markAllNotificationsAsReadForRecipient({
        uid,
        phoneE164,
        sellerId,
        storeId,
        storeIds: caller.storeIds,
        partnerId,
        role,
        isAdmin,
        isSuperAdmin,
      });

      return NextResponse.json({
        ok: true,
        markedCount,
      });
    }

    if (action === 'CUSTOMER_INTERACTION') {
      const {
        interactionType = 'CUSTOMER_ENQUIRY',
        storeId,
        sellerId,
        buyerUid,
        buyerPhoneE164,
        buyerName,
        orderId,
        rating,
        messageText,
        message,
      } = body;

      if (!storeId) {
        return NextResponse.json(
          { ok: false, error: 'storeId is required.' },
          { status: 400 }
        );
      }

      await notifyCustomerInteraction({
        interactionType,
        storeId: String(storeId),
        sellerId: sellerId ? String(sellerId) : undefined,
        buyerUid: buyerUid || caller.uid,
        buyerPhoneE164: buyerPhoneE164 || caller.phoneE164,
        buyerName: buyerName || 'Customer',
        orderId: orderId ? String(orderId) : undefined,
        rating: rating !== undefined ? Number(rating) : undefined,
        messageText: String(messageText || message || '').trim(),
      });

      return NextResponse.json({
        ok: true,
        message: 'Interaction notification dispatched.',
      });
    }

    if (action === 'PROFILE_UPDATED') {
      const phoneE164 = normalizePhoneE164(
        body.phoneE164 || caller.phoneE164 || ''
      );
      const uid = String(body.uid || caller.uid || phoneE164);
      const fullName = String(body.fullName || 'Verified User').trim();
      const role = (
        String(body.role || 'BUYER').toUpperCase() as NotificationRole
      );

      const res = await dispatchUnifiedNotification({
        eventKey: `${role}:PROFILE_UPDATED:${phoneE164 || uid}:${Date.now()}`,
        recipientUid: uid,
        recipientPhoneE164: phoneE164 || undefined,
        recipientRole: role,
        title: 'Profile Updated Successfully',
        message: `Your Citykart ${role.toLowerCase()} profile details for ${fullName} have been updated.`,
        type: 'BUYER_PROFILE_UPDATED',
        category: 'ACCOUNT_SECURITY',
        severity: 'SUCCESS',
        isMandatory: false,
        relatedEntityId: uid,
        relatedEntityType: 'USER',
      });

      return NextResponse.json({
        ok: true,
        notification: {
          ...res.notification,
          status: res.notification.isRead ? 'READ' : 'UNREAD',
          fcmStatus: res.notification.deliveryTelemetry.stages.includes(
            'FCM_SIMULATED_TOKEN_ACK'
          )
            ? 'SIMULATED_TOKEN_ACK'
            : res.notification.deliveryTelemetry.stages.includes('FCM_ACCEPTED')
              ? 'FCM_ACCEPTED'
              : res.notification.deliveryStatus,
        },
      });
    }

    if (action === 'ADMIN_BROADCAST') {
      if (!isAdmin) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Administrator authorization is required to send platform announcements.',
          },
          { status: 403 }
        );
      }

      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      if (!title || !message) {
        return NextResponse.json(
          { ok: false, error: 'Announcement title and message are required.' },
          { status: 400 }
        );
      }

      const targetRole = (
        String(body.targetRole || 'ALL').toUpperCase() as
          | NotificationRole
          | 'ALL'
      );
      const category = (
        String(body.category || 'MARKETING_PROMOTIONS').toUpperCase() as NotificationCategory
      );
      const severity = (
        String(body.severity || 'INFO').toUpperCase() as NotificationSeverity
      );

      const created = await broadcastAdminAnnouncement({
        targetRole,
        recipientPhoneE164: body.recipientPhoneE164
          ? normalizePhoneE164(body.recipientPhoneE164)
          : undefined,
        recipientSellerId: body.recipientSellerId
          ? String(body.recipientSellerId)
          : undefined,
        recipientPartnerId: body.recipientPartnerId
          ? String(body.recipientPartnerId)
          : undefined,
        title,
        message,
        category,
        severity,
        isMandatory: Boolean(body.isMandatory),
        destinationRoute: body.destinationRoute
          ? String(body.destinationRoute)
          : undefined,
      });

      return NextResponse.json({
        ok: true,
        dispatchedCount: created.length,
        notifications: created,
        message: `Broadcast dispatched to ${created.length} recipient(s).`,
      });
    }

    if (action === 'DISPATCH_EVENT') {
      const recipientRole = (
        String(body.recipientRole || 'BUYER').toUpperCase() as NotificationRole
      );
      if (
        (recipientRole === 'ADMIN' || recipientRole === 'SUPER_ADMIN') &&
        !isAdmin
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Only administrators can dispatch Admin or Super Admin alerts.',
          },
          { status: 403 }
        );
      }

      const res = await dispatchUnifiedNotification({
        eventKey: body.eventKey ? String(body.eventKey) : undefined,
        recipientUid: body.recipientUid ? String(body.recipientUid) : undefined,
        recipientPhoneE164: body.recipientPhoneE164
          ? normalizePhoneE164(body.recipientPhoneE164)
          : undefined,
        recipientSellerId: body.recipientSellerId
          ? String(body.recipientSellerId)
          : undefined,
        recipientStoreId: body.recipientStoreId
          ? String(body.recipientStoreId)
          : undefined,
        recipientPartnerId: body.recipientPartnerId
          ? String(body.recipientPartnerId)
          : undefined,
        recipientRole,
        title: String(body.title || 'Citykart Notification'),
        message: String(body.message || ''),
        type: String(body.type || 'CUSTOM_EVENT'),
        category: (body.category ||
          'ORDER_UPDATES') as NotificationCategory,
        severity: (body.severity || 'INFO') as NotificationSeverity,
        isMandatory: Boolean(body.isMandatory),
        relatedEntityId: String(body.relatedEntityId || 'global'),
        relatedEntityType: (body.relatedEntityType ||
          'SYSTEM') as NotificationEntityType,
        destinationRoute: body.destinationRoute
          ? String(body.destinationRoute)
          : undefined,
        metadata: body.metadata,
      });

      return NextResponse.json({
        ok: true,
        duplicateSkipped: res.duplicateSkipped,
        notification: res.notification,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported notification action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Notification operation failed.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}

