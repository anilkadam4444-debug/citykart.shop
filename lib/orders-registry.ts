import { INITIAL_PRODUCTS, OrderRecord } from './catalog-data';
import { createInitialDeliveryPinInfo } from './delivery-pin';

declare global {
  var __serverOrdersRegistry: Map<string, OrderRecord> | undefined;
  var __serverOrderPinsVault: Map<string, string> | undefined;
  var __serverNotificationsRegistry: any[] | undefined;
}

const seedProduct = INITIAL_PRODUCTS[0];

if (!globalThis.__serverOrdersRegistry) {
  const demoPin = '482915';
  const initialMap = new Map<string, OrderRecord>();
  if (seedProduct) {
    initialMap.set('demo-order-101', {
      id: 'demo-order-101',
      orderNumber: 'demo-order-101',
      createdAt: 'Today, 11:30 AM',
      createdAtIso: new Date().toISOString(),
      storeId: seedProduct.storeId || 'store-1',
      storeName: seedProduct.storeName || 'Nanded Spice & Kirana Bazaar',
      sellerId: seedProduct.sellerId || 'seller-1',
      items: [
        {
          productId: seedProduct.id,
          storeId: seedProduct.storeId,
          productName: seedProduct.name,
          price: seedProduct.price,
          quantity: 2,
          unit: seedProduct.unit,
          product: seedProduct,
          variant: seedProduct.variants?.[0] || 'Standard',
          platformFee: 5,
        },
      ],
      subtotal: seedProduct.price * 2,
      deliveryFee: 0,
      discount: 0,
      totalPlatformFee: 5,
      total: seedProduct.price * 2 + 5,
      paymentMethod: 'PAY_ON_DELIVERY',
      paymentStatus: 'PENDING',
      customer: {
        fullName: 'Rahul Sharma',
        phone: '+91 98765 43210',
        phoneE164: '+919876543210',
        country: 'India',
        stateRegion: 'Maharashtra',
        address: 'Plot 14, Vazirabad Main Road',
        deliveryAddress: 'Plot 14, Vazirabad Main Road',
        city: 'Nanded',
        locality: 'Vazirabad',
        postalCode: '431601',
        notes: 'Call at gate upon arrival',
      },
      currentStepIndex: 1,
      orderStatus: 'PREPARING',
      deliveryPinInfo: createInitialDeliveryPinInfo(demoPin),
      isDemo: true,
      estimatedMins: 25,
    });

    initialMap.set('demo-order-102', {
      id: 'demo-order-102',
      orderNumber: 'demo-order-102',
      createdAt: 'Yesterday, 6:15 PM',
      createdAtIso: new Date(Date.now() - 86400000).toISOString(),
      storeId: seedProduct.storeId || 'store-1',
      storeName: seedProduct.storeName || 'Nanded Spice & Kirana Bazaar',
      sellerId: seedProduct.sellerId || 'seller-1',
      items: [
        {
          productId: seedProduct.id,
          storeId: seedProduct.storeId,
          productName: seedProduct.name,
          price: seedProduct.price,
          quantity: 1,
          unit: seedProduct.unit,
          product: seedProduct,
          variant: seedProduct.variants?.[0] || 'Standard',
          platformFee: 5,
        },
      ],
      subtotal: seedProduct.price,
      deliveryFee: 0,
      discount: 0,
      totalPlatformFee: 5,
      total: seedProduct.price + 5,
      paymentMethod: 'PAY_ON_DELIVERY',
      paymentStatus: 'PAID',
      paymentCollectionMethod: 'UPI_ON_DELIVERY',
      customer: {
        fullName: 'Rahul Sharma',
        phone: '+91 98765 43210',
        phoneE164: '+919876543210',
        country: 'India',
        stateRegion: 'Maharashtra',
        address: 'Plot 14, Vazirabad Main Road',
        deliveryAddress: 'Plot 14, Vazirabad Main Road',
        city: 'Nanded',
        locality: 'Vazirabad',
        postalCode: '431601',
        notes: 'Delivered at main gate',
      },
      currentStepIndex: 3,
      orderStatus: 'DELIVERED',
      deliveredAt: new Date(Date.now() - 82800000).toISOString(),
      deliveryPinVerified: true,
      deliveryPinInfo: {
        ...createInitialDeliveryPinInfo('918273'),
        status: 'VERIFIED',
        verified: true,
        verifiedAt: new Date(Date.now() - 82800000).toISOString(),
      },
      isDemo: true,
      estimatedMins: 25,
    });
  }
  globalThis.__serverOrdersRegistry = initialMap;
}

if (!globalThis.__serverOrderPinsVault) {
  const initialPins = new Map<string, string>();
  initialPins.set('demo-order-101', '482915');
  initialPins.set('demo-order-102', '918273');
  globalThis.__serverOrderPinsVault = initialPins;
}

if (!globalThis.__serverNotificationsRegistry) {
  globalThis.__serverNotificationsRegistry = [];
}

export const serverOrdersRegistry = globalThis.__serverOrdersRegistry;
export const serverOrderPinsVault = globalThis.__serverOrderPinsVault;
export const serverNotificationsRegistry = globalThis.__serverNotificationsRegistry;


