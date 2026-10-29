# CityKart — Cross-Role Workflow Report

**Audit Date**: 2026-10-28  
**Target Environment**: `http://localhost:3000`

---

## Workflow 1: Buyer Order $\rightarrow$ Seller Fulfillment $\rightarrow$ 6-Digit PIN Verification $\rightarrow$ Buyer Store Star Rating

1. **Buyer** authenticates via OTP (`POST /api/auth/otp`) and places an intra-city Pay-on-Delivery order (`POST /api/orders`) for `store-1` (*Mahalaxmi Kirana & Supermart*).
2. **Server** generates a 6-digit `deliveryPin`, stores it in `serverOrderPinsVault`, and strips the raw PIN from public `GET /api/orders` responses.
3. **Buyer** retrieves the PIN (`GET /api/orders/[orderId]/pin`) and regenerates it (`POST /api/orders/[orderId]/pin` $\rightarrow$ `pinVersion: 2`).
4. **Seller** advances the order status (`CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `OUT_FOR_DELIVERY`) via `PATCH /api/orders/[orderId]/status`.
5. **Seller** attempts to mark the order `DELIVERED` without a PIN and is blocked with `HTTP 400 (PIN_REQUIRED)`.
6. **Seller** verifies the buyer's regenerated 6-digit PIN via `POST /api/orders/[orderId]/verify-pin`, transitioning the order to `DELIVERED` (`deliveryPinInfo.status: 'VERIFIED'`).
7. **Buyer** submits a 5-star store rating and review on the `DELIVERED` order (`OrderStoreRatingWidget`), immediately updating the store's average rating and review count across all store cards and store pages (`StoreRatingBadge`).

---

## Workflow 2: Partner OTP Verification $\rightarrow$ Partner Application $\rightarrow$ Operational Admin Approval $\rightarrow$ Partner Dashboard Unlock

1. **Partner Applicant** verifies their mobile number via `/api/auth/otp` and receives a structured `ck_sess.<base64url>` session token.
2. **Partner Applicant** submits a City Partner application (`POST /api/partners/applications`), which succeeds (`HTTP 200`, `status: 'PENDING'`) without triggering `"Authentication is required. Please verify mobile number."`
3. **Partner Applicant** is blocked from submitting a duplicate application (`HTTP 409`), blocked from accessing `GET /api/partners/dashboard` before approval (`HTTP 403`), and blocked from self-approving via `POST /api/admin/partners` (`HTTP 403`).
4. **Operational Admin** reviews and approves the application via `POST /api/admin/partners` (`action: 'APPROVE'`), generating an active `PartnerProfile` with a referral code (`CKP-...`) and recording an admin audit log entry.
5. **Approved Partner** accesses `GET /api/partners/dashboard` (`HTTP 200`) and views their referral code, onboarding attribution, and commission ledger.

---

## Workflow 3: Super Admin Governance $\rightarrow$ Operational Admin Invite, Oversight & Revocation

1. **Super Admin** (`+918329306616`) invites an Operational Admin via `POST /api/admin/management` (`INVITE_ADMIN`).
2. **Operational Admin** authenticates via OTP, loads `GET /api/admin/dashboard` (`isSuperAdmin: false`), and approves partner applications, while being blocked (`HTTP 403`) from `INVITE_ADMIN` and `DELETE_STORE`.
3. **Super Admin** revokes the Operational Admin via `POST /api/admin/management` (`REVOKE_ADMIN`).
4. **Revoked Admin** is immediately blocked (`HTTP 403`) on subsequent `/api/admin/dashboard` requests.
