# CityKart — Complete Mobile UI/UX Layout Audit & Optimization Report

**Application**: CityKart (`CityKart.shop`) — Direct Seller-to-Buyer Hyperlocal Marketplace  
**Framework**: Next.js 15.1.0 (App Router) + React 19 + Tailwind CSS v4 + Motion + Firebase 13.1.0  
**Target Viewports Audited**: `320px` (Narrow Mobile), `360px` & `375px` (Smartphones), `390px` & `430px` (Large Smartphones), `600px–768px` (Tablets), `1024px` (Small Laptops/Tablets Landscape), `1280px+` (Desktop)

---

## 1. Executive Summary

A full repository-wide mobile-first UI/UX audit and implementation pass was conducted across every route, role dashboard, modal, drawer, and interactive workflow in CityKart. Rather than merely shrinking desktop interfaces, components were restructured for small screens (`320px–430px`) first and scaled up cleanly across tablet (`600px–768px`) and desktop (`1024px–1280px+`) breakpoints.

### Key Systemic Improvements Implemented
1. **Viewport & Overflow Protection (`/app/layout.tsx`, `/app/globals.css`)**:
   - Added explicit Next.js `Viewport` configuration (`width: 'device-width'`, `initialScale: 1`, `maximumScale: 5`, `viewportFit: 'cover'`, `themeColor: '#003B8E'`).
   - Added global `html, body { max-width: 100%; overflow-x: clip; -webkit-text-size-adjust: 100%; }` and `.no-scrollbar` / `.pb-safe` utilities.
2. **Touch Target Ergonomics (`>= 40px–44px`)**:
   - Upgraded interactive header triggers, modal close buttons, drawer controls, filter pills, and form submission buttons to enforce `min-h-[40px]` to `min-h-[44px]` and `min-w-[44px]` tap targets.
3. **320px Narrow Screen Resilience**:
   - Changed storefront product grids from rigid `grid-cols-2` (`~137px` per card on `320px` screens, which crushed price and `Add` buttons) to `grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`.
   - Optimized the sticky storefront top navigation bar so Row 1 (`Menu + Brand + Location Pill + Cart`) fits cleanly at `320px` without awkward 3-row wrapping.
4. **Virtual Keyboard & Small-Height Viewport Safety (`max-h-[92dvh]`)**:
   - Converted fixed modals (`MobileOtpAuthModal`, `LocationSelectorModal`, `ProductDetailModal`) to `max-h-[92dvh] flex flex-col overflow-hidden my-auto` with `overflow-y-auto overscroll-contain flex-1` bodies so mobile virtual keyboards never obscure primary inputs or action buttons.
5. **Multi-Role Dashboard Mobile Ergonomics**:
   - **Hamburger Navigation Drawer**: Fixed Operational Admin (`role === 'admin'`) visibility for `/admin` and `/seller/dashboard` links alongside Super Admin (`+918329306616`), and added `truncate` / `flex-wrap` protection for `320px` screens (`w-[92vw]`).
   - **Seller Studio (`/seller`, `/seller/dashboard`)**: Constrained the store switcher `<select>` (`w-full sm:w-auto max-w-full min-w-0 truncate`) to eliminate horizontal page overflow and exposed the `+ Add product` and `Bulk Upload` actions directly on mobile viewports (previously `hidden lg:block`).
   - **Partner Portal (`/partner`)**: Changed the 3-step OTP verification progress bar from `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` so step badges never clip at `320px–375px`.
   - **Admin & Super Admin Console (`/admin`)**: Replaced the tall vertical stacked mobile navigation list with a compact `lg:hidden` horizontally scrollable single-row section strip (`min-h-[40px]`, `no-scrollbar`), and constrained the global search input (`w-full sm:w-72`) and results popover (`w-[calc(100vw-2rem)] max-w-sm sm:w-96`).

---

## 2. Route & Component Mobile Layout Audit Matrix

