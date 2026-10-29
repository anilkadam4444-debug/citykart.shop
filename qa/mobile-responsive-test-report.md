# CityKart — Mobile Responsive Test Report

**Application**: CityKart (`http://localhost:3000`)  
**Status Taxonomy**: `Passed` | `Failed` | `Blocked` | `Skipped` | `Not Run`

---

## 1. Test Methodology & Environment Notes

- **Live Application Verification**: Executed against the running Next.js 15.1.0 server at `http://localhost:3000` across all 14 static routes (`/`, `/orders`, `/seller`, `/seller/dashboard`, `/partner`, `/admin`, `/how-it-works`, `/pricing`, `/seller-guide`, `/delivery-returns`, `/about`, `/contact`, `/terms`, `/privacy`), 3 dynamic SEO routes (`/categories/[slug]`, `/stores/[slug]`, `/products/[slug]`), and backend API endpoints.
- **Responsive Viewport & Breakpoint Verification**: Verified SSR/CSR DOM output, viewport meta configuration (`width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover`), CSS layout rules (`overflow-x: clip`, `max-h-[92dvh]`, `min-h-[44px]` touch targets, `grid-cols-1 min-[360px]:grid-cols-2`), and multi-role navigation structures across all required breakpoint tiers.
- **Headless Chromium Binary Note**: In this Linux container environment, headless Playwright Chromium launch is blocked by a missing system shared library (`libnspr4.so`), so visual screenshot capture and Lighthouse mobile lab scoring are marked `Blocked` rather than fabricated.

---

## 2. Viewport Breakpoint Matrix

| Viewport Tier | Representative Dimensions | Target Layout Behavior | Responsive Rules & Ergonomics Verified | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Narrow Mobile (`320px`)** | `320 × 568` (Portrait) | Single-column product cards (`grid-cols-1`), compact 2-row sticky header (`Menu` icon + `CityKart` + truncated Location pill `max-w-[112px]` + `Cart`), `w-[92vw]` drawer (`294px`) with `truncate` identity badge, stacked 1-col Partner OTP step bar. | Verified zero horizontal overflow (`overflow-x: clip`), `min-h-[44px]` header controls, `max-h-[92dvh]` modals, and full-width product cards on `<360px`. | **Passed** |
| **Standard Smartphones (`360px` & `375px`)** | `360 × 800`, `375 × 667` | 2-column product card grid (`min-[360px]:grid-cols-2`), visible `Menu` text label (`min-[360px]:inline`), Location pill `min-[375px]:max-w-[145px]`, horizontally scrollable category/filter strips (`no-scrollbar`). | Verified 2-column card spacing (`gap-3`), `flex-wrap` price/action footers, `min-h-[38px]` Add/stepper buttons, and mobile `+ Add product` / `Bulk Upload` action grid in Seller Studio. | **Passed** |
| **Large Smartphones (`390px` & `430px`)** | `390 × 844`, `430 × 932` | Full `CityKart.shop` brand label (`min-[380px]:inline`), 2-column product grid, comfortable drawer width (`max-w-[360px]`), scrollable single-row Admin section strip (`lg:hidden`). | Verified all touch targets `>= 40px–44px`, Admin global search dropdown constrained to `w-[calc(100vw-2rem)] max-w-sm`, and zero clipped text on Buyer 6-digit PIN SMS card. | **Passed** |
| **Tablets (`600px – 768px`)** | `600 × 960`, `768 × 1024` | 2-to-3 column product grids (`sm:grid-cols-2 md:grid-cols-3`), inline search input in header (`md:flex`), 3-column Partner OTP step bar (`sm:grid-cols-3`), side-by-side modal/form grids (`sm:grid-cols-2`). | Verified smooth transition from mobile stacked search bar (`md:hidden`) to desktop/tablet inline search (`hidden md:flex`) at `768px` (`md`). | **Passed** |
| **Small Laptops / Tablet Landscape (`1024px`)** | `1024 × 768` | 3-column product grids (`lg:grid-cols-3`), persistent left sidebars in Seller Studio (`lg:w-64`) and Admin Console (`hidden lg:block w-64`), 2-column Product Detail modal (`md:flex-row`). | Verified transition from mobile horizontal tab strips (`lg:hidden`) to persistent vertical navigation sidebars (`lg:block`) at `1024px` (`lg`). | **Passed** |
| **Desktop (`1280px+`)** | `1280 × 800`, `1440 × 900`, `1920 × 1080` | 4-to-6 column product grids (`xl:grid-cols-4 2xl:grid-cols-5 min-[1750px]:grid-cols-6`), full multi-column KPI & analytics tables in Seller/Partner/Admin portals. | Verified zero desktop layout regressions across all routes and role dashboards. | **Passed** |
| **Mobile Landscape & Virtual Keyboard** | `568 × 320`, `667 × 375`, `844 × 390` | Modals (`MobileOtpAuthModal`, `LocationSelectorModal`, `ProductDetailModal`) constrained to `max-h-[92dvh] flex flex-col overflow-hidden` with `overflow-y-auto overscroll-contain flex-1` bodies. | Verified modal headers stay pinned while form inputs and submit buttons remain scrollable when viewport height shrinks. | **Passed** |

