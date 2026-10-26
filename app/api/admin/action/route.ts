import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
} from '@/lib/firebase';
import {
  removeNandedDemoCatalogFromFirestore,
  seedNandedDemoCatalogToFirestore,
} from '@/lib/seeders';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  LocalStore,
  OrderRecord,
  Product,
} from '@/lib/catalog-data';
import {
  INITIAL_PRODUCTS,
  INITIAL_STORES,
} from '@/lib/initial-data';

import { recordStoreDeletedServer } from '@/lib/stores-registry';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import { serverUserAccounts } from '@/app/api/auth/otp/route';
import { SubscriptionPlan, SubscriptionTierId } from '@/lib/revenue-model';
import {
  createAdminAuthorization,
  getAuthoritativeAdminAuthorizations,
  getAuthoritativeSubscriptionPlans,
  getAuthoritativeSubscriptionPlansAsync,
  reactivateAdminAuthorization,
  recordAdminAuditLog,
  revokeAdminAuthorization,
  serverBuyerOverridesRegistry,
  serverProductOverridesRegistry,
  serverStoreOverridesRegistry,
  setAuthoritativeSubscriptionPlan,
  updateAdminAuthorization,
  updateAuthoritativePlatformSettings,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Strict Server-Side Admin Authorization Gate (Super Admin or Operational Admin)
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.firebaseUid) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        error: authCheck.reason,
      },
      { status: authCheck.status }
    );
  }

  const adminUid = authCheck.firebaseUid;
  const adminPhone = authCheck.phoneE164;
  const adminRole = authCheck.role;

  try {
    const body = await req.json();
    const actionType = String(body.action || '').trim();
    const reason = String(body.reason || `Administrative action by ${adminRole}`).trim();

    // =========================================================================
    // 0. ADMIN USER GOVERNANCE (SUPER ADMIN ONLY)
    // =========================================================================
    if (
      actionType === 'INVITE_ADMIN' ||
      actionType === 'REVOKE_ADMIN' ||
      actionType === 'REACTIVATE_ADMIN' ||
      actionType === 'UPDATE_ADMIN'
    ) {
      if (!authCheck.isSuperAdmin) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Only the Platform Owner Super Admin (+918329306616) is authorized to invite, revoke, or modify administrators.',
          },
          { status: 403 }
        );
      }

      if (actionType === 'INVITE_ADMIN') {
        const phoneE164 = String(body.phoneE164 || '').trim();
        const name = String(body.name || '').trim();
        const designation = String(body.designation || '').trim();
        const role = body.role === 'super_admin' ? 'super_admin' : 'admin';

        const result = await createAdminAuthorization({
          callerAdminUid: adminUid,
          callerPhone: adminPhone,
          phoneE164,
          name,
          designation,
          role,
        });

        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
        }

        const allAdmins = await getAuthoritativeAdminAuthorizations();
        return NextResponse.json({
          ok: true,
          message: `Administrator authorization created for ${result.record?.phoneE164}.`,
          record: result.record,
          authorizations: allAdmins,
        });
      }

      if (actionType === 'REVOKE_ADMIN') {
        const phoneE164 = String(body.phoneE164 || '').trim();
        const revokeReason = String(body.reason || 'Revoked by Platform Owner').trim();

        const result = await revokeAdminAuthorization({
          callerAdminUid: adminUid,
          callerPhone: adminPhone,
          phoneE164,
          reason: revokeReason,
        });

        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
        }

        const allAdmins = await getAuthoritativeAdminAuthorizations();
        return NextResponse.json({
          ok: true,
          message: `Administrator authorization revoked for ${phoneE164}.`,
          record: result.record,
          authorizations: allAdmins,
        });
      }

      if (actionType === 'REACTIVATE_ADMIN') {
        const phoneE164 = String(body.phoneE164 || '').trim();
        const reactivateReason = String(body.reason || 'Reactivated by Platform Owner').trim();

        const result = await reactivateAdminAuthorization({
          callerAdminUid: adminUid,
          callerPhone: adminPhone,
          phoneE164,
          reason: reactivateReason,
        });

        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
        }

        const allAdmins = await getAuthoritativeAdminAuthorizations();
        return NextResponse.json({
          ok: true,
          message: `Administrator authorization reactivated for ${phoneE164}.`,
          record: result.record,
          authorizations: allAdmins,
        });
      }

      if (actionType === 'UPDATE_ADMIN') {
        const phoneE164 = String(body.phoneE164 || '').trim();
        const name = body.name !== undefined ? String(body.name).trim() : undefined;
        const designation = body.designation !== undefined ? String(body.designation).trim() : undefined;

        const result = await updateAdminAuthorization({
          callerAdminUid: adminUid,
          callerPhone: adminPhone,
          phoneE164,
          name,
          designation,
        });

        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
        }

        const allAdmins = await getAuthoritativeAdminAuthorizations();
        return NextResponse.json({
          ok: true,
          message: `Administrator details updated for ${phoneE164}.`,
          record: result.record,
          authorizations: allAdmins,
        });
      }
    }

    // =========================================================================
    // 1. STORE MANAGEMENT: SUSPEND / RESTORE / VERIFY LOCATION / DELETE
    // =========================================================================
    if (actionType === 'SUSPEND_STORE' || actionType === 'RESTORE_STORE') {
      const storeId = String(body.storeId || '').trim();
      const storeName = String(body.storeName || storeId).trim();
      if (!storeId) {
        return NextResponse.json(
          { ok: false, error: 'Store ID is required.' },
          { status: 400 }
        );
      }

      if (actionType === 'SUSPEND_STORE' && (!reason || reason.length < 4)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'A clear administrative reason is required before suspending a store.',
          },
          { status: 400 }
        );
      }

      const isSuspending = actionType === 'SUSPEND_STORE';
      const nowIso = new Date().toISOString();

      serverStoreOverridesRegistry.set(storeId, {
        storeId,
        isSuspended: isSuspending,
        isActive: !isSuspending,
        suspensionReason: isSuspending ? reason : undefined,
        suspendedAt: isSuspending ? nowIso : undefined,
        suspendedByUid: isSuspending ? adminUid : undefined,
        updatedAt: nowIso,
      });

      try {
        const snap = await getDoc(doc(db, 'stores', storeId));
        if (snap.exists()) {
          await setDoc(
            doc(db, 'stores', storeId),
            {
              isActive: !isSuspending,
              isSuspended: isSuspending,
              suspensionReason: isSuspending ? reason : '',
              suspendedAt: isSuspending ? nowIso : '',
            },
            { merge: true }
          );
        }
      } catch {
        // Fallback handled via serverStoreOverridesRegistry
      }

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: isSuspending ? 'SUSPEND_STORE' : 'RESTORE_STORE',
        targetEntityType: 'STORE',
        targetEntityId: storeId,
        targetEntityName: storeName,
        status: 'SUCCESS',
        reason,
        metadata: {
          isSuspended: isSuspending,
          isActive: !isSuspending,
          historicalOrdersPreserved: true,
        },
      });

      return NextResponse.json({
        ok: true,
        storeId,
        isSuspended: isSuspending,
        isActive: !isSuspending,
        audit,
        message: isSuspending
          ? `Store "${storeName}" has been suspended. Public listings and new orders are paused; historical orders and seller data remain preserved.`
          : `Store "${storeName}" has been restored and is active for local orders.`,
      });
    }

    if (actionType === 'VERIFY_STORE_LOCATION') {
      const storeId = String(body.storeId || '').trim();
      const storeName = String(body.storeName || storeId).trim();
      if (!storeId) {
        return NextResponse.json(
          { ok: false, error: 'Store ID is required.' },
          { status: 400 }
        );
      }

      const existingOverride = serverStoreOverridesRegistry.get(storeId);
      const nowIso = new Date().toISOString();
      serverStoreOverridesRegistry.set(storeId, {
        storeId,
        isSuspended: existingOverride?.isSuspended ?? false,
        isActive: existingOverride?.isActive ?? true,
        locationVerified: true,
        verificationStatus: 'VERIFIED',
        updatedAt: nowIso,
      });

      try {
        const snap = await getDoc(doc(db, 'stores', storeId));
        if (snap.exists()) {
          await setDoc(
            doc(db, 'stores', storeId),
            {
              locationVerified: true,
              verificationStatus: 'VERIFIED',
            },
            { merge: true }
          );
        }
      } catch {
        // Ignore Firestore fallback
      }

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'VERIFY_STORE_LOCATION',
        targetEntityType: 'STORE',
        targetEntityId: storeId,
        targetEntityName: storeName,
        status: 'SUCCESS',
        reason,
      });

      return NextResponse.json({
        ok: true,
        storeId,
        audit,
        message: `Store "${storeName}" location marked as VERIFIED.`,
      });
    }

    if (actionType === 'DELETE_STORE') {
      if (!authCheck.isSuperAdmin) {
        await recordAdminAuditLog({
          adminUid,
          adminPhone,
          adminRole,
          actionType: 'UNAUTHORIZED_ADMIN_MANAGEMENT_ATTEMPT',
          targetEntityType: 'STORE',
          targetEntityId: String(body.storeId || 'unknown'),
          status: 'FAILURE',
          reason: 'Operational admin attempted permanent DELETE_STORE (Super Admin required).',
        });
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Permanent store deletion is restricted to the Platform Owner Super Admin (+918329306616). Operational administrators may suspend stores instead.',
          },
          { status: 403 }
        );
      }
      const storeId = String(body.storeId || '').trim();
      const storeNameConfirmation = String(
        body.storeNameConfirmation || ''
      ).trim();

      if (!storeId || !storeNameConfirmation) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Store ID and exact store name confirmation are required.',
          },
          { status: 400 }
        );
      }

      let storeRecord: LocalStore | null = null;
      try {
        const snap = await getDoc(doc(db, 'stores', storeId));
        if (snap.exists()) {
          storeRecord = snap.data() as LocalStore;
        }
      } catch {
        // Ignore
      }
      if (!storeRecord) {
        storeRecord = INITIAL_STORES.find((s) => s.id === storeId) || null;
      }

      if (!storeRecord) {
        return NextResponse.json(
          { ok: false, error: 'Store not found.' },
          { status: 404 }
        );
      }

      if (
        storeRecord.name.trim().toLowerCase() !==
        storeNameConfirmation.toLowerCase()
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Confirmation mismatch: please type "${storeRecord.name}" exactly.`,
          },
          { status: 400 }
        );
      }

      let productsDeletedCount = 0;
      try {
        const productsQ = query(
          collection(db, 'products'),
          where('storeId', '==', storeId)
        );
        const productsSnap = await getDocs(productsQ);
        const docsToDelete = productsSnap.docs;
        const CHUNK_SIZE = 400;
        for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
          const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(d.ref);
            productsDeletedCount++;
          }
          await batch.commit();
        }
        const storeBatch = writeBatch(db);
        storeBatch.delete(doc(db, 'stores', storeId));
        await storeBatch.commit();
      } catch {
        // Fallback tombstone below guarantees removal
      }

      await recordStoreDeletedServer(storeId, {
        storeName: storeRecord.name,
        deletedByUid: adminUid,
        deletedByPhone: authCheck.phoneE164,
        reason,
      });

      const audit = await recordAdminAuditLog({
        adminUid,
        actionType: 'DELETE_STORE',
        targetEntityType: 'STORE',
        targetEntityId: storeId,
        targetEntityName: storeRecord.name,
        status: 'SUCCESS',
        reason,
        metadata: {
          productsDeletedCount,
          historicalOrdersPreserved: true,
        },
      });

      return NextResponse.json({
        ok: true,
        storeId,
        productsDeletedCount,
        audit,
        message: `Store "${storeRecord.name}" permanently deleted. Historical orders and financial records remain preserved.`,
      });
    }

    // =========================================================================
    // 2. BUYER MANAGEMENT: SUSPEND / RESTORE BUYER ACCOUNT
    // =========================================================================
    if (actionType === 'SUSPEND_BUYER' || actionType === 'RESTORE_BUYER') {
      const userId = String(body.userId || '').trim();
      const phoneE164 = String(body.phoneE164 || '').trim();
      const fullName = String(body.fullName || userId).trim();

      if (!userId && !phoneE164) {
        return NextResponse.json(
          { ok: false, error: 'Buyer identifier or phone number is required.' },
          { status: 400 }
        );
      }

      const isSuspending = actionType === 'SUSPEND_BUYER';
      if (isSuspending && (!reason || reason.length < 4)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Please provide a reason before suspending a buyer account.',
          },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const overrideRecord = {
        userId: userId || phoneE164,
        phoneE164,
        accountStatus: (isSuspending ? 'SUSPENDED' : 'ACTIVE') as
          | 'ACTIVE'
          | 'SUSPENDED',
        suspensionReason: isSuspending ? reason : undefined,
        suspendedAt: isSuspending ? nowIso : undefined,
        suspendedByUid: isSuspending ? adminUid : undefined,
        updatedAt: nowIso,
      };

      if (userId) serverBuyerOverridesRegistry.set(userId, overrideRecord);
      if (phoneE164) serverBuyerOverridesRegistry.set(phoneE164, overrideRecord);

      if (phoneE164 && serverUserAccounts.has(phoneE164)) {
        const current = serverUserAccounts.get(phoneE164)!;
        serverUserAccounts.set(phoneE164, {
          ...current,
          accountStatus: isSuspending ? 'SUSPENDED' : 'ACTIVE',
          suspensionReason: isSuspending ? reason : undefined,
          suspendedAt: isSuspending ? nowIso : undefined,
        });
      }

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: isSuspending ? 'SUSPEND_BUYER' : 'RESTORE_BUYER',
        targetEntityType: 'BUYER',
        targetEntityId: userId || phoneE164,
        targetEntityName: fullName,
        status: 'SUCCESS',
        reason,
        metadata: {
          accountStatus: isSuspending ? 'SUSPENDED' : 'ACTIVE',
        },
      });

      return NextResponse.json({
        ok: true,
        userId: userId || phoneE164,
        accountStatus: isSuspending ? 'SUSPENDED' : 'ACTIVE',
        audit,
        message: isSuspending
          ? `Buyer account "${fullName}" has been suspended.`
          : `Buyer account "${fullName}" has been restored to ACTIVE status.`,
      });
    }

    // =========================================================================
    // 3. PRODUCT & CATEGORY MANAGEMENT: UNPUBLISH / RESTORE / TOGGLE CATEGORY
    // =========================================================================
    if (actionType === 'UNPUBLISH_PRODUCT' || actionType === 'RESTORE_PRODUCT') {
      const productId = String(body.productId || '').trim();
      const productName = String(body.productName || productId).trim();

      if (!productId) {
        return NextResponse.json(
          { ok: false, error: 'Product ID is required.' },
          { status: 400 }
        );
      }

      const isUnpublishing = actionType === 'UNPUBLISH_PRODUCT';
      const nowIso = new Date().toISOString();

      serverProductOverridesRegistry.set(productId, {
        productId,
        adminUnpublished: isUnpublishing,
        isAvailable: !isUnpublishing,
        unpublishReason: isUnpublishing ? reason : undefined,
        unpublishedAt: isUnpublishing ? nowIso : undefined,
        unpublishedByUid: isUnpublishing ? adminUid : undefined,
        updatedAt: nowIso,
      });

      try {
        const snap = await getDoc(doc(db, 'products', productId));
        if (snap.exists()) {
          await setDoc(
            doc(db, 'products', productId),
            {
              adminUnpublished: isUnpublishing,
              isAvailable: !isUnpublishing,
              unpublishReason: isUnpublishing ? reason : '',
              unpublishedAt: isUnpublishing ? nowIso : '',
            },
            { merge: true }
          );
        } else {
          const staticProd = INITIAL_PRODUCTS.find((p) => p.id === productId);
          if (staticProd) {
            const updatedProd: Product = {
              ...staticProd,
              adminUnpublished: isUnpublishing,
              isAvailable: !isUnpublishing,
            };
            void updatedProd;
          }
        }
      } catch {
        // Handled via serverProductOverridesRegistry
      }

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: isUnpublishing ? 'UNPUBLISH_PRODUCT' : 'RESTORE_PRODUCT',
        targetEntityType: 'PRODUCT',
        targetEntityId: productId,
        targetEntityName: productName,
        status: 'SUCCESS',
        reason,
        metadata: {
          adminUnpublished: isUnpublishing,
          isAvailable: !isUnpublishing,
        },
      });

      return NextResponse.json({
        ok: true,
        productId,
        adminUnpublished: isUnpublishing,
        isAvailable: !isUnpublishing,
        audit,
        message: isUnpublishing
          ? `Product "${productName}" has been unpublished and excluded from public search and discovery.`
          : `Product "${productName}" has been restored to public discovery.`,
      });
    }

    if (actionType === 'TOGGLE_CATEGORY') {
      const categoryId = String(body.categoryId || '').trim();
      const cat = AUTHORITATIVE_STORE_CATEGORIES.find(
        (c) => c.id === categoryId
      );
      if (!cat) {
        return NextResponse.json(
          { ok: false, error: 'Category not found.' },
          { status: 404 }
        );
      }

      cat.isActive = !cat.isActive;

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'TOGGLE_CATEGORY',
        targetEntityType: 'CATEGORY',
        targetEntityId: cat.id,
        targetEntityName: cat.name,
        status: 'SUCCESS',
        reason,
        metadata: {
          isActive: cat.isActive,
        },
      });

      return NextResponse.json({
        ok: true,
        categoryId: cat.id,
        isActive: cat.isActive,
        audit,
        message: `Category "${cat.name}" is now ${
          cat.isActive ? 'Active' : 'Hidden'
        }.`,
      });
    }

    // =========================================================================
    // 4. ORDER OVERSIGHT: SAFE ADMINISTRATIVE OVERSIGHT NOTE
    // =========================================================================
    if (actionType === 'ADD_ORDER_ADMIN_NOTE') {
      const orderId = String(body.orderId || '').trim();
      const noteText = String(body.note || '').trim();

      if (!orderId || !noteText) {
        return NextResponse.json(
          { ok: false, error: 'Order ID and note text are required.' },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const noteEntry = {
        id: `note_${Date.now()}`,
        note: noteText.slice(0, 500),
        createdAt: nowIso,
        adminUid,
      };

      const existingOrder = serverOrdersRegistry.get(orderId);
      if (existingOrder) {
        const updatedOrder: OrderRecord = {
          ...existingOrder,
          adminNotes: [...(existingOrder.adminNotes || []), noteEntry],
        };
        serverOrdersRegistry.set(orderId, updatedOrder);
      }

      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          const data = snap.data() as OrderRecord;
          await setDoc(
            doc(db, 'orders', orderId),
            {
              adminNotes: [...(data.adminNotes || []), noteEntry],
            },
            { merge: true }
          );
        }
      } catch {
        // Ignore Firestore write fallback
      }

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'ADD_ORDER_ADMIN_NOTE',
        targetEntityType: 'ORDER',
        targetEntityId: orderId,
        status: 'SUCCESS',
        reason: noteText,
      });

      return NextResponse.json({
        ok: true,
        orderId,
        noteEntry,
        audit,
        message: `Administrative oversight note recorded on Order #${orderId}.`,
      });
    }

    // =========================================================================
    // 5. SUBSCRIPTION PLAN CONFIGURATION UPDATE
    // =========================================================================
    if (actionType === 'UPDATE_SUBSCRIPTION_PLAN') {
      if (!authCheck.authorized) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Administrator authorization is required to modify subscription plan pricing and entitlements.',
          },
          { status: 403 }
        );
      }
      const planId = String(body.planId || '').trim() as SubscriptionTierId;
      const plans = await getAuthoritativeSubscriptionPlansAsync();
      const currentPlan = plans[planId];

      if (!currentPlan) {
        return NextResponse.json(
          { ok: false, error: 'Invalid subscription plan ID.' },
          { status: 400 }
        );
      }

      const monthlyPriceInr = Number(body.monthlyPriceInr);
      const annualPriceInr = Number(body.annualPriceInr);

      const rawLimit =
        body.maxActiveProducts !== undefined
          ? body.maxActiveProducts
          : body.entitlements?.maxActiveProducts !== undefined
            ? body.entitlements.maxActiveProducts
            : body.productLimit;

      const maxActiveProducts =
        rawLimit === 'UNLIMITED' || rawLimit === -1 || Number(rawLimit) >= 100000
          ? 999999
          : Number(rawLimit ?? currentPlan.entitlements.maxActiveProducts);

      if (
        !Number.isFinite(monthlyPriceInr) ||
        monthlyPriceInr < 0 ||
        !Number.isFinite(annualPriceInr) ||
        annualPriceInr < 0 ||
        !Number.isFinite(maxActiveProducts) ||
        maxActiveProducts < 1
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Plan prices must be non-negative numbers and max active SKUs must be at least 1.',
          },
          { status: 400 }
        );
      }

      const updatedPlan: SubscriptionPlan = {
        ...currentPlan,
        name: String(body.name || currentPlan.name).trim(),
        tagline: String(body.tagline || currentPlan.tagline).trim(),
        badge:
          body.badge !== undefined
            ? String(body.badge).trim()
            : currentPlan.badge,
        monthlyPriceInr: Math.round(monthlyPriceInr),
        annualPriceInr: Math.round(annualPriceInr),
        entitlements: {
          ...currentPlan.entitlements,
          ...(body.entitlements || {}),
          maxActiveProducts: Math.round(maxActiveProducts),
        },
      };

      await setAuthoritativeSubscriptionPlan(planId, updatedPlan);
      const allPlansMap = await getAuthoritativeSubscriptionPlansAsync();

      const audit = await recordAdminAuditLog({
        adminUid,
        actionType: 'UPDATE_SUBSCRIPTION_PLAN',
        targetEntityType: 'SUBSCRIPTION_PLAN',
        targetEntityId: planId,
        targetEntityName: updatedPlan.name,
        status: 'SUCCESS',
        reason,
        metadata: {
          monthlyPriceInr: updatedPlan.monthlyPriceInr,
          annualPriceInr: updatedPlan.annualPriceInr,
          maxActiveProducts: updatedPlan.entitlements.maxActiveProducts,
        },
      });

      return NextResponse.json({
        ok: true,
        plan: updatedPlan,
        plans: Object.values(allPlansMap),
        subscriptionPlans: Object.values(allPlansMap),
        audit,
        message: `Subscription plan "${updatedPlan.name}" updated for new enrollments (existing active seller subscriptions remain protected until renewal).`,
      });
    }

    // =========================================================================
    // 6. PLATFORM SETTINGS UPDATE
    // =========================================================================
    if (actionType === 'UPDATE_PLATFORM_SETTINGS') {
      if (!authCheck.authorized) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Administrator authorization is required to modify global platform settings.',
          },
          { status: 403 }
        );
      }
      const settingsInput =
        body.settings && typeof body.settings === 'object'
          ? (body.settings as Record<string, unknown>)
          : (body as Record<string, unknown>);

      const updated = updateAuthoritativePlatformSettings(
        {
          platformName:
            typeof settingsInput.platformName === 'string'
              ? settingsInput.platformName
              : undefined,
          publicWebsiteUrl:
            typeof settingsInput.publicWebsiteUrl === 'string'
              ? settingsInput.publicWebsiteUrl
              : undefined,
          domain:
            typeof settingsInput.domain === 'string'
              ? settingsInput.domain
              : undefined,
          supportPhone:
            typeof settingsInput.supportPhone === 'string'
              ? settingsInput.supportPhone
              : undefined,
          supportEmail:
            typeof settingsInput.supportEmail === 'string'
              ? settingsInput.supportEmail
              : undefined,
          merchantSupportEmail:
            typeof settingsInput.merchantSupportEmail === 'string'
              ? settingsInput.merchantSupportEmail
              : undefined,
          defaultCurrency:
            typeof settingsInput.defaultCurrency === 'string'
              ? settingsInput.defaultCurrency
              : undefined,
          marketplaceAvailable:
            typeof settingsInput.marketplaceAvailable === 'boolean'
              ? settingsInput.marketplaceAvailable
              : true,
          allowNewSellerRegistrations:
            typeof settingsInput.allowNewSellerRegistrations === 'boolean'
              ? settingsInput.allowNewSellerRegistrations
              : true,
          requireLocationVerificationForNewStores:
            typeof settingsInput.requireLocationVerificationForNewStores ===
            'boolean'
              ? settingsInput.requireLocationVerificationForNewStores
              : false,
          maintenanceBannerEnabled:
            typeof settingsInput.maintenanceBannerEnabled === 'boolean'
              ? settingsInput.maintenanceBannerEnabled
              : false,
          maintenanceBannerText: String(
            settingsInput.maintenanceBannerText ??
              settingsInput.maintenanceBannerMessage ??
              ''
          ),
          maintenanceBannerMessage: String(
            settingsInput.maintenanceBannerMessage ??
              settingsInput.maintenanceBannerText ??
              ''
          ),
          defaultFreeDeliveryThresholdInr: Math.max(
            0,
            Number(settingsInput.defaultFreeDeliveryThresholdInr) || 199
          ),
          defaultStandardDeliveryFeeInr: Math.max(
            0,
            Number(settingsInput.defaultStandardDeliveryFeeInr) || 25
          ),
          maxProductImageSizeMb: Math.min(
            20,
            Math.max(1, Number(settingsInput.maxProductImageSizeMb) || 5)
          ),
          fcmPushNotificationsEnabled:
            typeof settingsInput.fcmPushNotificationsEnabled === 'boolean'
              ? settingsInput.fcmPushNotificationsEnabled
              : true,
          excludeDemoFromProductionMetricsByDefault: Boolean(
            settingsInput.excludeDemoFromProductionMetricsByDefault ??
              settingsInput.excludeDemoRecordsFromProductionMetrics ??
              true
          ),
          excludeDemoRecordsFromProductionMetrics: Boolean(
            settingsInput.excludeDemoRecordsFromProductionMetrics ??
              settingsInput.excludeDemoFromProductionMetricsByDefault ??
              true
          ),
        },
        adminUid
      );

      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'UPDATE_PLATFORM_SETTINGS',
        targetEntityType: 'PLATFORM_SETTINGS',
        targetEntityId: 'global',
        targetEntityName: updated.platformName,
        status: 'SUCCESS',
        reason,
        metadata: {
          marketplaceAvailable: updated.marketplaceAvailable,
          fcmPushNotificationsEnabled: updated.fcmPushNotificationsEnabled,
        },
      });

      return NextResponse.json({
        ok: true,
        platformSettings: updated,
        audit,
        message: 'Platform configuration saved and audited.',
      });
    }

    // =========================================================================
    // 7. DEMO CATALOG SEED / REMOVAL
    // =========================================================================
    if (actionType === 'SEED_DEMO_DATA') {
      if (!authCheck.authorized) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Administrator authorization is required to seed or remove demo datasets.',
          },
          { status: 403 }
        );
      }
      const result = await seedNandedDemoCatalogToFirestore();
      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'SEED_DEMO_DATA',
        targetEntityType: 'SYSTEM',
        targetEntityId: result.batchId,
        status: 'SUCCESS',
        reason: 'Seeded Nanded 25-category demo catalog into Firestore.',
        metadata: {
          storesWritten: result.storesWritten,
          productsWritten: result.productsWritten,
        },
      });
      return NextResponse.json({
        ok: true,
        ...result,
        audit,
        message: `Seeded ${result.storesWritten} demo stores and ${result.productsWritten} demo products.`,
      });
    }

    if (actionType === 'REMOVE_DEMO_DATA') {
      if (!authCheck.authorized) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden: Administrator authorization is required to seed or remove demo datasets.',
          },
          { status: 403 }
        );
      }
      const result = await removeNandedDemoCatalogFromFirestore();
      const audit = await recordAdminAuditLog({
        adminUid,
        adminPhone,
        adminRole,
        actionType: 'REMOVE_DEMO_DATA',
        targetEntityType: 'SYSTEM',
        targetEntityId: 'nanded-25-cat-demo-v1',
        status: 'SUCCESS',
        reason: 'Removed Nanded demo catalog batch from Firestore.',
        metadata: {
          storesRemoved: result.storesRemoved,
          productsRemoved: result.productsRemoved,
        },
      });
      return NextResponse.json({
        ok: true,
        ...result,
        audit,
        message: `Removed ${result.storesRemoved} demo stores and ${result.productsRemoved} demo products.`,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported admin action: ${actionType}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error processing administrative action.',
      },
      { status: 500 }
    );
  }
}
