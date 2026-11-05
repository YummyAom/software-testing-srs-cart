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
  test('E2E-3 (AC-13) new P1 price reaches the cart but the existing order keeps 450', async ({ page }) => {
    // Given: cus_prime has P1 in the cart at 450, added before the price change
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_prime');
    await page.getByTestId('login-password').fill(PASSWORD.cus_prime);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const primeAdded = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    expect((await primeAdded).status()).toBe(200);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-unit-price')).toHaveAttribute('data-value', '450');
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    // Given: cus_normal has a pending order with P1 at 450
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const normalAdded = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    expect((await normalAdded).status()).toBe(200);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P1')).toBeVisible();
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-status')).toHaveAttribute('data-status', 'pending');
    const orderId = (await page.getByTestId('checkout-order-id').textContent())?.trim() ?? '';
    expect(orderId).not.toBe('');
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    // When: admin01 calls updateProduct(P1, price = 500)
    await page.getByTestId('login-username').fill('admin01');
    await page.getByTestId('login-password').fill(PASSWORD.admin01);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-admin-products')).toBeVisible();
    // this page loads its product list more than once and each load resets the inputs, so fill only after a fresh load settles
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('admin-product-row-P1').getByTestId('admin-product-price-input').fill('500');
    const saved = page.waitForResponse((res) => res.url().endsWith('/admin/products/P1') && res.request().method() === 'PUT');
    await page.getByTestId('admin-product-row-P1').getByTestId('admin-product-save').click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId('admin-product-row-P1').getByTestId('admin-product-price')).toHaveAttribute('data-value', '500');
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    // Then: viewCart of a customer with P1 in the cart shows 500
    await page.getByTestId('login-username').fill('cus_prime');
    await page.getByTestId('login-password').fill(PASSWORD.cus_prime);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-unit-price')).toHaveAttribute('data-value', '500');
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();

    // Then: viewOrder of the existing order still shows P1 = 450
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId('page-order-detail')).toBeVisible();
    await expect(page.getByTestId('order-line-P1').getByTestId('order-line-unit-price')).toHaveAttribute('data-value', '450');
  });

  test('E2E-4 (AC-15) another customer opening the order gets ORDER_NOT_FOUND', async ({ page }) => {
    // Given: cus_normal has an order with orderId = X
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const added = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    expect((await added).status()).toBe(200);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P1')).toBeVisible();
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())?.trim() ?? '';
    expect(orderId).not.toBe('');

    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('page-login')).toBeVisible();
    await page.getByTestId('login-username').fill('cus_prime');
    await page.getByTestId('login-password').fill(PASSWORD.cus_prime);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();

    // When: cus_prime calls viewOrder(X)
    await page.goto(`/orders/${orderId}`);

    // Then: rejected with ORDER_NOT_FOUND
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'ORDER_NOT_FOUND');
    await expect(page.getByTestId('order-detail-id')).toHaveCount(0);
  });
});
