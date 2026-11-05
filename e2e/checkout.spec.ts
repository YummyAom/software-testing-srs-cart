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

test.describe('page-checkout', () => {
  // Notion: https://app.notion.com/p/Order-40d51d114daf80f48d71e5e7fc2f249e?source=copy_link#40f51d114daf807a8c68c79c1c87f1f1
  test('E2E-1 (AC-11a) checkout creates a pending order and reserves P2 stock', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    // a fresh page load, so networkidle waits for the product list and the quantity box is not reset after fill
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Given: stage cart, available stock of P2 = 3, cart has P2 x 3, delivery inCity + standard
    await expect(page.getByTestId('product-row-P2').getByTestId('product-stock')).toHaveAttribute('data-value', '3');
    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('3');
    const added = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    expect((await added).status()).toBe(200);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');
    await expect(page.getByTestId('zone-select')).toHaveValue('inCity');
    await expect(page.getByTestId('speed-select')).toHaveValue('standard');

    // When: pressCheckout
    await page.getByTestId('checkout-button').click();

    // Then: stage checkout, order is pending
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();
    await expect(page.getByTestId('checkout-order-status')).toHaveAttribute('data-status', 'pending');

    // Then: available stock of P2 = 0. A customer only sees products on sale (FR-1.3.1), so P2 leaves the list.
    await page.getByTestId('nav-products').click();
    // wait for P1 first, otherwise the P2 check passes while the list is still loading
    await expect(page.getByTestId('product-row-P1')).toBeVisible();
    await expect(page.getByTestId('product-row-P2')).toHaveCount(0);
  });

  // Notion: https://app.notion.com/p/Order-40d51d114daf80f48d71e5e7fc2f249e?source=copy_link#40f51d114daf80078d4ae456949e03cf
  test('E2E-2 (AC-12) cancel checkout cancels the order, returns stock and keeps the cart', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Given: stage checkout with a pending order of P2 x 3
    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('3');
    const added = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    expect((await added).status()).toBe(200);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-status')).toHaveAttribute('data-status', 'pending');
    const orderId = (await page.getByTestId('checkout-order-id').textContent())?.trim() ?? '';
    expect(orderId).not.toBe('');

    // Given: available stock of P2 = 0, so the stock check below proves it really moved from 0 to 3
    await page.getByTestId('nav-products').click();
    await expect(page.getByTestId('product-row-P1')).toBeVisible();
    await expect(page.getByTestId('product-row-P2')).toHaveCount(0);
    await page.goto('/checkout');
    await expect(page.getByTestId('page-checkout')).toBeVisible();

    // When: cancelCheckout
    await page.getByTestId('cancel-checkout-button').click();

    // Then: stage cart, cart has P2 x 3
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');

    // Then: available stock of P2 = 3
    await page.getByTestId('nav-products').click();
    await expect(page.getByTestId('product-row-P2').getByTestId('product-stock')).toHaveAttribute('data-value', '3');

    // Then: the order is cancelled
    await page.getByTestId('nav-orders').click();
    await expect(page.getByTestId(`order-row-${orderId}`).getByTestId('order-status')).toHaveAttribute('data-status', 'cancelled');
  });

  // Notion: https://app.notion.com/p/Order-40d51d114daf80f48d71e5e7fc2f249e?source=copy_link#40f51d114daf80a599d0d9a2e3884eb9
  test('E2E-5 (AC-18a) pay success goes to the success page', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('3');
    const added = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    expect((await added).status()).toBe(200);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-order-id')).toBeVisible();

    await page.getByTestId('gateway-pay-success').click();

    await expect(page.getByTestId('page-success')).toBeVisible();
  });
});
