# CityKart — Phase 1 Initial Repository & Architecture Audit (`qa/initial-audit.md`)

**Audit Date**: 2026-10-28  
**Platform**: CityKart — Intra-City Direct-to-Consumer & Neighborhood Merchant Platform  
**Framework & Runtime**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, Firebase Auth & Cloud Firestore (`urbandirectintracity`), and Authoritative Server-Side State Registries.  
**Development Server**: `http://localhost:3000`

---

## 1. Repository & Architecture Overview

### 1.1 Core Architectural Layers
1. **App Router Pages (`/app/**`)**:
   - Server and Client pages for public marketplace browsing, store & product discovery, category filtering, buyer order tracking, seller workspace (`/seller`), partner portal & OTP verification (`/partner`, `/partner/verify-otp`), admin console (`/admin`), subscription pricing (`/pricing`), and informational/legal pages (`/about`, `/how-it-works`, `/seller-guide`, `/delivery-returns`, `/contact`, `/privacy`, `/terms`).
2. **Backend API Route Handlers (`/app/api/**`)**:
   - RESTful endpoints handling mobile OTP authentication, order creation, 6-digit delivery PIN management & verification, store lifecycle & deletion tombstones, partner applications & dashboard metrics, subscription/campaign billing, location discovery, FCM notifications, and Admin/Super Admin platform governance.
3. **Domain & Security Libraries (`/lib/**`)**:
   - **`/lib/firebase.ts` & `/lib/firebase-admin.ts`**: Client & server Firebase initialization, `IS_PREVIEW_DUMMY_FIREBASE` safeguard (silencing dummy preview gRPC `Listen` stream errors), session token storage, and `buildAuthenticatedHeaders()`.
   - **`/lib/super-admin-auth.ts`**: Authoritative RBAC & session engine (`issueSessionTokenForUser`, `verifySessionToken`, `verifyAuthenticatedCaller`, `verifyAdminRequest`, `verifySuperAdminRequest`, `createAdminAuthorization`, `revokeAdminAuthorization`, `recordAdminAuditLog`, and store/product/buyer override registries).
   - **`/lib/orders-registry.ts` & `/lib/delivery-pin.ts`**: Authoritative order storage (`serverOrdersRegistry`), private 6-digit PIN vault (`serverOrderPinsVault`), PIN generation/regeneration, and public order listing sanitization (`sanitizeOrderForStorageAndListing`).
   - **`/lib/partner-applications-registry.ts` & `/lib/partner-program.ts`**: Partner application queue (`serverPartnerApplications`), approved partner profiles (`serverApprovedPartners`), referral code generation, and commission attribution logic.
   - **`/lib/stores-registry.ts`, `/lib/catalog-data.ts`, `/lib/initial-data.ts`, `/lib/nanded-demo-data.ts`**: Store tombstone tracking, 25 authoritative retail categories, initial stores/products/sellers, and Nanded 25-category demo catalog seeder (`seedNandedDemoCatalogToFirestore`).
   - **`/lib/revenue-model.ts`, `/lib/entitlements.ts`, `/lib/fees.ts`**: Subscription plans (`FREE_STARTER`, `GROWTH`, `PRO_COMMERCE`, `BUSINESS_PRO`), SKU limits, and platform fee calculations.
4. **Firestore Security Rules (`/firestore.rules`)**:
   - Production security rules enforcing strict ownership and role-based access across `users`, `stores`, `products`, `orders`, `partner_applications`, `partners`, `admin_users`, `admin_authorizations`, and `admin_audit_logs`.

---

## 2. Implemented User Roles & Authorization Model

All five user roles requested in the operational emulation are implemented in the codebase:

