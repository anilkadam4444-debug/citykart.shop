# CityKart — Role & Permission Matrix

**Audit Date**: 2026-10-28  
**Target Environment**: `http://localhost:3000`

---

## 1. Role Definitions & Assignment Mechanisms

| Role Identifier | Display Label | Assignment Mechanism | Verification Gate |
| :--- | :--- | :--- | :--- |
| `public` | Unauthenticated Visitor | Default state prior to OTP verification | Public read-only access |
| `buyer` | Customer / Buyer | Assigned upon mobile OTP verification (`journey: 'BUYER'`) via `/api/auth/otp` | `verifyAuthenticatedCaller()` (`role: 'buyer'`) |
| `seller` | Seller / Business Owner | Assigned upon Seller OTP verification (`journey: 'SELLER'`) or store creation | `verifyAuthenticatedCaller()` (`role: 'seller'`, `sellerId`) |
| `partner` (Pending) | Partner Applicant | Submits application via `POST /api/partners/applications` (`status: 'PENDING'`) | `verifyAuthenticatedCaller()` + `serverPartnerApplications` |
| `partner` (Approved) | Approved City Partner | Approved by Admin/Super Admin via `POST /api/admin/partners` (`action: 'APPROVE'`) | `serverApprovedPartners.get(phoneE164)` (`status: 'ACTIVE'`) |
| `admin` | Operational Admin | Invited by Super Admin via `POST /api/admin/management` (`INVITE_ADMIN`) | `verifyAdminRequest()` (`authorized: true`, `isSuperAdmin: false`) |
| `super_admin` | Platform Owner Super Admin | Strictly bound to designated owner phone (`+918329306616` / `+919888888888`) | `verifySuperAdminRequest()` (`authorized: true`, `isSuperAdmin: true`) |

---

## 2. Endpoint & Feature Permission Matrix

| Feature / Endpoint | Public | Buyer | Seller | Partner (Pending) | Partner (Approved) | Operational Admin | Super Admin (`+918329306616`) | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Browse Marketplace & Store Star Ratings** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | **PASS** |
| **Mobile OTP Auth (`POST /api/auth/otp`)** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | **PASS** |
| **Place Order (`POST /api/orders`)** | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | **PASS** |
| **Retrieve/Regenerate 6-Digit Delivery PIN (`/api/orders/[id]/pin`)** | DENY | OWN ONLY | DENY | DENY | DENY | DENY (Masked) | DENY (Masked) | **PASS** |
| **Submit Post-Delivery Store Star Rating** | DENY | OWN (`DELIVERED`) | DENY | DENY | DENY | DENY | DENY | **PASS** |
| **Progress Order Status (`CONFIRMED`..`OUT_FOR_DELIVERY`)** | DENY | DENY | OWN STORE | DENY | DENY | ALLOW | ALLOW | **PASS** |
| **Mark `DELIVERED` Without PIN (`PATCH /status`)** | DENY (`400`) | DENY (`400`) | DENY (`400 PIN_REQUIRED`) | DENY (`400`) | DENY (`400`) | DENY (`400`) | DENY (`400`) | **PASS** |
| **Complete Delivery With 6-Digit PIN (`/verify-pin`)** | DENY | DENY | ALLOW (Valid PIN) | DENY | DENY | ALLOW (Valid PIN) | ALLOW (Valid PIN) | **PASS** |
| **Delete Store (`DELETE /api/stores/[storeId]`)** | DENY (`401`) | DENY (`403`) | OWN STORE ONLY | DENY (`403`) | DENY (`403`) | DENY (`403`) | ALLOW (Confirmed) | **PASS** |
| **Submit Partner Application (`POST /api/partners/applications`)** | DENY (`401`) | ALLOW | ALLOW | DENY (`409`) | DENY (`409`) | ALLOW | ALLOW | **PASS** |
| **View/Withdraw Partner Application (`/api/partners/applications`)** | DENY | OWN ONLY | OWN ONLY | OWN ONLY | OWN ONLY | ALLOW (All) | ALLOW (All) | **PASS** |
| **Approved Partner Dashboard (`GET /api/partners/dashboard`)** | DENY (`401`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | OWN ONLY (`200`) | ALLOW | ALLOW | **PASS** |
| **Approve/Reject Partner (`POST /api/admin/partners`)** | DENY (`401`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | ALLOW (`200`) | ALLOW (`200`) | **PASS** |
| **Admin Dashboard (`GET /api/admin/dashboard`)** | DENY (`401`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | ALLOW | ALLOW | **PASS** |
| **Suspend/Restore Store or Buyer (`POST /api/admin/action`)** | DENY (`401`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | ALLOW | ALLOW | **PASS** |
| **Invite/Revoke Admins (`POST /api/admin/management`)** | DENY (`401`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | ALLOW (`200`) | **PASS** |
| **Bootstrap Super Admin (`POST /api/admin/bootstrap`)** | DENY (`401`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | DENY (`403`) | ALLOW (Owner Only) | **PASS** |