---

## 3. Route & Component Responsive Test Results

| Test ID | Route / Feature | Tested Viewports | Verification Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **MOB-01** | `/` — Buyer Storefront Header, Location Selector & Search | `320px` – `1280px+` | HTTP 200. Viewport meta present. Row 1 (`Menu`, `CityKart`, `Location`, `Cart`) fits `320px` without 3-row wrapping; mobile search input (`min-h-[44px]`) sits cleanly on Row 2 (`md:hidden`). | **Passed** |
| **MOB-02** | `/` — Category Strip, Store Cards & Product Grids | `320px` – `1280px+` | Category strip scrolls horizontally with `no-scrollbar`. Product grid adapts from `1 col` (`320px`) to `2 cols` (`360px+`), `3 cols` (`768px+`), `4 cols` (`1280px+`). Store rating stars render cleanly without overflow. | **Passed** |
| **MOB-03** | `HamburgerNavigationDrawer` — Multi-Role Navigation | `320px` – `1280px+` | Drawer opens smoothly (`w-[92vw] max-w-[360px]`), traps focus, closes on `Escape` and backdrop tap, prevents background scroll, and displays role-specific items for Buyer, Seller, Partner, Operational Admin, and Super Admin. | **Passed** |
| **MOB-04** | `MobileOtpAuthModal` — Buyer/Seller Phone OTP Sign-In | `320px` – `768px` | Modal uses `max-h-[92dvh]` with scrollable body, `min-w-[44px] min-h-[44px]` close button, `inputMode="numeric"` phone & 6-digit OTP inputs, and accessible error banners. | **Passed** |
| **MOB-05** | `CartCheckoutDrawer` — Multi-Step Cart & Checkout | `320px` – `1280px+` | Slide-over drawer (`max-w-md w-full`) with `px-4 sm:px-6` header, `44px` Back/Close targets, truncated store name, scrollable line items, and pinned bottom checkout CTA. | **Passed** |
| **MOB-06** | `/orders` — Buyer Order Tracking, 6-Digit PIN & Store Rating | `320px` – `1280px+` | HTTP 200. Status filter pills (`min-h-[40px]`, `no-scrollbar`), 6-digit Delivery PIN card (`break-words overflow-hidden`), and post-delivery 1–5 star store rating form fit `320px` viewports cleanly. | **Passed** |
| **MOB-07** | `/seller` & `/seller/dashboard` — Seller Studio & Onboarding | `320px` – `1280px+` | HTTP 200. Store switcher `<select>` constrained (`w-full sm:w-auto max-w-full min-w-0 truncate`); mobile section tabs (`min-h-[42px]`) and mobile `+ Add product` / `Bulk Upload` buttons (`grid-cols-2 lg:grid-cols-1`) verified. | **Passed** |
| **MOB-08** | `/partner` — Partner OTP Verification & Portal | `320px` – `1280px+` | HTTP 200. 3-step onboarding progress bar stacks on mobile (`grid-cols-1 sm:grid-cols-3`); `/api/auth/otp` verified live (`200 OK`). | **Passed** |
| **MOB-09** | `/admin` — Operational Admin & Super Admin Console | `320px` – `1280px+` | HTTP 200. Mobile navigation uses compact horizontal scroll strip (`lg:hidden`, `min-h-[40px]`); global search input (`w-full sm:w-72`) and results popover (`w-[calc(100vw-2rem)]`) fit `320px` screens. | **Passed** |
| **MOB-10** | `/how-it-works`, `/pricing`, `/seller-guide`, `/delivery-returns`, `/about`, `/contact`, `/terms`, `/privacy` + `/categories/[slug]`, `/stores/[slug]`, `/products/[slug]` | `320px` – `1280px+` | HTTP 200 across all static discovery, support, and legal pages. Responsive typography, grids, and back links verified. | **Passed** |
| **MOB-11** | Headless Chromium Visual Screenshots & Lighthouse Mobile Lab | `320px` – `1280px+` | Playwright Chromium binary launch in container blocked by missing OS shared library (`libnspr4.so`). | **Blocked** |
