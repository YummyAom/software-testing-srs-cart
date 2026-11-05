import { test, expect } from '@playwright/test';

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',
};

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  const reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  expect(reset.status()).toBe(200);
});

test.describe('page-success', () => {
  test('E2E-SUCCESS-1 (AC-18a, AC-18b, FR-6.1.4) payment success displays order summary, continue shopping returns to empty cart', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Login as cus_normal
    await page.goto('http://localhost:5173/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 2. Add P2 x 1 (1200 >= minSpend 1000) and go to cart
    const addPromise = page.waitForResponse(resp => resp.url().includes('/cart/items'));
    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('1');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    const addResp = await addPromise;
    expect(addResp.ok()).toBe(true);

    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P2')).toBeVisible();

    // 3. Apply coupon SAVE10
    const couponPromise = page.waitForResponse(resp => resp.url().includes('/cart/coupon'));
    await page.getByTestId('coupon-input').fill('SAVE10');
    await page.getByTestId('coupon-apply').click();
    const couponResp = await couponPromise;
    expect(couponResp.ok()).toBe(true);
    await expect(page.getByTestId('cart-coupon-code')).toContainText('SAVE10');

    // 4. Checkout and click payment success gateway simulator
    const checkoutPromise = page.waitForResponse(resp => resp.url().includes('/cart/checkout'));
    await page.getByTestId('checkout-button').click();
    const checkoutResp = await checkoutPromise;
    expect(checkoutResp.ok()).toBe(true);

    await expect(page.getByTestId('page-checkout')).toBeVisible();
    // Wait until order data finishes loading on checkout page before clicking simulator button
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();

    await page.getByTestId('gateway-pay-success').click();

    // 5. Assert page-success elements (AC-18a, FR-6.1.4)
    await expect(page.getByTestId('page-success')).toBeVisible();
    await expect(page.getByTestId('success-order-id')).toBeVisible();
    await expect(page.getByTestId('success-line-P2')).toBeVisible();
    await expect(page.getByTestId('success-subtotal')).toHaveAttribute('data-value', '1200');
    await expect(page.getByTestId('success-discount')).toHaveAttribute('data-value', '120');
    await expect(page.getByTestId('success-shipping')).toHaveAttribute('data-value', '30');
    await expect(page.getByTestId('success-total')).toHaveAttribute('data-value', '1110');

    // 6. Click continue shopping button (AC-18b, FR-6.4)
    await page.getByTestId('continue-shopping-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('checkout-button')).toBeDisabled();
  });

  test('E2E-SUCCESS-2 (DC-2.13) opening /cart at stage success shows the success page', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Setup: customer pays order and reaches stage success
    await page.goto('http://localhost:5173/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const addPromise = page.waitForResponse(resp => resp.url().includes('/cart/items'));
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    const addResp = await addPromise;
    expect(addResp.ok()).toBe(true);

    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P1')).toBeVisible();

    const checkoutPromise = page.waitForResponse(resp => resp.url().includes('/cart/checkout'));
    await page.getByTestId('checkout-button').click();
    const checkoutResp = await checkoutPromise;
    expect(checkoutResp.ok()).toBe(true);

    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();

    await page.getByTestId('gateway-pay-success').click();
    await expect(page.getByTestId('page-success')).toBeVisible();

    // 2. Try navigating to /cart directly while in stage success
    await page.goto('http://localhost:5173/cart');
    await expect(page.getByTestId('page-success')).toBeVisible();
  });
});
