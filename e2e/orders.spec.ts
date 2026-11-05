import { test, expect } from '@playwright/test';

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const RESET_TOKEN = process.env.TEST_RESET_TOKEN || 'local-test-reset-only';
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL || 'Normal@123456',
  cus_prime: process.env.SEED_PASSWORD_CUSTOMER_PRIME || 'Prime@123456',
  admin01: process.env.SEED_PASSWORD_ADMIN || 'Admin@123456',
};

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  let reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': RESET_TOKEN },
  });
  if (reset.status() !== 200) {
    await new Promise(r => setTimeout(r, 1000));
    reset = await request.post(`${API_URL}/test/reset`, {
      headers: { 'x-test-reset-token': RESET_TOKEN },
    });
  }
  expect(reset.status()).toBe(200);
});

test.describe('page-orders', () => {
  test('E2E-ORD-1 (FR-0.5.1, DC-2.7, DC-2.9) order display, status paid, data-value and details navigation', async ({ page }) => {
    // 1. Login และทำการสั่งซื้อสินค้า P1 x 1 จนสำเร็จ
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('product-row-P1').getByTestId('product-add-qty').fill('1');
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');

    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-order-id')).toBeVisible({ timeout: 15_000 });

    const orderIdRaw = await page.getByTestId('checkout-order-id').textContent();
    const orderId = orderIdRaw?.trim() ?? '';
    expect(orderId.length).toBeGreaterThan(0);

    // ชำระเงินสำเร็จผ่าน simulator
    await page.getByTestId('gateway-pay-success').click();
    await expect(page.getByTestId('page-success')).toBeVisible({ timeout: 15_000 });

    // 2. นำทางไปยังหน้า /orders
    await page.getByTestId('nav-orders').click();
    await expect(page.getByTestId('page-orders')).toBeVisible();

    // 3. ตรวจสอบแถวออเดอร์ data-status="paid" และ data-value="480" (ราคา P1 450 + ค่าจัดส่ง inCity standard 30 = 480)
    const orderRow = page.getByTestId(`order-row-${orderId}`);
    await expect(orderRow).toBeVisible();
    await expect(orderRow.getByTestId('order-status')).toHaveAttribute('data-status', 'paid');
    await expect(orderRow.getByTestId('order-total')).toHaveAttribute('data-value', '480');

    // 4. คลิกปุ่มดูรายละเอียดไปยัง /orders/{orderId}
    await orderRow.getByTestId('order-view').click();
    await expect(page.getByTestId('page-order-detail')).toBeVisible();
  });

  test('E2E-ORD-2 (FR-0.6, AC-15) orders sorting from newest to oldest', async ({ page }) => {
    // 1. สร้าง Order 1 (P1 x 1) และชำระเงินสำเร็จ
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('product-row-P1').getByTestId('product-add-qty').fill('1');
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-order-id')).toBeVisible({ timeout: 15_000 });

    const order1Id = (await page.getByTestId('checkout-order-id').textContent())?.trim() ?? '';
    await page.getByTestId('gateway-pay-success').click();
    await expect(page.getByTestId('page-success')).toBeVisible({ timeout: 15_000 });

    // 2. คลิก continue-shopping-button กลับสู่ตะกร้า และสั่งซื้อ Order 2 (P2 x 1)
    await page.getByTestId('continue-shopping-button').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await page.getByTestId('nav-products').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('1');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-order-id')).toBeVisible({ timeout: 15_000 });

    const order2Id = (await page.getByTestId('checkout-order-id').textContent())?.trim() ?? '';
    await page.getByTestId('gateway-pay-success').click();
    await expect(page.getByTestId('page-success')).toBeVisible({ timeout: 15_000 });

    // 3. เข้าหน้า /orders และตรวจสอบการเรียงลำดับ (Order 2 ต้องอยู่บน Order 1)
    await page.getByTestId('nav-orders').click();
    await expect(page.getByTestId('page-orders')).toBeVisible();

    const rows = page.locator('tbody tr[data-testid^="order-row-"]');
    await expect(rows.nth(0)).toHaveAttribute('data-testid', `order-row-${order2Id}`);
    await expect(rows.nth(1)).toHaveAttribute('data-testid', `order-row-${order1Id}`);
  });

  test('E2E-GUARD-1 (FR-0.3.1, FR-8.5.2, DC-2.13, AC-14) StageGuard read-only access and Admin forbidden access', async ({ page }) => {
    // 1. Admin พยายามเข้า /orders โดยตรง -> ต้องถูกปฏิเสธด้วย AUTH_FORBIDDEN
    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin01');
    await page.getByTestId('login-password').fill(PASSWORD.admin01);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-admin-products')).toBeVisible();

    await page.goto('/orders');
    await expect(page.getByTestId('app-message')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'AUTH_FORBIDDEN');

    // 2. Customer อยู่ stage checkout -> สามารถเปิดดู /products และ /orders ได้ตาม FR-8.5.2
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-username')).toBeVisible();
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('product-row-P1').getByTestId('product-add-qty').fill('1');
    await page.getByTestId('product-row-P1').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible({ timeout: 15_000 });

    // ตรวจสอบว่าเปิด /orders และ /products ได้โดยไม่ถูกดีดกลับไป /checkout (D-14 / SOI-03)
    await page.goto('/orders');
    await expect(page.getByTestId('page-orders')).toBeVisible();

    await page.goto('/products');
    await expect(page.getByTestId('page-products')).toBeVisible();
  });
});
