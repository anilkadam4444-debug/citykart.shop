# CityKart — Full Application Emulation Report

**Audit Date**: 2026-10-28  
**Target Environment**: `http://localhost:3000` (Next.js 15 App Router + TypeScript + Firebase Auth/Firestore + Authoritative Server Registries)  
**Overall Emulation Verdict**: **PASS — All 5 Roles & Cross-Role Workflows Verified**

---

## 1. Executive Summary

A complete multi-role operational emulation was performed across all five implemented user roles in CityKart:
1. **Buyer** (`role: 'buyer'`)
2. **Seller / Business Owner** (`role: 'seller'`)
3. **Partner (City Partner Applicant & Approved Partner)** (`role: 'partner'`)
4. **Operational Admin** (`role: 'admin'`)
5. **Super Admin / Platform Owner** (`role: 'super_admin'`, `+918329306616`)

During the audit, six defects (including the preview Firestore gRPC `PERMISSION_DENIED` stream error, the Partner OTP $\rightarrow$ Application submission authentication regression, the missing `GET /api/orders/[orderId]/pin` handler & server PIN vault, and unguarded Super Admin bootstrap) were root-caused, patched, and verified against `http://localhost:3000`.

---

## 2. Phase-by-Phase Emulation Results

### Phase 1 & 9: Application Discovery & Route Verification
- **Public & Marketplace Routes Verified (`HTTP 200`)**:
  - `/` (Home Marketplace, City Selector, Category Filter, Store Cards with `StoreRatingBadge`, Hamburger Menu)
  - `/stores/store-1` (Storefront Detail Page, Store Header `StoreRatingBadge`, Catalog Search, Add-to-Cart)
  - `/categories/cat-kirana` (Category Page with Store & Product Star Ratings)
  - `/orders` (Buyer Order History, 6-Digit Delivery PIN Vault, Post-Delivery `OrderStoreRatingWidget`)
  - `/seller` (Seller Hub, Store Registration, Inventory Management, Order Queue, 6-Digit PIN Verification Modal)
  - `/partner` & `/partner/verify-otp` (Partner Program Portal, Mobile OTP Verification, Application Form, Approved Partner Dashboard)
  - `/pricing`, `/about`, `/contact`, `/privacy`, `/terms` (Subscription Plans & Legal/Support Pages)
  - `/admin` & `/admin/partners` (Super Admin & Operational Admin Governance Console & Partner Review Queue)

### Phase 3: Buyer Emulation
- **OTP Registration & Session Continuity (`BUYER-01`, `BUYER-02`)**: Verified `REQUEST_OTP` $\rightarrow$ `VERIFY_OTP` $\rightarrow$ `COMPLETE_REGISTRATION` issues a signed `ck_sess.<base64url>` session token and persists across reloads.
- **Order Placement & 6-Digit Delivery PIN (`BUYER-04`..`BUYER-07`)**:
  - Buyer places a Pay-on-Delivery order (`POST /api/orders`) and receives a 6-digit `deliveryPin`.
  - Buyer retrieves the PIN via `GET /api/orders/[orderId]/pin` and regenerates the PIN via `POST /api/orders/[orderId]/pin`.
  - Public order listing (`GET /api/orders`) strips the raw PIN (`sanitizeOrderForStorageAndListing`) while preserving the authoritative PIN in `serverOrderPinsVault`.
- **Post-Delivery Store Star Rating**:
  - On any `DELIVERED` order, buyers can submit a 1–5 star rating and review comment via `OrderStoreRatingWidget`, immediately updating the store's weighted average rating (`StoreRatingBadge`) across store cards and store pages.

### Phase 4: Seller / Business Owner Emulation
- **Seller Registration & Store Management (`SELLER-01`)**: Verified seller onboarding via `journey: 'SELLER'` assigns `role: 'seller'` and `sellerId`.
- **Order Progression & Mandatory 6-Digit PIN Gate (`SELLER-02`..`SELLER-04`)**:
  - Seller progresses order status through `CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `OUT_FOR_DELIVERY` via `PATCH /api/orders/[orderId]/status`.
  - Direct transition to `DELIVERED` without customer PIN verification is blocked (`HTTP 400 PIN_REQUIRED`).
  - Submitting an invalid PIN (`000000`) to `POST /api/orders/[orderId]/verify-pin` is rejected (`HTTP 400`); submitting the buyer's active 6-digit PIN transitions the order to `DELIVERED` (`HTTP 200`).
- **Cross-Seller Store Protection (`SELLER-05`)**: Non-owner seller attempting `DELETE /api/stores/store-1` is blocked (`HTTP 403`).

### Phase 5: Partner Emulation (Including Mandatory Regression Test)
- **Unauthenticated Block (`PARTNER-01`)**: Unauthenticated `POST /api/partners/applications` is rejected (`HTTP 401`).
- **Mandatory Regression Test (`PARTNER-02`)**: Partner completes OTP verification and submits `POST /api/partners/applications`. Application succeeds (`HTTP 200`, `status: 'PENDING'`) with **zero** `"Authentication is required. Please verify mobile number."` errors.
- **Duplicate & Pre-Approval Protections (`PARTNER-03`..`PARTNER-05`)**:
  - Duplicate active application from the same phone is rejected (`HTTP 409`).
  - Pending applicant is blocked from `GET /api/partners/dashboard` (`HTTP 403`) and blocked from self-approving via `POST /api/admin/partners` (`HTTP 403`).

### Phase 6 & 7: Operational Admin & Super Admin Emulation
- **Super Admin Governance (`SUPERADMIN-01`..`SUPERADMIN-06`)**:
  - Designated Platform Owner (`+918329306616`) authenticates with `role: 'super_admin'`, loads `/api/admin/dashboard`, invites an Operational Admin (`INVITE_ADMIN`), suspends and restores a store (`SUSPEND_STORE` / `RESTORE_STORE`), updates subscription plans (`UPDATE_SUBSCRIPTION_PLAN`) and platform settings (`UPDATE_PLATFORM_SETTINGS`), and revokes the Operational Admin (`REVOKE_ADMIN`).
- **Operational Admin Boundaries (`OPADMIN-01`..`OPADMIN-03`)**:
  - Invited Operational Admin accesses `/api/admin/dashboard` (`isSuperAdmin: false`) and approves the pending Partner application (`POST /api/admin/partners` $\rightarrow$ `APPROVED`), unlocking the Partner's dashboard (`PARTNER-07`).
  - Operational Admin is blocked (`HTTP 403`) from `INVITE_ADMIN` and `DELETE_STORE`, and immediately loses dashboard access (`HTTP 403`) once revoked by the Super Admin.
