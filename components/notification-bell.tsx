'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Store,
  Briefcase,
  Sparkles,
  Megaphone,
  ExternalLink,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Send,
  Activity,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { buildAuthenticatedHeaders } from '@/lib/firebase';
import {
  getBrowserNotificationPermissionStatus,
  requestAndRegisterFcmToken,
  subscribeToForegroundMessages,
  triggerBrowserNotificationIfPermitted,
  BrowserPushPermissionState,
} from '@/lib/fcm-client';
import type {
  NotificationCategory,
  NotificationRecipientRole,
  UnifiedNotificationRecord,
  UserNotificationPreferences,
} from '@/lib/notifications-service';

export interface NotificationBellProps {
  role: NotificationRecipientRole;
  userId?: string;
  phoneE164?: string;
  sellerId?: string;
  storeId?: string;
  storeIds?: string[];
  partnerId?: string;
  variant?: 'light' | 'dark' | 'slate';
  onNavigate?: (destinationRoute: string, notification: UnifiedNotificationRecord) => void;
}

const CATEGORY_METADATA: Record<
  NotificationCategory,
  { label: string; colorClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ORDER_UPDATES: {
    label: 'Order Updates',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: ShoppingBag,
  },
  BUSINESS_UPDATES: {
    label: 'Business & Store',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Store,
  },
  PARTNER_UPDATES: {
    label: 'City Partner',
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Briefcase,
  },
  ACCOUNT_SECURITY: {
    label: 'Account & Security',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: ShieldAlert,
  },
  ADMIN_ALERTS: {
    label: 'Admin & Governance',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Megaphone,
  },
  MARKETING_PROMOTIONS: {
    label: 'Promotions & Offers',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: Sparkles,
  },
};

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Just now';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function NotificationBell({
  role,
  userId,
  phoneE164,
  sellerId,
  storeId,
  storeIds,
  partnerId,
  variant = 'light',
  onNavigate,
}: NotificationBellProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'UNREAD' | 'READ' | 'PREFERENCES' | 'ADMIN_BROADCAST'
  >('ALL');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'ALL'>('ALL');
  const [notifications, setNotifications] = useState<UnifiedNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalMatched, setTotalMatched] = useState(0);
  const [limit, setLimit] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [pushPermission, setPushPermission] = useState<BrowserPushPermissionState>('default');
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Admin Broadcast & Diagnostics state
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<
    NotificationRecipientRole | 'ALL'
  >('ALL');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCategory, setBroadcastCategory] =
    useState<NotificationCategory>('ADMIN_ALERTS');
  const [broadcastPriority, setBroadcastPriority] = useState<
    'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  >('NORMAL');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdminOrSuperAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const triggerToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  useEffect(() => {
    setPushPermission(getBrowserNotificationPermissionStatus());
  }, []);

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean; customLimit?: number }) => {
      if (!userId && !phoneE164 && !sellerId && !storeId && !partnerId && !isAdminOrSuperAdmin) {
        return;
      }
      if (!opts?.silent) setIsLoading(true);
      try {
        const headers = await buildAuthenticatedHeaders();
        const params = new URLSearchParams();
        params.set('role', role);
        if (userId) params.set('userId', userId);
        if (phoneE164) params.set('phoneE164', phoneE164);
        if (sellerId) params.set('sellerId', sellerId);
        if (storeId) params.set('storeId', storeId);
        if (partnerId) params.set('partnerId', partnerId);
        params.set('limit', String(opts?.customLimit || limit));
        if (isAdminOrSuperAdmin) params.set('diagnostics', 'true');

        const res = await fetch(`/api/notifications?${params.toString()}`, {
          headers,
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.ok) {
          setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
          setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
          setTotalMatched(typeof data.totalMatched === 'number' ? data.totalMatched : 0);
          if (data.preferences) {
            setPreferences(data.preferences);
          }
          if (data.diagnostics) {
            setDiagnostics(data.diagnostics);
          }
        }
      } catch {
        // Ignore transient network errors during background polling
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [
      role,
      userId,
      phoneE164,
      sellerId,
      storeId,
      partnerId,
      limit,
      isAdminOrSuperAdmin,
    ]
  );

  // Initial load and 12-second real-time poll
  useEffect(() => {
    fetchNotifications({ silent: true });
    const interval = setInterval(() => {
      fetchNotifications({ silent: true });
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Foreground FCM message subscription
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      const res = subscribeToForegroundMessages((payload: any) => {
        const title =
          payload.title || payload.notification?.title || payload.data?.title || 'CityKart Alert';
        const body =
          payload.body || payload.notification?.body || payload.data?.body || payload.data?.message || '';
        const dest = payload.data?.destinationRoute || '/';
        void triggerBrowserNotificationIfPermitted({
          dedupeKey: payload.data?.notificationId || payload.data?.eventKey || `fg-${Date.now()}`,
          title,
          body,
          destinationRoute: dest,
          recipientRole: role,
        });
        fetchNotifications({ silent: true });
      });

      if (typeof res === 'function') {
        unsub = res;
      } else if (res && typeof (res as any).then === 'function') {
        (res as any).then((fn: any) => {
          if (typeof fn === 'function') unsub = fn;
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to subscribe to foreground FCM messages:', err);
    }

    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [fetchNotifications, role]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleMarkSingleRead = async (notif: UnifiedNotificationRecord) => {
    if (notif.status === 'READ') return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notif.id
          ? { ...n, status: 'READ', isRead: true, readAt: new Date().toISOString() }
          : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      const headers = await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' });
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'MARK_READ',
          notificationId: notif.id,
          role,
          userId,
          phoneE164,
          sellerId,
          storeId,
          partnerId,
        }),
      });
    } catch {
      // Optimistic state already updated
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        status: 'READ',
        isRead: true,
        readAt: n.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    try {
      const headers = await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' });
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'MARK_ALL_READ',
          role,
          userId,
          phoneE164,
          sellerId,
          storeId,
          partnerId,
        }),
      });
      triggerToast('All notifications marked as read.');
    } catch {
      // Optimistic update applied
    }
  };

  const handleNotificationClick = async (notif: UnifiedNotificationRecord) => {
    await handleMarkSingleRead(notif);
    setIsDropdownOpen(false);
    setIsCenterModalOpen(false);
    if (onNavigate && notif.destinationRoute) {
      onNavigate(notif.destinationRoute, notif);
      return;
    }
    if (notif.destinationRoute) {
      router.push(notif.destinationRoute);
    }
  };

  const handleEnableBrowserPush = async () => {
    setIsRequestingPush(true);
    try {
      const res = await requestAndRegisterFcmToken({
        userId: userId || phoneE164 || sellerId || partnerId || 'anonymous',
        phoneE164,
        sellerId,
        storeIds: storeIds || (storeId ? [storeId] : undefined),
        partnerId,
        role,
        roles: [role],
      });
      setPushPermission(res.permission);
      if (res.permission === 'granted') {
        await handleUpdatePreferences({ browserPushEnabled: true });
        triggerToast(
          res.isSimulated
            ? 'Browser push alerts enabled (VAPID fallback token active).'
            : 'Browser push alerts enabled via Firebase Cloud Messaging!'
        );
      } else if (res.permission === 'denied') {
        triggerToast(
          'Browser notification permission is blocked. Enable notifications in your browser site settings.'
        );
      }
    } finally {
      setIsRequestingPush(false);
    }
  };

  const handleUpdatePreferences = async (
    patch: Partial<{
      inAppEnabled: boolean;
      browserPushEnabled: boolean;
      marketingEnabled: boolean;
      categories: Partial<Record<NotificationCategory, boolean>>;
    }>
  ) => {
    setIsSavingPrefs(true);
    try {
      const headers = await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          userId: userId || phoneE164 || sellerId || partnerId,
          phoneE164,
          ...patch,
        }),
      });
      const data = await res.json();
      if (data.ok && data.preferences) {
        setPreferences(data.preferences);
        triggerToast('Notification preferences saved.');
      }
    } catch {
      triggerToast('Failed to update notification preferences.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSendAdminBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      triggerToast('Please enter both an announcement title and message.');
      return;
    }
    setIsBroadcasting(true);
    try {
      const headers = await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'ADMIN_ANNOUNCEMENT',
          targetRole: broadcastTargetRole,
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          category: broadcastCategory,
          priority: broadcastPriority,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBroadcastTitle('');
        setBroadcastMessage('');
        triggerToast(`Broadcast delivered to ${data.dispatchedCount || 1} recipient group(s).`);
        fetchNotifications({ silent: true });
      } else {
        triggerToast(data.error || 'Failed to broadcast announcement.');
      }
    } catch {
      triggerToast('Network error while sending announcement.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'UNREAD' && n.status !== 'UNREAD') return false;
    if (activeTab === 'READ' && n.status !== 'READ') return false;
    if (selectedCategory !== 'ALL' && n.category !== selectedCategory) return false;
    return true;
  });

  const buttonClasses =
    variant === 'dark'
      ? 'relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors cursor-pointer'
      : variant === 'slate'
        ? 'relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer'
        : 'relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-colors cursor-pointer';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Notification Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsDropdownOpen((prev) => !prev);
          if (!isDropdownOpen) fetchNotifications({ silent: true });
        }}
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Notifications & Alerts"
        className={buttonClasses}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Real-time Dropdown Panel */}
      {isDropdownOpen && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-12 w-[calc(100vw-1.5rem)] sm:w-96 max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm tracking-tight">
                Notifications
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {role}
              </span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setActiveTab('PREFERENCES');
                  setIsCenterModalOpen(true);
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Notification Preferences"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Browser Push Permission Banner (User-Action Triggered Only) */}
          {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
            <div className="px-4 py-2.5 bg-indigo-50/90 border-b border-indigo-100 flex items-center justify-between gap-2">
              <div className="text-xs text-indigo-950">
                <p className="font-semibold">Instant Browser Push Alerts</p>
                <p className="text-[11px] text-indigo-700">
                  {pushPermission === 'denied'
                    ? 'Blocked in browser site settings. Re-enable in your browser address bar.'
                    : 'Get real-time order, PIN & account alerts even in the background.'}
                </p>
              </div>
              {pushPermission === 'default' && (
                <button
                  type="button"
                  disabled={isRequestingPush}
                  onClick={handleEnableBrowserPush}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isRequestingPush ? 'Enabling...' : 'Enable Push'}
                </button>
              )}
            </div>
          )}

          {/* Notification Items List */}
          <div className="overflow-y-auto divide-y divide-slate-100 max-h-96">
            {notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  You&apos;re all caught up!
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Real-time alerts for orders, deliveries, and account updates will appear here.
                </p>
              </div>
            ) : (
              notifications.slice(0, 8).map((notif) => {
                const catMeta =
                  CATEGORY_METADATA[notif.category] || CATEGORY_METADATA.ORDER_UPDATES;
                const IconComp = catMeta.icon;
                const isUnread = notif.status === 'UNREAD';

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`px-4 py-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                      isUnread
                        ? 'bg-indigo-50/40 hover:bg-indigo-50/80'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${catMeta.colorClass}`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs leading-snug ${
                            isUnread
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catMeta.colorClass}`}
                        >
                          {catMeta.label}
                        </span>
                        {notif.destinationRoute && (
                          <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                            View details
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                    {isUnread && (
                      <span
                        className="mt-1.5 w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"
                        title="Unread"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                setActiveTab('ALL');
                setIsCenterModalOpen(true);
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold text-center transition-colors cursor-pointer"
            >
              Open Notification Center ({totalMatched})
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                setActiveTab('PREFERENCES');
                setIsCenterModalOpen(true);
              }}
              className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Preferences
            </button>
          </div>
        </div>
      )}

      {/* Full Notification Center & Preferences Modal */}
      {isCenterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight flex items-center gap-2">
                    CityKart Notification Center
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                      {role}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Real-time in-app alerts, Firebase Cloud Messaging push history & preferences
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchNotifications()}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  title="Refresh notifications"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCenterModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {(
                  [
                    { id: 'ALL', label: `All (${totalMatched})` },
                    { id: 'UNREAD', label: `Unread (${unreadCount})` },
                    { id: 'READ', label: 'Read' },
                    { id: 'PREFERENCES', label: 'Notification Preferences' },
                    ...(isAdminOrSuperAdmin
                      ? [{ id: 'ADMIN_BROADCAST', label: 'Admin Broadcast & Telemetry' }]
                      : []),
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab !== 'PREFERENCES' &&
                activeTab !== 'ADMIN_BROADCAST' &&
                unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="mb-2 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark All {unreadCount} Read
                  </button>
                )}
            </div>

            {statusToast && (
              <div className="px-6 py-2.5 bg-emerald-950 text-emerald-200 text-xs font-semibold flex items-center justify-between">
                <span>{statusToast}</span>
                <button
                  type="button"
                  onClick={() => setStatusToast(null)}
                  className="text-emerald-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'PREFERENCES' ? (
                <div className="space-y-6 max-w-2xl mx-auto">
                  {/* Browser Push Permission Card */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          Browser Push Notifications (FCM)
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            pushPermission === 'granted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pushPermission === 'denied'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Permission: {pushPermission.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Receive instant desktop & mobile browser notifications even when CityKart is in the background.
                      </p>
                    </div>
                    {pushPermission !== 'granted' ? (
                      <button
                        type="button"
                        disabled={isRequestingPush || pushPermission === 'denied'}
                        onClick={handleEnableBrowserPush}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {pushPermission === 'denied'
                          ? 'Blocked in Browser Settings'
                          : isRequestingPush
                            ? 'Requesting Permission...'
                            : 'Grant Push Permission'}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 shrink-0">
                        <Check className="w-4 h-4" />
                        FCM Device Token Active
                      </span>
                    )}
                  </div>

                  {/* Channel Delivery Switches */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Delivery Channels
                    </h3>

                    <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          In-App Notification Center
                        </p>
                        <p className="text-xs text-slate-500">
                          Display real-time badges and persistent history inside your CityKart dashboard.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingPrefs}
                        onClick={() =>
                          handleUpdatePreferences({
                            inAppEnabled: !(preferences?.inAppEnabled ?? true),
                          })
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                          preferences?.inAppEnabled !== false
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preferences?.inAppEnabled !== false ? (
                          <>
                            <Volume2 className="w-4 h-4" /> Enabled
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-4 h-4" /> Muted
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Browser Push Delivery
                        </p>
                        <p className="text-xs text-slate-500">
                          Deliver background & foreground push alerts via Firebase Cloud Messaging.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingPrefs}
                        onClick={() =>
                          handleUpdatePreferences({
                            browserPushEnabled: !(preferences?.browserPushEnabled ?? true),
                          })
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                          preferences?.browserPushEnabled !== false
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preferences?.browserPushEnabled !== false ? (
                          <>
                            <Volume2 className="w-4 h-4" /> Enabled
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-4 h-4" /> Paused
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Marketing & Promotional Offers
                        </p>
                        <p className="text-xs text-slate-500">
                          Receive local store deals, seasonal campaigns, and featured city promotions.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingPrefs}
                        onClick={() => {
                          const nextVal = !(preferences?.marketingEnabled ?? true);
                          handleUpdatePreferences({
                            marketingEnabled: nextVal,
                            categories: {
                              ...(preferences?.categories || {}),
                              MARKETING_PROMOTIONS: nextVal,
                            },
                          });
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                          preferences?.marketingEnabled !== false
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preferences?.marketingEnabled !== false ? 'Opted In' : 'Opted Out'}
                      </button>
                    </div>
                  </div>

                  {/* Category Granular Toggles */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Category Preferences
                    </h3>
                    {(Object.keys(CATEGORY_METADATA) as NotificationCategory[]).map((cat) => {
                      const meta = CATEGORY_METADATA[cat];
                      const IconComp = meta.icon;
                      const isMandatory = cat === 'ACCOUNT_SECURITY';
                      const isEnabled = isMandatory
                        ? true
                        : preferences?.categories?.[cat] !== false;

                      return (
                        <div
                          key={cat}
                          className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${meta.colorClass}`}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                {meta.label}
                                {isMandatory && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                                    <Lock className="w-3 h-3" /> Mandatory
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {isMandatory
                                  ? 'Critical OTP, PIN & account security alerts are always active.'
                                  : `Receive ${meta.label.toLowerCase()} notifications.`}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isMandatory || isSavingPrefs}
                            onClick={() =>
                              handleUpdatePreferences({
                                categories: {
                                  ...(preferences?.categories || {}),
                                  [cat]: !isEnabled,
                                },
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 ${
                              isEnabled
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {isEnabled ? 'Active' : 'Muted'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeTab === 'ADMIN_BROADCAST' && isAdminOrSuperAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Broadcast Form */}
                  <form
                    onSubmit={handleSendAdminBroadcast}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Dispatch Platform Announcement
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600">
                      Send an immediate in-app + FCM push notification to all users or a specific role cohort.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Target Recipient Cohort
                        </label>
                        <select
                          value={broadcastTargetRole}
                          onChange={(e) => setBroadcastTargetRole(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold"
                        >
                          <option value="ALL">All Roles (Platform-Wide)</option>
                          <option value="BUYER">Buyers Only</option>
                          <option value="SELLER">Sellers / Merchants Only</option>
                          <option value="PARTNER">City Partners Only</option>
                          <option value="ADMIN">Operational Admins</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Category
                        </label>
                        <select
                          value={broadcastCategory}
                          onChange={(e) => setBroadcastCategory(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold"
                        >
                          <option value="ADMIN_ALERTS">Admin & Governance Alert</option>
                          <option value="BUSINESS_UPDATES">Business Update</option>
                          <option value="MARKETING_PROMOTIONS">Marketing Promotion</option>
                          <option value="ACCOUNT_SECURITY">Mandatory Security Notice</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Announcement Headline
                      </label>
                      <input
                        type="text"
                        required
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="e.g., Festive Same-Day Delivery Window Extended"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Announcement Message
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Enter clear, actionable announcement details..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <select
                        value={broadcastPriority}
                        onChange={(e) => setBroadcastPriority(e.target.value as any)}
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold"
                      >
                        <option value="NORMAL">Priority: Normal</option>
                        <option value="HIGH">Priority: High</option>
                        <option value="CRITICAL">Priority: Critical</option>
                      </select>

                      <button
                        type="submit"
                        disabled={isBroadcasting}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isBroadcasting ? 'Broadcasting...' : 'Broadcast Now'}
                      </button>
                    </div>
                  </form>

                  {/* Delivery Telemetry & FCM Status Card */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-extrabold text-slate-900">
                          FCM & Notification Telemetry
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          diagnostics?.fcmAdminReady
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {diagnostics?.fcmAdminReady
                          ? 'Firebase Admin Messaging Ready'
                          : 'In-App + Web SDK Active'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500">Total Events</p>
                        <p className="text-lg font-extrabold text-slate-900">
                          {diagnostics?.totalNotifications ?? notifications.length}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500">Unread</p>
                        <p className="text-lg font-extrabold text-indigo-600">
                          {diagnostics?.unreadNotifications ?? unreadCount}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500">FCM Tokens</p>
                        <p className="text-lg font-extrabold text-emerald-700">
                          {diagnostics?.fcmTokenSummary?.totalTokens ?? 0}
                        </p>
                      </div>
                    </div>

                    {diagnostics?.deliveryBreakdown && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-700">
                          Delivery Pipeline Breakdown
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          {Object.entries(diagnostics.deliveryBreakdown).map(([k, v]) => (
                            <div
                              key={k}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                            >
                              <span className="font-mono text-slate-600 truncate">{k}</span>
                              <span className="font-bold text-slate-900">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                        selectedCategory === 'ALL'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      All Categories
                    </button>
                    {(Object.keys(CATEGORY_METADATA) as NotificationCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                          selectedCategory === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {CATEGORY_METADATA[cat].label}
                      </button>
                    ))}
                  </div>

                  {/* Filtered Notifications List */}
                  {filteredNotifications.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
                      <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-800">
                        No matching notifications
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try switching the filter tab or category above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredNotifications.map((notif) => {
                        const catMeta =
                          CATEGORY_METADATA[notif.category] ||
                          CATEGORY_METADATA.ORDER_UPDATES;
                        const IconComp = catMeta.icon;
                        const isUnread = notif.status === 'UNREAD';

                        return (
                          <div
                            key={notif.id}
                            className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                              isUnread
                                ? 'bg-indigo-50/40 border-indigo-200 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                              <div
                                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${catMeta.colorClass}`}
                              >
                                <IconComp className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-sm ${
                                      isUnread
                                        ? 'font-extrabold text-slate-900'
                                        : 'font-bold text-slate-700'
                                    }`}
                                  >
                                    {notif.title}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catMeta.colorClass}`}
                                  >
                                    {catMeta.label}
                                  </span>
                                  {isUnread && (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                                      UNREAD
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                                  {notif.message}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-slate-400">
                                  <span>{formatRelativeTime(notif.createdAt)}</span>
                                  <span>•</span>
                                  <span className="font-mono">{notif.eventType}</span>
                                  {notif.deliveryState && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono text-slate-500">
                                        {notif.deliveryState}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {isUnread && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkSingleRead(notif)}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Mark read
                                </button>
                              )}
                              {notif.destinationRoute && (
                                <button
                                  type="button"
                                  onClick={() => handleNotificationClick(notif)}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  Open
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {notifications.length < totalMatched && (
                        <div className="pt-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const nextLimit = limit + 25;
                              setLimit(nextLimit);
                              fetchNotifications({ customLimit: nextLimit });
                            }}
                            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                          >
                            Load More Notifications ({notifications.length} of {totalMatched})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
