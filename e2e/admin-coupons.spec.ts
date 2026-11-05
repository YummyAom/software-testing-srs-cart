import { test, expect } from '@playwright/test';

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',
  admin01: process.env.SEED_PASSWORD_ADMIN ?? '',
};

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  const reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  expect(reset.status()).toBe(200);
});

test.describe('page-admin-coupons', () => {
  test('E2E-ADMIN-COUPONS-1 (AC-19a, AC-19b, AC-7) admin disables coupon SAVE10 -> customer checking out gets coupon removed with notice', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Customer logs in, adds P2 x 1 (1200 >= minSpend 1000), and binds coupon SAVE10
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const addPromise = page.waitForResponse(resp => resp.url().includes('/cart/items'));
    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('1');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    const addResp = await addPromise;
    expect(addResp.ok()).toBe(true);

    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P2')).toBeVisible();

    const couponPromise = page.waitForResponse(resp => resp.url().includes('/cart/coupon'));
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    const couponResp = await couponPromise;
    expect(couponResp.ok()).toBe(true);
    await expect(page.getByTestId('cart-coupon-code')).toContainText('SAVE10');

    // 2. Customer logs out, Admin logs in
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    await page.getByTestId('login-username').fill('admin01');
    await page.getByTestId('login-password').fill(PASSWORD.admin01);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-admin-products')).toBeVisible();

    // 3. Admin navigates to /admin/coupons
    await page.getByTestId('nav-admin-coupons').click();
    await expect(page.getByTestId('page-admin-coupons')).toBeVisible();

    const save10Row = page.getByTestId('admin-coupon-row-SAVE10');
    await expect(save10Row.getByTestId('admin-coupon-percent')).toHaveAttribute('data-value', '10');
    await expect(save10Row.getByTestId('admin-coupon-min-spend')).toHaveAttribute('data-value', '1000');
    await expect(save10Row.getByTestId('admin-coupon-status')).toHaveAttribute('data-status', 'active');

    // 4. Admin toggles SAVE10 to inactive (AC-19a, AC-19b, FR-10.1.2, FR-10.2)
    await save10Row.getByTestId('admin-coupon-toggle-status').click();
    await expect(save10Row.getByTestId('admin-coupon-status')).toHaveAttribute('data-status', 'inactive');

    // 5. Admin logs out, Customer logs back in
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();

    // 6. Customer checkouts -> coupon is removed with notice COUPON_NOT_APPLICABLE (AC-7, FR-10.1.3)
    const checkoutPromise = page.waitForResponse(resp => resp.url().includes('/cart/checkout'));
    await page.getByTestId('checkout-button').click();
    const checkoutResp = await checkoutPromise;
    expect(checkoutResp.ok()).toBe(true);

    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'notice');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'COUPON_NOT_APPLICABLE');
    await expect(page.getByTestId('checkout-discount')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('checkout-shipping')).toHaveAttribute('data-value', '30');
    await expect(page.getByTestId('checkout-total')).toHaveAttribute('data-value', '1230');
  });
});
