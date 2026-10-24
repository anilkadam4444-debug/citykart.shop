import { OrderRecord } from './catalog-data';

export interface SellerNotification {
  id: string;
  sellerId: string;
  sellerUid?: string;
  orderId: string;
  title: string;
  message: string;
  type: 'NEW_ORDER' | 'ORDER_CANCELLED' | 'ORDER_STATUS_CHANGED';
  isRead: boolean;
  createdAt: string;
}

// Global singleton maps to persist orders and notifications across Next.js API route invocations in Node memory
declare global {
  var __serverOrdersRegistry: Map<string, OrderRecord> | undefined;
  var __serverNotificationsRegistry: Map<string, SellerNotification> | undefined;
}

if (!globalThis.__serverOrdersRegistry) {
  globalThis.__serverOrdersRegistry = new Map<string, OrderRecord>();
}

if (!globalThis.__serverNotificationsRegistry) {
  globalThis.__serverNotificationsRegistry = new Map<string, SellerNotification>();
}

export const serverOrdersRegistry = globalThis.__serverOrdersRegistry;
export const serverNotificationsRegistry = globalThis.__serverNotificationsRegistry;

