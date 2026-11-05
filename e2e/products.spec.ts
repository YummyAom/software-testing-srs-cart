import { test, expect } from '@playwright/test';

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',
  cus_prime: process.env.SEED_PASSWORD_CUSTOMER_PRIME ?? '',
  admin01: process.env.SEED_PASSWORD_ADMIN ?? '',
};

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  let reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  if (reset.status() !== 200) {
    await new Promise(r => setTimeout(r, 1000));
    reset = await request.post(`${API_URL}/test/reset`, {
      headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
    });
  }
  expect(reset.status()).toBe(200);
});

test.describe('page-products', () => {
  test('E2E-PROD-1 (FR-1.3.1, FR-2.1.2, FR-2.3.1, AC-1) product attributes, BVA input validation, add to cart', async ({ page }) => {
    // 1. Login เป็น cus_normal
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    // รอให้หน้า page-products โหลดเสร็จและค่า input ถูกตั้งต้น
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 2. ตรวจสอบ attribute ค่าเงินและสต็อกของ P1
    const rowP1 = page.getByTestId('product-row-P1');
    await expect(rowP1).toBeVisible();
    await expect(rowP1.getByTestId('product-name')).toBeVisible();
    await expect(rowP1.getByTestId('product-price')).toHaveAttribute('data-value', '450');
    await expect(rowP1.getByTestId('product-stock')).toHaveAttribute('data-value', '20');

    // 3. ทดสอบ Boundary Input: qty = 0 (Off-point BVA / AC-1)
    await rowP1.getByTestId('product-add-qty').fill('0');
    await rowP1.getByTestId('product-add-button').click();
    await expect(page.getByTestId('app-message')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');

    // 4. ทดสอบ Boundary Input: qty = 11 (Off-point BVA ขอบบน)
    await rowP1.getByTestId('product-add-qty').fill('11');
    await rowP1.getByTestId('product-add-button').click();
    await expect(page.getByTestId('app-message')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');

    // 5. ทดสอบเพิ่มสินค้าสำเร็จ: qty = 2 (Valid in-bound)
    await rowP1.getByTestId('product-add-qty').fill('2');
    await rowP1.getByTestId('product-add-button').click();

    // ไปที่หน้าตะกร้าเพื่อตรวจสอบว่าสินค้าเพิ่มสำเร็จ
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');
  });

  test('E2E-PROD-2 (FR-1.3.1, FR-2.2.2, AC-11c) hiding fully reserved product across customers', async ({ page }) => {
    // 1. cus_normal ทำการ checkout สินค้า P2 จนหมดสต็อก (จอง 3 ชิ้น)
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('product-row-P2').getByTestId('product-add-qty').fill('3');
    await page.getByTestId('product-row-P2').getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');

    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();

    // 2. Logout แล้ว Login เป็น cus_prime
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-username')).toBeVisible();
    await page.getByTestId('login-username').fill('cus_prime');
    await page.getByTestId('login-password').fill(PASSWORD.cus_prime);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 3. ตรวจสอบว่าต้องไม่พบสินค้า P2 (สต็อกพร้อมขายเป็น 0 ไม่ใช่สินค้าพร้อมขายตาม FR-1.3.1)
    await expect(page.getByTestId('product-row-P1')).toBeVisible();
    await expect(page.getByTestId('product-row-P3')).toBeVisible();
    await expect(page.getByTestId('product-row-P2')).not.toBeVisible();
  });
});
