import { test, expect } from '@playwright/test';

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',
  cus_prime: process.env.SEED_PASSWORD_CUSTOMER_PRIME ?? '',
  admin01: process.env.SEED_PASSWORD_ADMIN ?? '',
};

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  const reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  expect(reset.status()).toBe(200);
});

test.describe('page-checkout', () => {
  test('E2E-1 (AC-11a, FR-6.2, AC-12, AC-18a) checkout, pay fail, cancel, checkout again, pay success', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    // the products page resets every quantity box to 1 when its product list finishes loading, so wait for that first
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('3');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');

    // AC-11a: checkout opens page-checkout with an order
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();

    // FR-6.2: pay fail shows the message and stays on checkout
    await page.getByTestId('gateway-pay-fail').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('app-message')).toContainText('การชำระเงินล้มเหลว กรุณาลองใหม่');

    // AC-12: cancel goes back to the cart with P2 x 3
    await page.getByTestId('cancel-checkout-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');

    // AC-18a: checkout again, then pay success goes to the success page
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await page.getByTestId('gateway-pay-success').click();
    await expect(page.getByTestId('page-success')).toBeVisible();
  });

  test('E2E-3 (DC-2.13) opening /checkout at stage cart shows the cart page', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.getByTestId('login-username').click();
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').click();
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    // wait until login finishes, otherwise goto runs before the session is saved and lands on /login
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto('http://localhost:5173/checkout');
    await expect(page.getByTestId('page-cart')).toBeVisible();
  });
});
