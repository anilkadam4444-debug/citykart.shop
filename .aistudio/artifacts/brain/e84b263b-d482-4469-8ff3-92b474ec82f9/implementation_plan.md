# Implementation Plan — Platform Fee System

Implement a 2% (capped at ₹70/unit) platform fee system accrued per order and collected during subscription renewal.

## 1. Data Schema Extensions
- `platform_fee_ledger` (Firestore Collection):
  - `id`: string
  - `sellerId`: string
  - `orderId`: string
  - `amount`: number
  - `currency`: string
  - `status`: 'pending_eligibility' | 'outstanding' | 'paid' | 'reversed'
  - `createdAt`: ISO string

## 2. Backend Logic (Server-Side Authority)
- **Fee Accrual**: Triggered on `orderStatus: 'DELIVERED'` in `orders-registry`. Updates `platform_fee_ledger` entries to `outstanding`.
- **Renewal Billing (`/app/api/billing/create-checkout`)**:
  - Fetch `outstanding` fees for the `sellerId`.
  - Calculate total renewal: `planPrice + tax + outstandingFees`.
  - Pass breakdown in Razorpay Order notes.
- **Payment Settlement (`/app/api/billing/verify-payment` & webhook)**:
  - Validate Razorpay signature.
  - On `SUCCESS`, atomically update `platform_fee_ledger` entries to `paid`.

## 3. Security & Validation
- Enforce backend-authoritative calculation in all billing routes.
- Use idempotency keys for all ledger state transitions.
- Audit Firestore rules to prevent seller-initiated fee updates.

## 4. Dashboard UI
- Seller: "Billing" tab showing outstanding, paid, and itemized fees.
- Admin: Reconciliation view of collected vs outstanding fees by seller.

## 5. Next Steps
1. Define Firestore rules for ledger.
2. Implement fee accrual Cloud Function/API call on delivery confirmation.
3. Modify `/app/api/billing/create-checkout/route.ts` to fetch and add outstanding fees.
4. Modify payment verification to settle ledger entries.