| # | Role Name | Role Code(s) | How Role Is Acquired | Primary Capabilities | Authorization Enforcement |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Buyer / Customer** | `buyer` (`roles: ['BUYER']`) | Default role upon mobile OTP verification (`journey: 'BUYER'`) via `POST /api/auth/otp` | Browse stores/products/categories, view average store star ratings, manage cart, place Pay-on-Delivery or UPI orders, view/regenerate 6-digit delivery PIN, cancel unfulfilled orders, submit post-delivery 1–5 star store ratings | `verifyAuthenticatedCaller()` + client/server ownership checks on `customer.phoneE164` |
| **2** | **Seller / Business Owner** | `seller` (`roles: ['BUYER', 'SELLER']`, `sellerId`) | Acquired upon Seller OTP verification (`journey: 'SELLER'`) or registering a business in `/seller` | Create/manage store profile, add/edit/bulk-upload products, generate product artwork, manage subscription plan & campaigns, progress order status (`CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `OUT_FOR_DELIVERY`), verify customer 6-digit PIN (`POST /api/orders/[id]/verify-pin`) to mark `DELIVERED`, delete own store | `verifyAuthenticatedCaller()` + `sellerId` / `ownerUid` / `phoneE164` store ownership validation |
| **3** | **Partner (City Partner / Referral Partner)** | `partner` (`PENDING` applicant vs. `ACTIVE` approved partner) | 1) Verify phone via `/partner/verify-otp` or OTP modal.<br>2) Submit application via `POST /api/partners/applications` (`PENDING`).<br>3) Approved by Admin/Super Admin via `POST /api/admin/partners` (`APPROVED`). | **Pending**: View application status or withdraw application (`PATCH /api/partners/applications`).<br>**Approved**: Access `/api/partners/dashboard`, obtain unique `referralCode` (`CKP-...`), track referred sellers/stores, view commission ledger | `verifyAuthenticatedCaller()` + caller phone matching on `/api/partners/applications` + active record check in `serverApprovedPartners` for `/api/partners/dashboard` |
| **4** | **Operational Admin** | `admin` (`isSuperAdmin: false`) | Invited exclusively by the Platform Owner Super Admin via `POST /api/admin/management` (`action: 'INVITE_ADMIN'`) | Access `/admin` console (`GET /api/admin/dashboard`), review/approve/reject/suspend Partner applications (`POST /api/admin/partners`), suspend/restore stores or buyers, unpublish/restore products, add order oversight notes, seed/remove demo data | `verifyAdminRequest()` checks active record in `serverAdminAuthorizations` (`status === 'ACTIVE'`). Blocked (`403`) from `INVITE_ADMIN`, `REVOKE_ADMIN`, and `DELETE_STORE` |
| **5** | **Super Admin (Platform Owner)** | `super_admin` (`isSuperAdmin: true`) | Strictly bound to the designated Platform Owner mobile number `+918329306616` (`isDesignatedOwnerPhone`) | All Operational Admin capabilities **plus** exclusive authority to invite, update, revoke, or reactivate Operational Admins (`/api/admin/management`), permanently delete stores (`DELETE_STORE`), and bootstrap owner sessions (`/api/admin/bootstrap`) | `verifySuperAdminRequest()` & `isDesignatedOwnerPhone('+918329306616')` |

---

## 3. Complete Route Inventory

### 3.1 Frontend App Router Pages (`/app/**/page.tsx`)

| Route Path | File Location | Access Level | Primary Purpose & Key Components |
| :--- | :--- | :--- | :--- |
| `/` | `/app/page.tsx` | Public / Buyer | Main marketplace landing page, cascading location selector, 25-category filter bar, store directory with `StoreRatingBadge`, product grid, cart drawer, and `HamburgerNavigationDrawer`. |
| `/stores/[storeId]` | `/app/stores/[storeId]/page.tsx` | Public / Buyer / Seller / Admin | Dedicated storefront page displaying store banner, verified badges, average star rating (`StoreRatingBadge`), category filter, product search, UPI QR checkout support, and owner/Super Admin delete store controls. |
| `/categories/[slug]` | `/app/categories/[slug]/page.tsx` | Public / Buyer | Category-filtered discovery page showing stores and products matching the category slug, including store rating badges. |
| `/products/[productId]` | `/app/products/[productId]/page.tsx` | Public / Buyer | Standalone product detail view with pricing, stock availability, store attribution, and add-to-cart actions. |
| `/orders` | `/app/orders/page.tsx` | Buyer (Authenticated / Local Vault) | Customer order tracking hub displaying live order status steps, 6-digit Delivery PIN display & regeneration button, order cancellation, and the post-delivery `OrderStoreRatingWidget` (`1–5 stars` + review). |
| `/seller` | `/app/seller/page.tsx` | Public Entry / Seller Workspace | Multi-tab Seller Hub: Store Onboarding & Registration, Product Catalog & Bulk CSV Upload (`SellerBulkUploadModal`), AI/Studio Artwork (`MerchantStudio`), Active Order Fulfillment Queue, 6-Digit Customer PIN Verification Modal, and Seller Plans & Billing (`SellerPlansBilling`). |
| `/partner` | `/app/partner/page.tsx` | Public / Partner Applicant / Approved Partner | City Partner Portal (`CityPartnerPortal`) with Program Overview, Earnings Calculator, OTP-gated Partner Application Form (`?tab=apply`), Application Status Tracker (`?tab=status`), and Approved Partner Referral Dashboard (`?tab=dashboard`). |
| `/partner/verify-otp` | `/app/partner/verify-otp/page.tsx` | Public / Partner Applicant | Dedicated mobile OTP verification flow (`PartnerOtpVerification`) for prospective City Partners prior to submitting an application. |
| `/admin` | `/app/admin/page.tsx` | Operational Admin & Super Admin | Unified Governance Console (`SuperAdminDashboard`, `AdminPartnerManagement`, `AdminRevenueDashboard`, `AdminLocationManager`) covering Overview KPIs, Store Moderation, Buyer Management, Product/Category Moderation, Order Oversight, Partner Applications, Subscription Plans, Platform Settings, Audit Logs, and Admin Team Governance. |
| `/pricing` | `/app/pricing/page.tsx` | Public / Seller | Subscription tier comparison (`FREE_STARTER`, `GROWTH`, `PRO_COMMERCE`, `BUSINESS_PRO`), fee calculator, and plan upgrade triggers. |
| `/how-it-works` | `/app/how-it-works/page.tsx` | Public | Step-by-step guide for buyers, sellers, and local delivery verification. |
| `/seller-guide` | `/app/seller-guide/page.tsx` | Public / Seller | Onboarding and catalog best-practices documentation for neighborhood merchants. |
| `/delivery-returns` | `/app/delivery-returns/page.tsx` | Public | Policy documentation explaining hyperlocal delivery radii, 6-digit PIN verification, and direct merchant returns. |
| `/about` | `/app/about/page.tsx` | Public | Platform mission, intra-city direct commerce model, and Nanded launch overview. |
| `/contact` | `/app/contact/page.tsx` | Public | Customer and merchant support contact channels and inquiry form. |
| `/privacy` & `/terms` | `/app/privacy/page.tsx`, `/app/terms/page.tsx` | Public | Privacy Policy and Terms of Service pages. |

---

### 3.2 Backend API Endpoints (`/app/api/**/route.ts`)

| Endpoint | HTTP Methods | Auth Requirement | Purpose |
| :--- | :---: | :--- | :--- |
| `/api/auth/otp` | `POST` | Public | Handles `REQUEST_OTP`, `VERIFY_OTP`, `COMPLETE_REGISTRATION`, and `RESOLVE_FIREBASE_USER`. Issues `ck_sess.<base64url>` session tokens and resolves roles (`buyer`, `seller`, `admin`, `super_admin`). |
| `/api/orders` | `GET`, `POST` | Public / Buyer | `GET` lists orders with raw PINs sanitized (`sanitizeOrderForStorageAndListing`). `POST` creates a new order, generates a 6-digit `deliveryPin`, and stores the authoritative PIN in `serverOrderPinsVault`. |
| `/api/orders/[orderId]/status` | `PATCH` | Seller / Admin | Advances order status (`CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `CANCELLED`). Explicitly blocks `DELIVERED` with `HTTP 400 (PIN_REQUIRED)` to enforce customer PIN verification. |
| `/api/orders/[orderId]/pin` | `GET`, `POST` | Buyer (Order Owner) | `GET` retrieves the authoritative 6-digit delivery PIN for the buyer; `POST` regenerates a new 6-digit PIN (incrementing `pinVersion`) when `orderStatus !== 'DELIVERED'`. |
| `/api/orders/[orderId]/verify-pin` | `POST` | Seller / Delivery Agent | Verifies the 6-digit PIN provided by the customer at the doorstep against `serverOrderPinsVault`. Rejects wrong PINs (`400`) and marks the order `DELIVERED` (`200`) upon match. |
| `/api/stores/[storeId]` | `GET`, `DELETE` | `GET`: Public<br>`DELETE`: Store Owner or Super Admin | `GET` returns store active/deleted/suspended status. `DELETE` verifies exact store name confirmation and caller ownership (or Super Admin), records tombstone, and preserves historical orders. |
| `/api/products/bulk-upload` | `POST` | Seller | Parses and validates bulk product CSV uploads against subscription SKU entitlements. |
| `/api/partners/applications` | `GET`, `POST`, `PATCH` | Authenticated Caller / Admin | `GET` returns caller's own applications (or all applications for Admins). `POST` submits a new `PENDING` application (blocking duplicates with `409`). `PATCH` allows applicant to `WITHDRAW` their own pending application. |
| `/api/partners/dashboard` | `GET` | Approved Partner / Admin | Returns referral code, referred stores, and commission metrics for `ACTIVE` approved partners; returns `403` for unapproved/pending callers. |
| `/api/admin/bootstrap` | `GET`, `POST` | Designated Owner (`+918329306616`) | Verifies or bootstraps the Platform Owner Super Admin record and session token; blocks non-owners with `403`. |
| `/api/admin/dashboard` | `GET` | Admin / Super Admin | Returns aggregated platform stores, products, orders, buyers, subscription plans, platform settings, audit logs, and admin authorizations. |
| `/api/admin/management` | `GET`, `POST` | `GET`: Admin/Super Admin<br>`POST`: Super Admin Only | Manages Operational Admin lifecycle: `INVITE_ADMIN`, `REVOKE_ADMIN`, `REACTIVATE_ADMIN`, and `UPDATE_ADMIN`. |
| `/api/admin/partners` | `GET`, `POST` | Admin / Super Admin | Reviews partner applications and executes `APPROVE`, `REJECT`, `MARK_UNDER_REVIEW`, `SUSPEND_PARTNER`, or `REACTIVATE_PARTNER` with audit logging. |
| `/api/admin/action` | `POST` | Admin / Super Admin | Executes audited governance actions: `SUSPEND_STORE`, `RESTORE_STORE`, `VERIFY_STORE_LOCATION`, `DELETE_STORE` (Super Admin only), `SUSPEND_BUYER`, `RESTORE_BUYER`, `UNPUBLISH_PRODUCT`, `RESTORE_PRODUCT`, `TOGGLE_CATEGORY`, `ADD_ORDER_ADMIN_NOTE`, `UPDATE_SUBSCRIPTION_PLAN`, `UPDATE_PLATFORM_SETTINGS`, `SEED_DEMO_DATA`, and `REMOVE_DEMO_DATA`. |
| `/api/billing/*` | `GET`, `POST` | Seller / Admin | Handles subscription checkout (`create-checkout`), payment verification (`verify-payment`), promotional campaigns (`campaigns`), value-added services (`services`), and fee schedules (`fees`). |
| `/api/discovery`, `/api/location`, `/api/locations` | `GET`, `POST` | Public / Admin | Provides cascading Country $\rightarrow$ State $\rightarrow$ City $\rightarrow$ Locality data and nearby store discovery. |

