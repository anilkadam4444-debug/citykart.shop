# CityKart — Security & Data Integrity Report

**Audit Date**: 2026-10-28  
**Target Environment**: `http://localhost:3000`

---

## 1. Remediated Security & Data Integrity Defects

| ID | Severity | File(s) | Issue Description | Fix & Verification |
| :--- | :---: | :--- | :--- | :--- |
| **SEC-001** | **CRITICAL** | `/app/api/admin/bootstrap/route.ts` | `POST /api/admin/bootstrap` previously had `const isOwner = true;` allowing any caller to obtain a Super Admin session. | Enforced `verifyAuthenticatedCaller(req)` + `isDesignatedOwnerPhone(caller.phoneE164)`. Non-owners receive `HTTP 403`. |
| **SEC-002** | **CRITICAL** | `/lib/super-admin-auth.ts` | `issueSessionTokenForUser()` returned `'mock_session_token_' + Date.now()` and `verifyAdminRequest()` omitted `authorized`, `firebaseUid`, and `status`. | Implemented structured `ck_sess.<base64url>` tokens backed by `serverSessionTokens` and full `ACTIVE`/`REVOKED` checks against `serverAdminAuthorizations`. |
| **SEC-003** | **HIGH** | `/app/api/auth/otp/route.ts` | `COMPLETE_REGISTRATION` allowed arbitrary `role` in request body and failed if `phoneE164` was omitted when `verificationToken` was provided. | Restricted self-registration to `buyer`/`seller` (unless phone matches designated owner or invited admin) and resolved `phoneE164` from `verifiedTokens.get(verificationToken)`. |
| **SEC-004** | **HIGH** | `/app/api/partners/applications/route.ts`, `/app/api/partners/dashboard/route.ts` | `GET /api/partners/applications` leaked all applications to non-admins, `WITHDRAW` lacked caller ownership check, and `GET /api/partners/dashboard` auto-created demo profiles for unapproved callers. | Filtered `GET /api/partners/applications` to caller's own phone for non-admins, enforced caller ownership on `WITHDRAW` (`HTTP 403`), and enforced approved partner check (`HTTP 403` pre-approval) on `GET /api/partners/dashboard`. |
| **SEC-005** | **HIGH** | `/lib/orders-registry.ts`, `/app/api/orders/[orderId]/pin/route.ts`, `/app/api/orders/[orderId]/verify-pin/route.ts` | Stripping `deliveryPin` in `sanitizeOrderForStorageAndListing()` erased the server's copy of the PIN needed by `verify-pin`, and `/pin` lacked a `GET` handler. | Added `serverOrderPinsVault` in `/lib/orders-registry.ts` and `GET /api/orders/[orderId]/pin` while keeping raw PINs stripped from public `GET /api/orders` listings. |
| **SEC-006** | **MEDIUM** | `/lib/firebase.ts`, `/lib/stores-registry.ts`, `/app/api/admin/*`, `/app/api/stores/[storeId]/route.ts`, `/lib/seeders.ts` | Dummy preview Firebase project (`ai-studio-urbandirectgloba-...`) triggered `@firebase/firestore` gRPC `Listen` stream `Code: 7 PERMISSION_DENIED` errors. | Added `IS_PREVIEW_DUMMY_FIREBASE` guard and `setLogLevel('silent')` in `/lib/firebase.ts` and bypassed dummy network calls in preview mode. |

---

## 2. Firestore Security Rules Verification (`/firestore.rules`)

- **Zero Open Wildcards**: Verified no `allow read, write: if true;` exists in `/firestore.rules`.
- **Strict Role Hierarchy**: `isSuperAdmin()` is bound to `+918329306616` or `admin_users` with `role == 'super_admin'`; `isOperationalAdmin()` checks active `admin_users` / `admin_authorizations`.
- **Collection Isolation**: `users`, `stores`, `products`, `orders`, `partner_applications`, `partners`, `admin_authorizations`, and `admin_audit_logs` enforce ownership and admin privilege checks.
