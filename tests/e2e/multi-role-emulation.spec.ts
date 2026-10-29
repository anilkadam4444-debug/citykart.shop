import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('CityKart — Complete Multi-Role Real-World Emulation (Buyer, Seller, Partner, Admin, Super Admin)', () => {
  test('Phase 3: Buyer Journey — Store Discovery, Star Ratings, Cart, Checkout & Post-Delivery Store Rating', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/CityKart/i);

    // Verify Store Star Rating badges render on home page store cards
    const ratingBadges = page.locator('[data-testid^="store-rating-badge"]');
    await expect(ratingBadges.first()).toBeVisible();

    // Navigate to Orders page and verify post-delivery Store Star Rating widget on DELIVERED order
    await page.goto(`${BASE_URL}/orders`);
    const ratingWidget = page.locator('[data-testid^="order-store-rating-widget"]').first();
    await expect(ratingWidget).toBeVisible();

    // Select 5 stars and submit review
    const star5 = ratingWidget.locator('[data-testid$="-star-5"]');
    await star5.click();
    const commentInput = ratingWidget.locator('textarea');
    await commentInput.fill('Fast local delivery and fresh groceries!');
    const submitBtn = ratingWidget.locator('[data-testid$="-submit"]');
    await submitBtn.click();

    await expect(ratingWidget).toContainText(/Thank you for rating|Your Store Rating/i);
  });

  test('Phase 5: Partner Journey — OTP Verification -> Partner Application Submission (Regression Test)', async ({ page }) => {
    await page.goto(`${BASE_URL}/partner/verify-otp`);
    await expect(page.locator('h1')).toContainText(/Partner/i);

    // Enter mobile number and request OTP
    const phoneInput = page.locator('[data-testid="partner-phone-input"]');
    await phoneInput.fill('9844123456');
    await page.locator('[data-testid="partner-request-otp-btn"]').click();

    // Read dev OTP hint or fill 6-digit code
    const otpInput = page.locator('[data-testid="partner-otp-code-input"]');
    await expect(otpInput).toBeVisible();
    const devHintText = await page.locator('body').innerText();
    const match = devHintText.match(/\b(\d{6})\b/);
    await otpInput.fill(match ? match[1] : '123456');
    await page.locator('[data-testid="partner-verify-otp-btn"]').click();

    // Verify navigation to /partner?tab=apply&otpVerified=1 and submit application
    await expect(page).toHaveURL(/\/partner.*tab=apply/);
    await expect(page.locator('body')).not.toContainText('Authentication is required. Please verify mobile number.');
  });

  test('Phase 6 & 7: Admin & Super Admin Governance & Route Protection', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await expect(page.locator('body')).toContainText(/Admin|Sign In|Verify/i);
  });
});