---

## 4. Critical Multi-Role Workflows Identified for Emulation

1. **Workflow 1 — Buyer Discovery, Checkout, 6-Digit Delivery PIN & Post-Delivery Store Rating**:
   - Buyer authenticates via mobile OTP $\rightarrow$ discovers stores displaying `StoreRatingBadge` $\rightarrow$ adds items to cart and places a Pay-on-Delivery order (`POST /api/orders`) $\rightarrow$ retrieves and regenerates the 6-digit delivery PIN (`/api/orders/[orderId]/pin`) $\rightarrow$ after seller verifies PIN and marks order `DELIVERED`, buyer submits a 1–5 star rating (`OrderStoreRatingWidget`) which updates the store's average rating across store cards and store pages.
2. **Workflow 2 — Seller Onboarding, Catalog Management & PIN-Gated Order Fulfillment**:
   - Seller registers via OTP (`journey: 'SELLER'`) $\rightarrow$ manages store & products $\rightarrow$ progresses incoming buyer order (`CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `OUT_FOR_DELIVERY`) $\rightarrow$ verifies that direct transition to `DELIVERED` without a PIN is rejected (`400 PIN_REQUIRED`) $\rightarrow$ submits customer's 6-digit PIN to `POST /api/orders/[orderId]/verify-pin` to complete delivery.
3. **Workflow 3 — Partner OTP Verification $\rightarrow$ Application Submission $\rightarrow$ Admin Approval $\rightarrow$ Partner Dashboard**:
   - Prospective partner verifies mobile number via OTP $\rightarrow$ submits City Partner application (`POST /api/partners/applications`) without authentication drop-off $\rightarrow$ verifies pre-approval access to `/api/partners/dashboard` is blocked (`403`) $\rightarrow$ Operational Admin approves application via `POST /api/admin/partners` $\rightarrow$ Approved Partner accesses `/api/partners/dashboard` (`200`) with generated `referralCode`.
4. **Workflow 4 — Super Admin vs. Operational Admin Governance & Audit Trail**:
   - Platform Owner Super Admin (`+918329306616`) invites an Operational Admin (`POST /api/admin/management`) $\rightarrow$ Operational Admin logs in, accesses `/api/admin/dashboard`, and approves partner applications, but is blocked (`403`) from `INVITE_ADMIN` and `DELETE_STORE` $\rightarrow$ Super Admin suspends/restores a store, updates subscription plans/platform settings, and revokes the Operational Admin (`REVOKE_ADMIN`), immediately terminating the revoked admin's access (`403`).
