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

test.describe('page-order-detail', () => {
  test('E2E-2 (AC-15, AC-13) other customer gets ORDER_NOT_FOUND, order keeps P1 price 450 after admin sets 500', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.getByTestId('login-username').click();
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').click();
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await page.getByTestId('checkout-button').click();
    //Store orderId to use later
    const orderId = await page.getByTestId('checkout-order-id').textContent();

    await page.getByTestId('logout-button').click();
    await page.getByTestId('login-username').click();
    await page.getByTestId('login-username').fill('admin01');
    await page.getByTestId('login-password').click();
    await page.getByTestId('login-password').fill(PASSWORD.admin01);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('admin-product-row-P1').getByTestId('admin-product-price-input').click();
    await page.getByTestId('admin-product-row-P1').getByTestId('admin-product-price-input').press('ControlOrMeta+a');
    await page.getByTestId('admin-product-row-P1').getByTestId('admin-product-price-input').fill('500');
    await page.getByTestId('admin-product-row-P1').getByTestId('admin-product-save').click();
    await page.getByTestId('logout-button').click();
    await page.getByTestId('login-username').click();
    await page.getByTestId('login-username').fill('cus_prime');
    await page.getByTestId('login-password').click();
    await page.getByTestId('login-password').fill(PASSWORD.cus_prime);
    await page.getByTestId('login-submit').click();
    // wait until login finishes, otherwise goto runs before the session is saved and lands on /login
    await expect(page.getByTestId('page-products')).toBeVisible();

    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'ORDER_NOT_FOUND');

    await page.getByTestId('nav-products').click();
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();

    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-unit-price')).toHaveAttribute('data-value', '500');

    await page.getByTestId('logout-button').click();
    await page.getByTestId('login-username').click();
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').click();
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('nav-orders').click();
    await page.getByTestId('order-view').click();

    await expect(page.getByTestId('page-order-detail')).toBeVisible();
    await expect(page.getByTestId('order-line-P1').getByTestId('order-line-unit-price')).toHaveAttribute('data-value', '450');
  });
});