| Route / Component | File Path | Audited Viewports | Pre-Optimization Defect Identified | Optimization Implemented | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Root Layout & Global CSS** | `/app/layout.tsx`, `/app/globals.css` | `320px` – `1280px+` | Missing explicit `Viewport` export (`viewportFit: 'cover'`) and global horizontal overflow clip safeguard. | Added Next.js `Viewport` export and `overflow-x: clip`, `.no-scrollbar`, and `.pb-safe` rules in `globals.css`. | **Fixed & Verified** |
| **Hamburger Navigation Drawer** | `/components/hamburger-navigation-drawer.tsx` | `320px` – `1280px+` | 1. Operational Admin (`role === 'admin'`) could not see `/admin` or `/seller/dashboard` links (gated only on `isSuperAdmin`).<br>2. Account badge and phone string risked clipping on `320px` (`92vw = 294px`). | 1. Added `isOperationalAdmin` and `isAdminOrSuperAdmin` role checks.<br>2. Added `px-3.5 sm:px-4`, `overscroll-contain`, `flex-wrap`, and `truncate max-w-[140px] sm:max-w-[180px]` on identity labels. | **Fixed & Verified** |
| **Buyer Storefront Header** | `/app/page.tsx` | `320px`, `360px`, `375px`, `390px`, `430px`, `768px`, `1280px` | At `320px`, Menu button text + `CityKart.shop` + Location pill + Cart button overflowed Row 1 into 3 uneven rows; touch targets were `36px`. | Enforced `min-h-[44px]` touch targets; made Menu text label `hidden min-[360px]:inline`, `.shop` suffix `hidden min-[380px]:inline`, and Location pill `max-w-[112px] min-[375px]:max-w-[145px] sm:max-w-[220px]`. | **Fixed & Verified** |
| **Buyer Product Grids & Cards** | `/app/page.tsx` | `320px` – `1280px+` | `grid-cols-2` at `320px` left `~137px` per card, squeezing `₹` price and `+ Add` / quantity stepper buttons. | Changed to `grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`; added `flex-wrap` and `min-h-[38px]` to card action buttons. | **Fixed & Verified** |
| **Mobile OTP Auth Modal** | `/components/mobile-otp-auth-modal.tsx` | `320px` – `768px` (Portrait & Landscape) | Modal lacked `max-h-[92dvh]` internal scroll container, risking input/CTA occlusion when virtual keyboard opens; close button was `< 44px`. | Added `max-h-[92dvh] flex flex-col overflow-hidden my-auto`, `overflow-y-auto overscroll-contain flex-1` body, and `min-w-[44px] min-h-[44px]` close button. | **Fixed & Verified** |
| **Location Selector Modal** | `/components/location-selector-modal.tsx` | `320px` – `768px` | Modal body could exceed short landscape/keyboard viewports; close button was `< 44px`. | Added `max-h-[92dvh] flex flex-col overflow-hidden my-auto`, `flex-1 overflow-y-auto overscroll-contain` body, and `min-w-[44px] min-h-[44px]` close button. | **Fixed & Verified** |
| **Cart & Checkout Drawer** | `/components/cart-checkout-drawer.tsx` | `320px` – `1280px+` | Header padding (`px-6`) and back/close buttons (`p-2`) were tight on `320px` when store names were long. | Updated header to `px-4 sm:px-6`, added `min-w-[44px] min-h-[44px]` on Back/Close buttons, and `truncate` on store subtitle. | **Fixed & Verified** |
| **Product Detail Modal** | `/components/product-detail-modal.tsx` | `320px` – `1280px+` | 2-column product detail modal lacked `max-h-[92dvh]` scroll wrapper on mobile screens, clipping bottom store details or reviews. | Wrapped modal in `max-h-[92dvh] flex flex-col overflow-hidden my-auto` with `overflow-y-auto overscroll-contain flex-1` content region and `min-h-[44px] min-w-[44px]` close button. | **Fixed & Verified** |
| **Buyer Orders & Delivery PIN** | `/app/orders/page.tsx` | `320px` – `1280px+` | Back button was `p-2` (`< 44px`); SMS PIN notification preview box needed word-break safeguards on `320px`. | Enforced `min-w-[44px] min-h-[44px]` back button, `min-h-[40px]` filter tabs (`no-scrollbar`), and `break-words overflow-hidden` on the 6-digit PIN SMS card. | **Fixed & Verified** |
| **Seller Dashboard & Studio** | `/components/merchant-studio.tsx` (`/seller`, `/seller/dashboard`) | `320px` – `1280px+` | 1. Top store switcher `<select>` had unconstrained width on long store names.<br>2. `+ Add product` and `Bulk Upload` buttons were inside `hidden lg:block`, hiding primary seller actions on mobile. | 1. Constrained `<select>` with `w-full sm:w-auto max-w-full min-w-0 min-h-[40px] truncate`.<br>2. Exposed `+ Add product` & `Bulk Upload` in a responsive `grid grid-cols-2 lg:grid-cols-1 gap-2` bar on mobile. | **Fixed & Verified** |
| **Partner Onboarding & Portal** | `/components/partner-otp-verification.tsx`, `/components/partner-portal.tsx` | `320px` – `1280px+` | 3-step OTP progress bar used fixed `grid-cols-3`, cramping step titles on `320px–375px` viewports. | Changed progress indicator to `grid-cols-1 sm:grid-cols-3 gap-2` with `truncate` labels. | **Fixed & Verified** |
| **Admin & Super Admin Console** | `/components/super-admin-dashboard.tsx` (`/admin`) | `320px` – `1280px+` | 1. Mobile sidebar rendered a tall vertical stack pushing dashboard content far below the fold.<br>2. Search bar (`sm:w-80`) and dropdown (`w-96`) overflowed `320px` viewports. | 1. Added compact `lg:hidden` horizontal scrollable pill bar (`min-h-[40px]`, `no-scrollbar`) while preserving desktop sidebar (`hidden lg:block`).<br>2. Constrained search input (`w-full sm:w-72`) and dropdown (`w-[calc(100vw-2rem)] max-w-sm sm:w-96`). | **Fixed & Verified** |
| **Discovery, Support & Legal Pages** | `/app/categories`, `/app/stores`, `/app/products`, `/app/how-it-works`, `/app/pricing`, `/app/seller-guide`, `/app/delivery-returns`, `/app/about`, `/app/contact`, `/app/terms`, `/app/privacy` | `320px` – `1280px+` | Audited for typography scale, padding (`px-4 sm:px-6`), card grids, and back navigation touch targets. | Responsive container widths (`max-w-4xl`/`max-w-7xl mx-auto px-4 sm:px-6`) and readable mobile line heights verified across all 11 discovery/support/legal routes. | **Verified Clean** |
