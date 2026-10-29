# CityKart — Hamburger Menu Navigation Inventory & Information Architecture

## 1. Executive Summary of Audit & Redesign

During our inspection of the existing CityKart application (`/app/page.tsx`, `/components/urbandirect-provider.tsx`, and route pages), the original hamburger menu was implemented as a basic inline dropdown inside `/app/page.tsx` with the following UX, structural, and accessibility shortcomings:
1. **Inline Absolute Dropdown vs. True Responsive Drawer**: The previous menu rendered as a small `w-72` absolute dropdown (`role="menu"`) without a backdrop, scroll lock, focus trap, or keyboard `Escape` handling.
2. **Duplicate & Ambiguous Order Links**: Both *"My Orders (Inline View)"* and *"Order History & PINs"* appeared consecutively with identical icons and no explanation of the difference between live order tracking on the home workspace versus the full `/orders` Delivery PIN Vault.
3. **Missing Key Actions on Mobile Viewports**:
   - The **City / Location Selector** button and **For Sellers (`/seller`)** link were hidden on mobile screens (`hidden md:flex` / `hidden lg:flex`) and were absent from the hamburger menu, leaving mobile users unable to switch their city or access the Seller Registration portal after dismissing the initial prompt.
   - The **Merchant Studio Dashboard (`/seller/dashboard`)** and **Shopping Cart Drawer** were not accessible from the navigation menu.
   - **Sign Out** was only accessible from desktop header pills and missing inside the mobile menu.
4. **Unstructured Flat List**: Shopping actions, B2B merchant/partner portals, Super Admin governance, and 7 informational/legal links were stacked in a long list without collapsible disclosure for secondary legal/help items.
5. **Runtime Crash on "My Orders" Selection**: Clicking *"My Orders (Inline View)"* triggered `TypeError: Cannot read properties of undefined (reading 'name')` at `activeOrder.items.map` because `INITIAL_DEMO_ORDER` in `/components/urbandirect-provider.tsx` lacked a nested `product` object and `/app/page.tsx` accessed `item.product.name` without defensive fallback guards.

---

## 2. Complete Menu Item Inventory (Before vs. After Redesign)

