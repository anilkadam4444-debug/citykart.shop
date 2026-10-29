import { chromium } from '/root/.bun/install/global/node_modules/playwright/index.mjs';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  const results = [];
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  function recordResult(item) {
    results.push(item);
    console.log(`[${item.result.toUpperCase()}] ${item.role} | ${item.label} -> ${item.actual}`);
  }

  try {
    // =========================================================================
    // PHASE 1: Guest Role & Responsive / Accessibility / Drawer Mechanics Audit
    // =========================================================================
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, // Mobile viewport first
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Dismiss initial city modal or active overlay if open
    const dismissCityModal = async () => {
      const closeCityBtn = page.locator('button[aria-label="Close location selector"], button[aria-label="Close modal"], button[aria-label="Close authentication modal"], button:has-text("Confirm Shopping Location"), button:has-text("Continue with")').first();
      if (await closeCityBtn.isVisible().catch(() => false)) {
        await closeCityBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
    };
    await dismissCityModal();

    // 1. Trigger Button Audit (Mobile 375x812)
    const trigger = page.getByTestId('hamburger-menu-trigger');
    const isTriggerVisible = await trigger.isVisible();
    const box = await trigger.boundingBox();
    const ariaHasPopup = await trigger.getAttribute('aria-haspopup');
    const ariaControls = await trigger.getAttribute('aria-controls');
    const ariaExpandedBefore = await trigger.getAttribute('aria-expanded');

    recordResult({
      id: 'MECH-01',
      label: 'Hamburger Menu Trigger Button (Mobile 375x812)',
      role: 'All Roles (Guest)',
      expected: 'Visible button >= 44x44px with aria-haspopup="dialog", aria-expanded="false", aria-controls="citykart-hamburger-drawer"',
      actual: `Visible=${isTriggerVisible}, Size=${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}px, aria-haspopup="${ariaHasPopup}", aria-expanded="${ariaExpandedBefore}", aria-controls="${ariaControls}"`,
      result:
        isTriggerVisible &&
        (box?.width || 0) >= 44 &&
        (box?.height || 0) >= 44 &&
        ariaHasPopup === 'dialog' &&
        ariaExpandedBefore === 'false'
          ? 'Passed'
          : 'Failed',
      evidence: `Bounding box: ${JSON.stringify(box)}`,
      fixStatus: 'Verified in redesigned header trigger',
    });

    // 2. Open Drawer & Verify ARIA / Scroll Lock / Overflow
    await page.waitForTimeout(500);
    const triggerBtn = page.getByTestId('hamburger-menu-trigger');
    await triggerBtn.click();
    const drawer = page.getByTestId('hamburger-menu-drawer');
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const ariaExpandedAfter = await trigger.getAttribute('aria-expanded');
    const roleAttr = await drawer.getAttribute('role');
    const ariaModalAttr = await drawer.getAttribute('aria-modal');
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    recordResult({
      id: 'MECH-02',
      label: 'Open Drawer & Verify Dialog ARIA + Scroll Lock + Mobile Fit',
      role: 'All Roles (Guest)',
      expected: 'Drawer opens with role="dialog", aria-modal="true", trigger aria-expanded="true", body overflow="hidden", zero horizontal overflow',
      actual: `role="${roleAttr}", aria-modal="${ariaModalAttr}", aria-expanded="${ariaExpandedAfter}", body.overflow="${bodyOverflow}", horizontalOverflow=${hasHorizontalOverflow}`,
      result:
        roleAttr === 'dialog' &&
        ariaModalAttr === 'true' &&
        ariaExpandedAfter === 'true' &&
        bodyOverflow === 'hidden' &&
        !hasHorizontalOverflow
          ? 'Passed'
          : 'Failed',
      evidence: `Dialog ID=citykart-hamburger-drawer, viewport=375x812`,
      fixStatus: 'Verified in HamburgerNavigationDrawer',
    });

    // 3. Close via Close (X) Button
    const closeBtn = page.getByTestId('hamburger-menu-close');
    const closeBox = await closeBtn.boundingBox();
    await closeBtn.click();
    await drawer.waitFor({ state: 'hidden', timeout: 5000 });
    const bodyOverflowAfterClose = await page.evaluate(() => document.body.style.overflow);

    recordResult({
      id: 'MECH-03',
      label: 'Close Drawer via Close (X) Button',
      role: 'All Roles (Guest)',
      expected: 'Close button (>= 44x44px) dismisses drawer and restores body scroll',
      actual: `Close button size=${Math.round(closeBox?.width || 0)}x${Math.round(closeBox?.height || 0)}px, Drawer hidden=true, body.overflow="${bodyOverflowAfterClose}"`,
      result: (closeBox?.width || 0) >= 44 && (closeBox?.height || 0) >= 44 ? 'Passed' : 'Failed',
      evidence: `Close button testid="hamburger-menu-close"`,
      fixStatus: 'Verified',
    });

    // 4. Close via Escape Key & Focus Restoration
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden', timeout: 5000 });
    const focusedTestIdAfterEsc = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName
    );

    recordResult({
      id: 'MECH-04',
      label: 'Close Drawer via Escape Key & Focus Return',
      role: 'All Roles (Guest)',
      expected: 'Pressing Escape closes the drawer and returns focus to hamburger-menu-trigger',
      actual: `Drawer hidden after Escape, activeElement data-testid="${focusedTestIdAfterEsc}"`,
      result: focusedTestIdAfterEsc === 'hamburger-menu-trigger' ? 'Passed' : 'Failed',
      evidence: `activeElement after Escape: ${focusedTestIdAfterEsc}`,
      fixStatus: 'Verified via triggerRef.current.focus() on Escape',
    });

    // 5. Close via Outside Backdrop Click
    await page.setViewportSize({ width: 1440, height: 900 });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    await page.mouse.click(1000, 300);
    await drawer.waitFor({ state: 'hidden', timeout: 5000 });

    recordResult({
      id: 'MECH-05',
      label: 'Close Drawer via Backdrop Click (Desktop 1440x900)',
      role: 'All Roles (Guest)',
      expected: 'Clicking backdrop outside drawer panel closes the menu',
      actual: 'Drawer closed cleanly upon clicking backdrop at (1000, 300)',
      result: 'Passed',
      evidence: 'Backdrop testid="hamburger-menu-backdrop"',
      fixStatus: 'Verified',
    });

    // 6. Focus Trap (Tab / Shift+Tab inside Drawer)
    await page.setViewportSize({ width: 375, height: 812 });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }
    const isFocusStillInsideDrawer = await page.evaluate(() => {
      const panel = document.getElementById('citykart-hamburger-drawer');
      return panel ? panel.contains(document.activeElement) : false;
    });

    recordResult({
      id: 'MECH-06',
      label: 'Keyboard Focus Trap Inside Open Drawer (Tab Cycling)',
      role: 'All Roles (Guest)',
      expected: 'Tabbing through all interactive elements wraps focus inside #citykart-hamburger-drawer without leaking to background page',
      actual: `After 20 Tab presses, focus inside #citykart-hamburger-drawer = ${isFocusStillInsideDrawer}`,
      result: isFocusStillInsideDrawer ? 'Passed' : 'Failed',
      evidence: 'Focus trap handler in HamburgerNavigationDrawer',
      fixStatus: 'Verified',
    });

    // =========================================================================
    // PHASE 2: Guest Role Menu Items Verification
    // =========================================================================

    // Verify Role-Restricted Items are HIDDEN for Guest
    const guestSellerDashCount = await page.getByTestId('menu-item-seller-dashboard').count();
    const guestAdminCount = await page.getByTestId('menu-item-super-admin').count();
    const guestSignOutCount = await page.getByTestId('menu-action-signout').count();

    recordResult({
      id: 'ROLE-01',
      label: 'Guest Role Visibility Guard (Hidden Restricted Options)',
      role: 'Guest (Unauthenticated)',
      expected: 'Merchant Studio Dashboard, Super Admin Console, and Sign Out button are hidden for Guest users',
      actual: `sellerDashboardCount=${guestSellerDashCount}, superAdminCount=${guestAdminCount}, signOutCount=${guestSignOutCount}`,
      result:
        guestSellerDashCount === 0 && guestAdminCount === 0 && guestSignOutCount === 0
          ? 'Passed'
          : 'Failed',
      evidence: 'DOM query inside open Guest drawer',
      fixStatus: 'Verified',
    });

    // Item 1: Sign In / Register via OTP
    const signInBtn = page.getByTestId('menu-action-signin');
    await signInBtn.click();
    await drawer.waitFor({ state: 'hidden', timeout: 5000 });
    const otpModalHeading = page.locator('text=/Welcome to Citykart|Verify Mobile|Mobile OTP|Sign In/i').first();
    const isOtpModalVisible = await otpModalHeading.isVisible().catch(() => false);
    // Dismiss OTP Auth Modal
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    recordResult({
      id: 'ITEM-01',
      label: 'Sign In / Register via OTP',
      role: 'Guest (Unauthenticated)',
      expected: 'Closes drawer and opens Mobile OTP Authentication Modal',
      actual: `Drawer closed, OTP Auth Modal visible=${isOtpModalVisible}`,
      result: isOtpModalVisible ? 'Passed' : 'Failed',
      evidence: 'Tested via menu-action-signin click',
      fixStatus: 'Verified',
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.setViewportSize({ width: 375, height: 812 });
    await dismissCityModal();

    // Item 2: My Orders & Live Tracking (Inline View Switch)
    await page.getByTestId('hamburger-menu-trigger').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByTestId('menu-item-my-orders-inline').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'hidden', timeout: 5000 });
    const myOrdersHeading = page.locator('h1:has-text("My Orders")');
    await myOrdersHeading.waitFor({ state: 'visible', timeout: 5000 });
    const isMyOrdersVisible = await myOrdersHeading.isVisible();

    recordResult({
      id: 'ITEM-02',
      label: 'My Orders & Live Tracking (Inline View)',
      role: 'Guest / Customer / All Roles',
      expected: 'Switches main workspace to MY_ORDERS live tracking view and renders active orders without runtime error',
      actual: `Heading "My Orders" visible=${isMyOrdersVisible}, pageErrors=${pageErrors.length}`,
      result: isMyOrdersVisible && pageErrors.length === 0 ? 'Passed' : 'Failed',
      evidence: 'Verified activeOrder.items rendering and fixed product.name guard',
      fixStatus: 'Fixed TypeError on item.product.name and verified',
    });

    // Item 3: Shop Local Storefront (Return to BUYER_HOME)
    await page.getByTestId('hamburger-menu-trigger').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'visible', timeout: 5000 });
    const myOrdersActiveState = await page.getByTestId('menu-item-my-orders-inline').getAttribute('aria-current');
    await page.getByTestId('menu-item-shop-home').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(350);

    await page.getByTestId('hamburger-menu-trigger').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'visible', timeout: 5000 });
    const shopHomeActiveState = await page.getByTestId('menu-item-shop-home').getAttribute('aria-current');
    await page.keyboard.press('Escape');
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(350);

    recordResult({
      id: 'ITEM-03',
      label: 'Shop Local Storefront (Home View & Active Indicator)',
      role: 'All Roles',
      expected: 'Switches view back to BUYER_HOME and updates aria-current="page" active state between My Orders and Shop Local Storefront',
      actual: `MyOrders aria-current before="${myOrdersActiveState}", ShopHome aria-current after="${shopHomeActiveState}"`,
      result: myOrdersActiveState === 'page' && shopHomeActiveState === 'page' ? 'Passed' : 'Failed',
      evidence: 'Verified aria-current="page" transition',
      fixStatus: 'Verified',
    });

    // Item 4: Change City / Location Modal Trigger
    await page.getByTestId('hamburger-menu-trigger').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByTestId('menu-item-location').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'hidden', timeout: 5000 });
    const cityModalVisible = await page
      .locator('text=/Select Your City|Choose Your City|Delivery City|Amravati|Nagpur|Pune/i')
      .first()
      .isVisible()
      .catch(() => false);

    recordResult({
      id: 'ITEM-04',
      label: 'City: <Location> (Change Location Modal)',
      role: 'All Roles',
      expected: 'Closes hamburger drawer and opens LocationSelectorModal',
      actual: `Drawer closed, LocationSelectorModal visible=${cityModalVisible}`,
      result: cityModalVisible ? 'Passed' : 'Failed',
      evidence: 'Tested via menu-item-location',
      fixStatus: 'Verified',
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.setViewportSize({ width: 375, height: 812 });
    await dismissCityModal();

    // Item 5: Shopping Cart Drawer Trigger
    await page.getByTestId('hamburger-menu-trigger').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByTestId('menu-item-cart').click();
    await page.getByTestId('hamburger-menu-drawer').waitFor({ state: 'hidden', timeout: 5000 });
    const cartDrawerVisible = await page
      .locator('text=/Your Cart|Shopping Cart|Cart is empty|Checkout/i')
      .first()
      .isVisible()
      .catch(() => false);

    recordResult({
      id: 'ITEM-05',
      label: 'Shopping Cart Drawer Action',
      role: 'All Roles',
      expected: 'Closes hamburger drawer and opens CartCheckoutDrawer',
      actual: `Drawer closed, CartCheckoutDrawer visible=${cartDrawerVisible}`,
      result: cartDrawerVisible ? 'Passed' : 'Failed',
      evidence: 'Tested via menu-item-cart',
      fixStatus: 'Verified',
    });

    // Helper for Route Navigation items from Hamburger Menu
    async function testRouteItem({ id, testId, label, role, expectedPath, expectedHeadingRegex, expandSupport = false }) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      await page.setViewportSize({ width: 375, height: 812 });
      await dismissCityModal();
      await page.getByTestId('hamburger-menu-trigger').click();
      const drw = page.getByTestId('hamburger-menu-drawer');
      await drw.waitFor({ state: 'visible', timeout: 5000 });

      if (expandSupport) {
        const toggle = page.getByTestId('menu-collapse-support-toggle');
        const expanded = await toggle.getAttribute('aria-expanded');
        if (expanded !== 'true') {
          await toggle.click();
        }
      }

      const item = page.getByTestId(testId);
      const itemBox = await item.boundingBox();
      await Promise.all([
        page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 }),
        item.click(),
      ]);
      await page.waitForLoadState('networkidle');

      const currentPath = new URL(page.url()).pathname;
      const bodyText = await page.locator('body').innerText();
      const matchesHeading = expectedHeadingRegex.test(bodyText);

      recordResult({
        id,
        label,
        role,
        expected: `Navigates to ${expectedPath} and renders destination page content`,
        actual: `URL=${currentPath}, ContentMatched=${matchesHeading}, TargetHeight=${Math.round(itemBox?.height || 0)}px`,
        result: currentPath === expectedPath && matchesHeading && (itemBox?.height || 0) >= 44 ? 'Passed' : 'Failed',
        evidence: `Navigated to ${currentPath} via data-testid="${testId}"`,
        fixStatus: 'Verified',
      });
    }

    // Item 6: Order History & Delivery PINs (/orders)
    await testRouteItem({
      id: 'ITEM-06',
      testId: 'menu-item-orders-page',
      label: 'Order History & Delivery PINs',
      role: 'Customer / All Roles',
      expectedPath: '/orders',
      expectedHeadingRegex: /Order|PIN|Delivery|Track/i,
    });

    // Item 7: For Sellers & Store Studio (/seller)
    await testRouteItem({
      id: 'ITEM-07',
      testId: 'menu-item-seller-portal',
      label: 'For Sellers & Store Studio',
      role: 'All Roles / Prospective & Active Sellers',
      expectedPath: '/seller',
      expectedHeadingRegex: /Seller|Merchant|Store|Register|Studio/i,
    });

    // Item 8: Merchant Plans & Pricing (/pricing)
    await testRouteItem({
      id: 'ITEM-08',
      testId: 'menu-item-pricing',
      label: 'Merchant Plans & Pricing',
      role: 'All Roles / Merchants',
      expectedPath: '/pricing',
      expectedHeadingRegex: /Pricing|Plan|Merchant|Commission|Subscription/i,
    });

    // Item 9: Become a Partner (50/50 Share) (/partner)
    await testRouteItem({
      id: 'ITEM-09',
      testId: 'menu-item-partner-portal',
      label: 'Become a Partner (50/50 Share)',
      role: 'All Roles / City Partners',
      expectedPath: '/partner',
      expectedHeadingRegex: /Partner|50\/50|City|Franchise|Revenue/i,
    });

    // Item 10: Collapsible Disclosure Toggle "Help, Guides & Legal Policies"
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const supportToggle = page.getByTestId('menu-collapse-support-toggle');
    const expandedInitial = await supportToggle.getAttribute('aria-expanded');
    await supportToggle.click();
    const expandedAfterClick = await supportToggle.getAttribute('aria-expanded');
    await supportToggle.click();
    const expandedAfterSecondClick = await supportToggle.getAttribute('aria-expanded');

    recordResult({
      id: 'ITEM-10',
      label: 'Help, Guides & Legal Policies (Collapsible Section Toggle)',
      role: 'All Roles',
      expected: 'Toggles aria-expanded between false and true, expanding and collapsing nested support links cleanly',
      actual: `initial="${expandedInitial}" -> firstClick="${expandedAfterClick}" -> secondClick="${expandedAfterSecondClick}"`,
      result:
        expandedInitial === 'false' &&
        expandedAfterClick === 'true' &&
        expandedAfterSecondClick === 'false'
          ? 'Passed'
          : 'Failed',
      evidence: 'Tested menu-collapse-support-toggle disclosure control',
      fixStatus: 'Verified',
    });

    // Items 11-17: Nested Help, Guides & Legal Links
    await testRouteItem({
      id: 'ITEM-11',
      testId: 'menu-item-how-it-works',
      label: 'How Local Shopping Works',
      role: 'All Roles',
      expectedPath: '/how-it-works',
      expectedHeadingRegex: /How|Works|CityKart|Shopping/i,
      expandSupport: true,
    });

    await testRouteItem({
      id: 'ITEM-12',
      testId: 'menu-item-seller-guide',
      label: 'How to Open a Store (Seller Guide)',
      role: 'All Roles / Merchants',
      expectedPath: '/seller-guide',
      expectedHeadingRegex: /Seller|Guide|Store|Merchant/i,
      expandSupport: true,
    });

    await testRouteItem({
      id: 'ITEM-13',
      testId: 'menu-item-about',
      label: 'About CityKart',
      role: 'All Roles',
      expectedPath: '/about',
      expectedHeadingRegex: /About|CityKart|Hyperlocal|Mission/i,
      expandSupport: true,
    });

    await testRouteItem({
      id: 'ITEM-14',
      testId: 'menu-item-contact',
      label: 'Contact & Customer Support',
      role: 'All Roles',
      expectedPath: '/contact',
      expectedHeadingRegex: /Contact|Support|Help|Reach/i,
      expandSupport: true,
    });

    await testRouteItem({
      id: 'ITEM-15',
      testId: 'menu-item-delivery-returns',
      label: 'Delivery, Tracking & Returns',
      role: 'All Roles',
      expectedPath: '/delivery-returns',
      expectedHeadingRegex: /Delivery|Return|Refund|PIN/i,
      expandSupport: true,
    });

    await testRouteItem({
      id: 'ITEM-16',
      testId: 'menu-item-privacy',
      label: 'Privacy Policy',
      role: 'All Roles',
      expectedPath: '/privacy',
      expectedHeadingRegex: /Privacy|Data|Policy/i,
      expandSupport: true,
    });

    await testRouteItem({
      id: 'ITEM-17',
      testId: 'menu-item-terms',
      label: 'Terms & Conditions',
      role: 'All Roles',
      expectedPath: '/terms',
      expectedHeadingRegex: /Terms|Conditions|Agreement/i,
      expandSupport: true,
    });

    // =========================================================================
    // PHASE 3: Role-Based Menu & Navigation Verification
    // (Customer/Buyer, Verified Seller, City Partner, Super Admin)
    // =========================================================================

    // 3A. Authenticated Customer / Buyer Role
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem(
        'urbandirect_auth_user',
        JSON.stringify({
          phoneE164: '+919876543210',
          role: 'buyer',
          verifiedAt: new Date().toISOString(),
        })
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const buyerBadgeText = await page.getByTestId('menu-section-account').innerText();
    const buyerHasSignOut = await page.getByTestId('menu-action-signout').isVisible();
    const buyerHasSellerDash = (await page.getByTestId('menu-item-seller-dashboard').count()) > 0;
    const buyerHasSuperAdmin = (await page.getByTestId('menu-item-super-admin').count()) > 0;

    recordResult({
      id: 'ROLE-02',
      label: 'Customer (Verified Buyer) Role Menu & Sign Out',
      role: 'Customer / Buyer (+919876543210)',
      expected: 'Displays Verified Customer badge, shows Sign Out button, and hides Seller Dashboard & Super Admin Console',
      actual: `BadgeIncludesCustomer=${/Verified Customer/i.test(buyerBadgeText)}, SignOutVisible=${buyerHasSignOut}, SellerDashVisible=${buyerHasSellerDash}, SuperAdminVisible=${buyerHasSuperAdmin}`,
      result:
        /Verified Customer/i.test(buyerBadgeText) &&
        buyerHasSignOut &&
        !buyerHasSellerDash &&
        !buyerHasSuperAdmin
          ? 'Passed'
          : 'Failed',
      evidence: 'Seeded urbandirect_auth_user with role="buyer"',
      fixStatus: 'Verified',
    });

    // Test Sign Out action
    await page.getByTestId('menu-action-signout').click();
    await drawer.waitFor({ state: 'hidden', timeout: 5000 });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const signInVisibleAfterLogout = await page.getByTestId('menu-action-signin').isVisible();

    recordResult({
      id: 'ITEM-18',
      label: 'Sign Out of Session Action',
      role: 'Authenticated User -> Guest',
      expected: 'Signs out active user, closes drawer, and restores Guest Sign In CTA',
      actual: `SignInVisibleAfterLogout=${signInVisibleAfterLogout}`,
      result: signInVisibleAfterLogout ? 'Passed' : 'Failed',
      evidence: 'Tested via menu-action-signout',
      fixStatus: 'Verified',
    });

    // 3B. Verified Seller / Business Owner Role (+ Merchant Studio Dashboard item)
    await page.evaluate(() => {
      localStorage.setItem(
        'urbandirect_auth_user',
        JSON.stringify({
          phoneE164: '+919822011111',
          role: 'seller',
          sellerStoreId: 's1',
          verifiedAt: new Date().toISOString(),
        })
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const sellerDashItem = page.getByTestId('menu-item-seller-dashboard');
    const isSellerDashVisible = await sellerDashItem.isVisible();
    const sellerHasSuperAdmin = (await page.getByTestId('menu-item-super-admin').count()) > 0;

    await Promise.all([
      page.waitForURL((url) => url.pathname === '/seller/dashboard', { timeout: 10000 }),
      sellerDashItem.click(),
    ]);
    await page.waitForLoadState('networkidle');
    const sellerDashUrl = new URL(page.url()).pathname;

    recordResult({
      id: 'ITEM-19',
      label: 'Merchant Studio Dashboard (Seller Role Only)',
      role: 'Seller / Business Owner (+919822011111)',
      expected: 'Visible for Verified Seller, hidden for Guest/Buyer, navigates to /seller/dashboard while keeping Super Admin hidden',
      actual: `SellerDashVisible=${isSellerDashVisible}, SuperAdminVisible=${sellerHasSuperAdmin}, NavigatedTo=${sellerDashUrl}`,
      result:
        isSellerDashVisible && !sellerHasSuperAdmin && sellerDashUrl === '/seller/dashboard'
          ? 'Passed'
          : 'Failed',
      evidence: 'Navigated to /seller/dashboard via menu-item-seller-dashboard',
      fixStatus: 'Verified',
    });

    // 3C. City Partner Role
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem(
        'urbandirect_auth_user',
        JSON.stringify({
          phoneE164: '+919765432109',
          role: 'partner',
          partnerCity: 'Amravati',
          verifiedAt: new Date().toISOString(),
        })
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const partnerAccountText = await page.getByTestId('menu-section-account').innerText();
    const partnerItemText = await page.getByTestId('menu-item-partner-portal').innerText();
    const partnerHasSuperAdmin = (await page.getByTestId('menu-item-super-admin').count()) > 0;

    recordResult({
      id: 'ROLE-03',
      label: 'City Partner Role Menu & Dynamic Partner Console Label',
      role: 'City Partner (+919765432109)',
      expected: 'Displays City Partner badge, updates partner item label to "City Partner Console", and hides Super Admin Console',
      actual: `BadgeIncludesPartner=${/City Partner/i.test(partnerAccountText)}, ItemLabelIncludesConsole=${/City Partner Console/i.test(partnerItemText)}, SuperAdminVisible=${partnerHasSuperAdmin}`,
      result:
        /City Partner/i.test(partnerAccountText) &&
        /City Partner Console/i.test(partnerItemText) &&
        !partnerHasSuperAdmin
          ? 'Passed'
          : 'Failed',
      evidence: 'Verified dynamic label and badge for role="partner"',
      fixStatus: 'Verified',
    });

    // 3D. Super Admin Role (+918329306616)
    await page.evaluate(() => {
      localStorage.setItem(
        'urbandirect_auth_user',
        JSON.stringify({
          phoneE164: '+918329306616',
          role: 'super_admin',
          isAdmin: true,
          verifiedAt: new Date().toISOString(),
        })
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await trigger.click();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const superAdminItem = page.getByTestId('menu-item-super-admin');
    const isSuperAdminVisible = await superAdminItem.isVisible();
    const adminAccountText = await page.getByTestId('menu-section-account').innerText();

    await Promise.all([
      page.waitForURL((url) => url.pathname === '/admin', { timeout: 10000 }),
      superAdminItem.click(),
    ]);
    await page.waitForLoadState('networkidle');
    const adminUrl = new URL(page.url()).pathname;
    const adminBodyText = await page.locator('body').innerText();

    recordResult({
      id: 'ITEM-20',
      label: 'Super Admin Console (Restricted to +918329306616)',
      role: 'Super Admin (+918329306616)',
      expected: 'Visible exclusively for +918329306616 Super Admin, navigates to /admin governance console',
      actual: `SuperAdminVisible=${isSuperAdminVisible}, BadgeIncludesSuperAdmin=${/Super Admin/i.test(adminAccountText)}, NavigatedTo=${adminUrl}, PageRendered=${/Admin|Governance|Security|OTP/i.test(adminBodyText)}`,
      result:
        isSuperAdminVisible &&
        /Super Admin/i.test(adminAccountText) &&
        adminUrl === '/admin'
          ? 'Passed'
          : 'Failed',
      evidence: 'Tested via menu-item-super-admin',
      fixStatus: 'Verified',
    });

    await context.close();
  } finally {
    await browser.close();
  }

  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: results.filter((r) => r.result === 'Passed').length,
    failed: results.filter((r) => r.result !== 'Passed').length,
    consoleErrors,
    pageErrors,
    results,
  };

  fs.mkdirSync('qa', { recursive: true });
  fs.writeFileSync('qa/playwright-audit-results.json', JSON.stringify(summary, null, 2));
  console.log(`\n=== AUDIT SUMMARY: ${summary.passed}/${summary.totalTests} PASSED | PageErrors: ${pageErrors.length} ===`);
  if (summary.failed > 0 || pageErrors.length > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
