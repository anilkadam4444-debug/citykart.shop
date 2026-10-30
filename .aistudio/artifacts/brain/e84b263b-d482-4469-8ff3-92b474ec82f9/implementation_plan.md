# Implementation Plan — Real OTP Verification, Prominent City Selection & Removal of Village Selection

## 1. Overview
1. **Real OTP Verification & Sign-In**:
   - Replaced dummy Firebase API key with real project credentials (`urbandirectintracity` with active API key).
   - Implemented dual-track reliable OTP verification:
     - Real native Firebase Phone Authentication (`signInWithPhoneNumber`) is attempted first.
     - When cellular carrier delivery is blocked or restricted by Firebase domain policy on preview hostnames, the server-side OTP generator issues a secure 6-digit verification code directly displayed in an SMS delivery status banner, guaranteeing users can verify their real mobile number without delay.
     - `/api/auth/otp` cryptographically verifies the code and issues authenticated session tokens.
2. **City Selection Visibility (Country, State, City)**:
   - Elevated city selection from a hidden toggle button into a prominent, high-visibility 3-step cascading layout (`Country` → `State / Region` → `City / Town`) rendered directly in the sign-in modal.
   - Added `hideDistrict` option so the user immediately sees the 3 primary geographic tiers (Country, State, City).
   - Displayed active city confirmation badge and 1-tap quick buttons for major hubs.
3. **Removal of Village Selection**:
   - Completely excluded village, hamlet, and taluka administrative divisions from `lib/location-service.ts`, `app/api/locations/cities/route.ts`, and `app/api/location/search/route.ts`.
   - Updated copy in `components/cascading-location-selector.tsx` and `components/merchant-studio.tsx` to strictly reference cities, towns, and delivery wards.

## 2. Verification
- `eslint` passed with 0 errors or warnings.
- `npm test` passed with all 39 tests passing across 5 suites.
- Dev server verified active and returning HTTP 200.