| # | Menu Item Label (Redesigned) | Legacy Label / Status | Section / Grouping | Type | Destination / Action Handler | Applicable Roles |
|---|---|---|---|---|---|---|
| 1 | **Sign In / Register via OTP** | `Sign In / Verify Mobile` | Account & Identity Card | Modal Trigger (`<button>`) | Opens `MobileOtpAuthModal` (`setIsOtpAuthModalOpen(true)`) | **Guest** (Unauthenticated only) |
| 2 | **Sign Out of Session** | *(Missing in mobile menu)* | Account & Identity Card | Session Action (`<button>`) | Calls `logoutUser()` and resets session to Guest | **Authenticated Users** (Customer, Seller, Partner, Admin) |
| 3 | **Shop Local Storefront** | `Shop Home` | Shopping & Orders | View Switch (`<button>`) | Sets `viewMode = 'BUYER_HOME'`, scrolls to top (`aria-current="page"` when active) | **All Roles** |
| 4 | **My Orders & Live Tracking** | `My Orders (Inline View)` | Shopping & Orders | View Switch (`<button>`) | Sets `viewMode = 'MY_ORDERS'`, displays live order count badge (`orders.length`) | **All Roles** |
| 5 | **Order History & Delivery PINs** | `Order History & PINs` | Shopping & Orders | Route Link (`<Link>`) | Navigates to `/orders` (Full Order Vault & 4-Digit Delivery Handover PINs) | **All Roles** |
| 6 | **City: `<SelectedLocation>` (`Change`)** | *(Missing on mobile / menu)* | Shopping & Orders | Modal Trigger (`<button>`) | Opens `LocationSelectorModal` (`onOpenLocationModal()`) | **All Roles** |
| 7 | **Shopping Cart** | *(Header icon only)* | Shopping & Orders | Drawer Trigger (`<button>`) | Opens `CartCheckoutDrawer` (`onOpenCartDrawer()`), shows item count badge | **All Roles** |
| 8 | **For Sellers & Store Studio** | *(Hidden on `<1024px`, missing in menu)* | Merchants & City Partners | Route Link (`<Link>`) | Navigates to `/seller` (Zero-commission onboarding & Store Studio overview) | **All Roles** |
| 9 | **Merchant Studio Dashboard** | *(Missing in menu)* | Merchants & City Partners | Route Link (`<Link>`) | Navigates to `/seller/dashboard` (Live inventory, campaigns & order management) | **Verified Seller / Business Owner** & **Super Admin** only |
| 10 | **Merchant Plans & Pricing** | `Seller Plans & Pricing` | Merchants & City Partners | Route Link (`<Link>`) | Navigates to `/pricing` (Subscription tiers & commission comparison) | **All Roles** |
| 11 | **Become a Partner (50/50 Share)** / **City Partner Console** | `Become a Partner (50/50 Share)` | Merchants & City Partners | Route Link (`<Link>`) | Navigates to `/partner` (Label dynamically adapts to `City Partner Console` for verified partners) | **All Roles** (Dynamic label for **City Partner**) |
| 12 | **Super Admin Console** | `Super Admin Console` | Platform Governance | Route Link (`<Link>`) | Navigates to `/admin` (Platform approvals, security & OTP telemetry) | **Super Admin (`+918329306616`) ONLY** |
| 13 | **Help, Guides & Legal Policies** | *(Static flat header)* | Collapsible Disclosure | Disclosure Toggle (`<button>`) | Expands/collapses `#hamburger-support-links` (`aria-expanded` toggle) | **All Roles** |
| 14 | **How Local Shopping Works** | `How It Works` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/how-it-works` | **All Roles** |
| 15 | **How to Open a Store (Seller Guide)** | `How to Open a Store` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/seller-guide` | **All Roles** |
| 16 | **About CityKart** | `About Us` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/about` | **All Roles** |
| 17 | **Contact & Customer Support** | `Contact Us` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/contact` | **All Roles** |
| 18 | **Delivery, Tracking & Returns** | `Delivery & Returns Policy` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/delivery-returns` | **All Roles** |
| 19 | **Privacy Policy** | `Privacy Policy` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/privacy` | **All Roles** |
| 20 | **Terms & Conditions** | `Terms & Conditions` | Help, Guides & Legal (Nested) | Route Link (`<Link>`) | Navigates to `/terms` | **All Roles** |

---

## 3. Role-Based Visibility Matrix

| Menu Item / Section | Guest (Unauthenticated) | Customer (`buyer`) | Business Owner (`seller`) | City Partner (`partner`) | Super Admin (`+918329306616`) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Account Role Badge** | `Guest Shopper` | `Verified Customer` | `Verified Seller` | `City Partner (<City>)` | `Super Admin` |
| **Sign In / Register via OTP** | Visible | Hidden | Hidden | Hidden | Hidden |
| **Sign Out of Session** | Hidden | Visible | Visible | Visible | Visible |
| **Shop Local Storefront** | Visible | Visible | Visible | Visible | Visible |
| **My Orders & Live Tracking** | Visible | Visible | Visible | Visible | Visible |
| **Order History & Delivery PINs** (`/orders`) | Visible | Visible | Visible | Visible | Visible |
| **City Selector Modal Trigger** | Visible | Visible | Visible | Visible | Visible |
| **Shopping Cart Drawer Trigger** | Visible | Visible | Visible | Visible | Visible |
| **For Sellers & Store Studio** (`/seller`) | Visible | Visible | Visible | Visible | Visible |
| **Merchant Studio Dashboard** (`/seller/dashboard`) | **Hidden** | **Hidden** | **Visible** | **Hidden** | **Visible** |
| **Merchant Plans & Pricing** (`/pricing`) | Visible | Visible | Visible | Visible | Visible |
| **Partner Portal** (`/partner`) | Visible (`Become a Partner`) | Visible (`Become a Partner`) | Visible (`Become a Partner`) | Visible (`City Partner Console`) | Visible (`Become a Partner`) |
| **Super Admin Console** (`/admin`) | **Hidden** | **Hidden** | **Hidden** | **Hidden** | **Visible** |
| **Help, Guides & Legal (7 nested links)** | Visible (Collapsible) | Visible (Collapsible) | Visible (Collapsible) | Visible (Collapsible) | Visible (Collapsible) |
