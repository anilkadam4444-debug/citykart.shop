# Implementation Report — Mandatory Seller Subscription Selection & Marketplace Publication Gate

## 1. Executive Summary
This production update resolves:
1. **Firebase App Hosting Build Error**: Re-synchronized `package-lock.json` with `package.json` dependencies via `npm install --package-lock-only`, passing `npm ci` validation cleanly.
2. **Payment Gateway Sandbox Remediation**: Permanently removed the fake sandbox fallback that was granting auto-activated paid subscriptions without payment. Paid tiers now strictly require live Razorpay credentials (`RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`) and server-side HMAC-SHA256 signature verification.
3. **Mandatory Step 7 Onboarding**: Added "Choose Your CityKart Business Plan" as the final step of the store registration wizard. Sellers cannot publish their store without activating a plan.
4. **Marketplace Publication Gate**: Enforced multi-layered gates in `/api/discovery`, `/api/stores`, `/api/products`, `/stores/[storeId]`, and `/api/orders` so that unpublished, unsubscribed, or suspended stores are strictly excluded from public discovery, search results, and order creation.

---

## 2. Core Architecture & Changes

### A. Step 7 Subscription Wizard (`components/merchant-studio.tsx`)
- Updated wizard progression from 6 steps to 7 steps (`Step {onboardingStep} of 7`).
- Implemented Step 7 UI with:
  - Commercial activation header and benefit breakdown.
  - Monthly vs Annual billing toggle with 15% discount badge.
  - Authoritative plan selection cards:
    - **Free** (₹0/mo, 50 SKUs, instant publication).
    - **Starter** (₹999/mo, 250 SKUs, priority search).
    - **Growth** (₹2,499/mo, 1,000 SKUs, popular badge, featured listings).
    - **Business Pro** (₹4,999/mo, unlimited SKUs, top placement).
  - Primary activation CTAs:
    - Free Plan: Direct activation & immediate publication.
    - Paid Plans: Initiates real Razorpay checkout modal and verifies HMAC signature on server.
  - "Skip for now" secondary option that creates the store in `status: 'pending_subscription'` (`isPublished: false`).
- Added persistent amber dashboard alert banner for unpublished/unsubscribed stores with a 1-click CTA to activate a plan.

### B. Live Razorpay Gateway & Signature Verification
- **Removed Fake Sandbox Auto-Activation** in `app/api/billing/create-checkout/route.ts`:
  - When Razorpay keys are placeholders or unconfigured, the endpoint returns HTTP 501 `needsConfig: true` without granting free access to paid plans.
  - When keys are present, real Razorpay orders are created with server-calculated amounts, receipts, and GST.
- **HMAC SHA-256 Server Verification** in `app/api/billing/verify-payment/route.ts`:
  - Cryptographically verifies `razorpay_signature` using `crypto.createHmac('sha256', secret)`.
  - On valid verification: marks subscription as `ACTIVE`, sets store `status: 'active'`, `isPublished: true`, and clears discovery cache.
  - Blocks cross-tenant mutations with HTTP 403.

### C. Universal Publication Gates
- **`lib/catalog-data.ts`**:
  - Defined `StorePublicationStatus`: `'draft' | 'onboarding_incomplete' | 'pending_subscription' | 'payment_pending' | 'pending_approval' | 'active' | 'suspended' | 'expired' | 'rejected'`.
  - Implemented `isStorePublishedAndActive(store: LocalStore)` enforcing active status, non-expired subscription, complete location, and `isPublished: true`.
  - Updated `isStoreEligibleForSelectedCity` and `queryCityScopedCatalog` to filter strictly using `isStorePublishedAndActive`.
- **`app/api/discovery/route.ts`**:
  - Filters `eligibleStores` with `isStorePublishedAndActive(s)`.
  - Only products belonging to active published stores are discoverable.
- **`app/stores/[storeId]/page.tsx` & `app/products/[productId]/page.tsx`**:
  - Direct URLs trigger `notFound()` if the store is not published and active.
- **`app/api/orders/route.ts`**:
  - Rejects customer orders with HTTP 403 if the target store is not active and published.

---

## 3. Automated Verification Results
Executed `node --test scripts/seller-subscription-publication.test.mjs`:
- **Test 1 (Step 0)**: Authenticate new seller via OTP & complete registration — **PASS**
- **Test 2 (Scenario B)**: Store created with skipped plan defaults to `pending_subscription` & omitted from discovery — **PASS**
- **Test 3 (Scenario C)**: Paid plan checkout enforces live gateway and rejects fake auto-activation — **PASS**
- **Test 4 (Scenario D)**: Fake payment callback with forged HMAC signature is rejected — **PASS**
- **Test 5 (Scenario A)**: Free plan activation successfully publishes store and makes it discoverable — **PASS**
- **Test 6 (Scenario G)**: Unauthorized mutation of another seller store is rejected with HTTP 403 — **PASS**
- **Test 7 (Scenario I)**: Products from unpublished store excluded from public discovery — **PASS**
- **Test 8 (Scenario J)**: Orders on unpublished/suspended store rejected with HTTP 403 — **PASS**
- **Test 9 (Scenario E)**: Expired subscription store omitted from public discovery — **PASS**
- **Test 10 (Scenario F)**: Subscription renewal reactivates and republishes store — **PASS**
- **Test 11 (Scenario H)**: Direct route 404 guard for unpublished stores — **PASS**

### Code Health
- `eslint`: 0 errors, 0 warnings.
- `package-lock.json`: Synchronized for Firebase App Hosting deployment (`npm ci` verified).
