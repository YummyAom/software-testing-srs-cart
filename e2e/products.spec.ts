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

test.describe('page-products', () => {
  /**
   * AC-1 (FR-2.1.2, FR-2.6, FR-0.7)
   * Given cus_normal อยู่ stage `ตะกร้า` และตะกร้าว่าง
   * When เรียก addItem(P1, 0)
   * Then ระบบปฏิเสธด้วย QTY_OUT_OF_RANGE และตะกร้ายังว่าง
   */
  test('E2E-PROD-1 (FR-1.3.1, FR-2.1.2, FR-2.3.1, AC-1) product attributes, BVA input validation, reject qty 0 with empty cart preserved', async ({ page }) => {
    // 1. Login เป็น cus_normal (stage ตะกร้า และตะกร้าว่าง)
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 2. ตรวจสอบ attribute ค่าเงินและสต็อกของ P1 (FR-1.3.1, DC-2.1)
    const rowP1 = page.getByTestId('product-row-P1');
    await expect(rowP1).toBeVisible();
    await expect(rowP1.getByTestId('product-name')).toBeVisible();
    await expect(rowP1.getByTestId('product-price')).toHaveAttribute('data-value', '450');
    await expect(rowP1.getByTestId('product-stock')).toHaveAttribute('data-value', '20');

    // 3. ทดสอบ Boundary Input: qty = 0 (AC-1)
    await rowP1.getByTestId('product-add-qty').fill('0');
    await rowP1.getByTestId('product-add-button').click();
    await expect(page.getByTestId('app-message')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');

    // ตรวจสอบยืนยันตาม AC-1 ว่า "และตะกร้ายังว่าง"
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('checkout-button')).toBeDisabled();
    await expect(page.getByTestId('cart-line-P1')).not.toBeVisible();

    // 4. ทดสอบ Boundary Input: qty = 11 (Off-point BVA ขอบบน)
    await page.getByTestId('nav-products').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

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

  /**
   * AC-2 (FR-2.3.2, FR-2.4.1, FR-0.7)
   * Given ตะกร้าของ cus_normal มี P1 quantity 8
   * When เรียก addItem(P1, 3)
   * Then ระบบปฏิเสธด้วย QTY_OUT_OF_RANGE และ P1 ยังมี quantity 8
   */
  test('E2E-PROD-2 (FR-2.3.2, FR-2.4.1, AC-2) adding items when existing qty + add qty > 10 rejected with QTY_OUT_OF_RANGE and qty unchanged', async ({ page }) => {
    // 1. Login เป็น cus_normal
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 2. Given: ตะกร้าของ cus_normal มี P1 quantity 8
    const rowP1 = page.getByTestId('product-row-P1');
    await rowP1.getByTestId('product-add-qty').fill('8');
    await rowP1.getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '8');

    // 3. When: กลับมาหน้า /products แล้วเรียก addItem(P1, 3) -> 8 + 3 = 11 > 10
    await page.getByTestId('nav-products').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await rowP1.getByTestId('product-add-qty').fill('3');
    await rowP1.getByTestId('product-add-button').click();

    // 4. Then: ระบบปฏิเสธด้วย QTY_OUT_OF_RANGE และ P1 ยังมี quantity 8
    await expect(page.getByTestId('app-message')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'QTY_OUT_OF_RANGE');

    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '8');
  });

  /**
   * AC-3 (FR-2.4.2, FR-0.7)
   * Given ตะกร้าของ cus_normal มี P2 quantity 2 (สต็อกพร้อมขาย P2 = 3)
   * When เรียก addItem(P2, 2)
   * Then ระบบปฏิเสธด้วย INSUFFICIENT_STOCK และ P2 ยังมี quantity 2
   */
  test('E2E-PROD-3 (FR-2.4.2, AC-3) adding items exceeding available stock rejected with INSUFFICIENT_STOCK and qty unchanged', async ({ page }) => {
    // 1. Login เป็น cus_normal
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cus_normal');
    await page.getByTestId('login-password').fill(PASSWORD.cus_normal);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 2. Given: ตะกร้าของ cus_normal มี P2 quantity 2 (สต็อกพร้อมขาย P2 = 3)
    const rowP2 = page.getByTestId('product-row-P2');
    await rowP2.getByTestId('product-add-qty').fill('2');
    await rowP2.getByTestId('product-add-button').click();
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');

    // 3. When: กลับมาหน้า /products แล้วเรียก addItem(P2, 2) -> 2 + 2 = 4 > สต็อกพร้อมขาย 3
    await page.getByTestId('nav-products').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await rowP2.getByTestId('product-add-qty').fill('2');
    await rowP2.getByTestId('product-add-button').click();

    // 4. Then: ระบบปฏิเสธด้วย INSUFFICIENT_STOCK และ P2 ยังมี quantity 2
    await expect(page.getByTestId('app-message')).toBeVisible();
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'INSUFFICIENT_STOCK');

    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-line-P2').getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');
  });

  /**
   * AC-11c (FR-2.2.2, FR-0.7 — สินค้าที่สต็อกถูกจองหมด)
   * Given ตะกร้าของ cus_prime ว่าง
   * And cus_normal มีออเดอร์สถานะ `รอชำระเงิน` ที่จอง P2 × 3 ไว้ (สต็อกพร้อมขายของ P2 = 0)
   * When cus_prime เรียก addItem(P2, 1)
   * Then ระบบปฏิเสธด้วย PRODUCT_UNAVAILABLE และตะกร้าของ cus_prime ยังว่าง
   */
  test('E2E-PROD-4 (FR-1.3.1, FR-2.2.2, AC-11c) fully reserved product hidden from product list and API addItem rejected with PRODUCT_UNAVAILABLE', async ({ page }) => {
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
    await expect(page.getByTestId('page-checkout')).toBeVisible({ timeout: 15_000 });

    // 2. Logout แล้ว Login เป็น cus_prime (Given ตะกร้าของ cus_prime ว่าง)
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-username')).toBeVisible();
    await page.getByTestId('login-username').fill('cus_prime');
    await page.getByTestId('login-password').fill(PASSWORD.cus_prime);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 3. ตรวจสอบว่าต้องไม่พบสินค้า P2 ในรายการสินค้า (FR-1.3.1 แสดงเฉพาะสินค้าพร้อมขาย)
    await expect(page.getByTestId('product-row-P1')).toBeVisible();
    await expect(page.getByTestId('product-row-P3')).toBeVisible();
    await expect(page.getByTestId('product-row-P2')).not.toBeVisible();

    // 4. When: cus_prime พยายามเรียก addItem(P2, 1) ขณะที่ P2 ถูกจองหมด (FR-2.2.2, AC-11c)
    // เนื่องจากปุ่ม P2 ถูกซ่อนบน UI จึงยิง API addItem(P2, 1) ด้วย session ของ cus_prime ตรงตาม AC-11c
    const addResult = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('access_token');
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: 'P2', quantity: 1 }),
      });
      const json = await res.json();
      return { status: res.status, error: json.error };
    }, API_URL);

    // 5. Then: ระบบปฏิเสธด้วย PRODUCT_UNAVAILABLE และตะกร้าของ cus_prime ยังว่าง (AC-11c)
    expect(addResult.status).toBe(400);
    expect(addResult.error?.code).toBe('PRODUCT_UNAVAILABLE');

    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('cart-line-P2')).not.toBeVisible();
  });

  /**
   * AC-17 (FR-8.1, FR-8.5.1, FR-8.5.2, FR-0.7)
   * Given cus_normal อยู่ stage `ชำระเงิน`
   * When เรียก addItem(P1, 1)
   * Then ระบบส่งกลับ OPERATION_NOT_ALLOWED และตะกร้า stage และสต็อกคงเดิม
   */
  test('E2E-PROD-5 (FR-8.1, FR-8.5.1, FR-8.5.2, AC-17) opening products page during checkout stage and addItem rejected with OPERATION_NOT_ALLOWED', async ({ page }) => {
    // 1. Login เป็น cus_normal แล้วทำการ checkout เพื่อเข้าสู่ stage `ชำระเงิน`
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
    const orderId = (await page.getByTestId('checkout-order-id').textContent())?.trim();

    // 2. FR-8.5.2: ช่วงอยู่ stage ชำระเงิน ยังสามารถเปิดดูหน้า /products ได้
    await page.goto('/products');
    await expect(page.getByTestId('page-products')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 3. When: พยายามเรียก addItem(P1, 1) ใน stage ชำระเงิน (AC-17 / FR-8.1)
    // ทดสอบทั้งการคลิกปุ่มผ่าน UI (ถ้าปุ่มเปิดให้คลิก) และยิง API เพื่อความแน่นอนตามสเปก
    const rowP1 = page.getByTestId('product-row-P1');
    const isAddButtonEnabled = await rowP1.getByTestId('product-add-button').isEnabled();
    if (isAddButtonEnabled) {
      await rowP1.getByTestId('product-add-qty').fill('1');
      await rowP1.getByTestId('product-add-button').click();
      await expect(page.getByTestId('app-message')).toBeVisible();
      await expect(page.getByTestId('app-message')).toHaveAttribute('data-kind', 'error');
      await expect(page.getByTestId('app-message')).toHaveAttribute('data-code', 'OPERATION_NOT_ALLOWED');
    }

    // ยิง API addItem(P1, 1) ตรง ๆ เพื่อ assert contract ตาม AC-17 แบบ 100%
    const addResult = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('access_token');
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: 'P1', quantity: 1 }),
      });
      const json = await res.json();
      return { status: res.status, error: json.error };
    }, API_URL);

    // 4. Then: ระบบปฏิเสธด้วย OPERATION_NOT_ALLOWED (FR-8.5.1, AC-17)
    expect(addResult.status).toBe(400);
    expect(addResult.error?.code).toBe('OPERATION_NOT_ALLOWED');

    // 5. ตรวจสอบว่า stage และ order ยังคงเดิม ไม่เปลี่ยนแปลง (FR-0.7, AC-17)
    await page.goto('/checkout');
    await expect(page.getByTestId('page-checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-order-id')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-order-id')).toHaveText(orderId ?? '');
  });
});
