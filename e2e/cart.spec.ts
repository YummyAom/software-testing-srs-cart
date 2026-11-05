import { test, expect, type Page, type Request } from '@playwright/test';

// Test design: docs/test-design/e2e-cart-page-test-design.md (TC-01..TC-16)
// Seed after /test/reset: P1 450 THB stock 20, P2 1,200 THB stock 3, P3 15,000 THB stock 5, coupon SAVE10 active.

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',                  
  cus_prime: process.env.SEED_PASSWORD_CUSTOMER_PRIME ?? '',
  admin01: process.env.SEED_PASSWORD_ADMIN ?? '',
};
type User = keyof typeof PASSWORD;

const EMPTY_CART_TEXT = 'ยังไม่มีสินค้าในรถเข็น';
const NO_COUPON_TEXT = 'ยังไม่ได้ใช้คูปอง';

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  const reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  expect(reset.status()).toBe(200);
});

// Every cart change makes the shell refetch GET /cart for the nav badge. If the test ends while that request
// is still running, its locks (customer_state, then cart_lines) deadlock with the next test's TRUNCATE in
// /test/reset (cart_lines, then customer_state) and the reset answers 503. So before the test ends, wait for
// every API call the page sent: the API replies only after its transaction ends, so its locks are gone by then.
// - waitForLoadState('networkidle') does not help: it resolves at once after the first load of this SPA.
// - A fetch sent just before an SPA navigation (e.g. the badge GET /cart right after POST /cart/checkout)
//   may never report a response to Playwright, so each wait is capped; the API answers within ~1 s.
const UNANSWERED_CALL_WAIT_MS = 3000;
const unansweredApiCalls = new Set<Request>();

test.beforeEach(async ({ page }) => {
  unansweredApiCalls.clear();
  page.on('request', (request) => {
    if (request.url().startsWith(API_URL)) unansweredApiCalls.add(request);
  });
  page.on('response', (response) => unansweredApiCalls.delete(response.request()));
  page.on('requestfailed', (request) => unansweredApiCalls.delete(request));
});

test.afterEach(async () => {
  await Promise.all(
    [...unansweredApiCalls].map((request) =>
      Promise.race([
        request.response().catch(() => null),
        new Promise((resolve) => setTimeout(resolve, UNANSWERED_CALL_WAIT_MS)),
      ]),
    ),
  );
});

async function login(page: Page, user: User) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(user);
  await page.getByTestId('login-password').fill(PASSWORD[user]);
  await page.getByTestId('login-submit').click();
  // wait until login finishes, otherwise the next goto runs before the session is saved and lands on /login
  await expect(page.getByTestId(user === 'admin01' ? 'page-admin-products' : 'page-products')).toBeVisible();
}

/** Add from /products. The page shows no success message, so wait for the API answer instead. */
async function addFromProducts(page: Page, productId: string, quantity: number) {
  await page.getByTestId('nav-products').click();
  await expect(page.getByTestId('page-products')).toBeVisible();
  const row = page.getByTestId(`product-row-${productId}`);
  await row.getByTestId('product-add-qty').fill(String(quantity));
  const added = page.waitForResponse(
    (res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST',
  );
  await row.getByTestId('product-add-button').click();
  expect((await added).status()).toBe(200);
}

async function openCart(page: Page) {
  await page.getByTestId('nav-cart').click();
  await expect(page.getByTestId('page-cart')).toBeVisible();
}

const line = (page: Page, productId: string) => page.getByTestId(`cart-line-${productId}`);

async function applyCoupon(page: Page, code: string) {
  await page.getByTestId('coupon-input').fill(code);
  await page.getByTestId('coupon-apply').click();
}

/** Press checkout on /cart and return the API answer (status + body) of POST /cart/checkout. */
async function pressCheckout(page: Page) {
  const answered = page.waitForResponse(
    (res) => res.url().endsWith('/cart/checkout') && res.request().method() === 'POST',
  );
  await page.getByTestId('checkout-button').click();
  const res = await answered;
  return { status: res.status(), body: await res.json() };
}

/** FR-0.7: a rejected checkout keeps the customer at stage cart with the cart unchanged. */
async function expectStillInCart(page: Page, productId: string, quantity: number, subtotal: number) {
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('page-cart')).toBeVisible();
  await expect(line(page, productId).getByTestId('cart-line-qty')).toHaveAttribute('data-value', String(quantity));
  await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', String(subtotal));
}

async function updateQtyByInput(page: Page, productId: string, quantity: number) {
  const row = line(page, productId);
  await row.getByTestId('cart-line-qty-input').fill(String(quantity));
  await row.getByTestId('cart-line-update').click();
}

test.describe('page-cart', () => {
  test('E2E-CART-1 (FR-1.1, FR-2.8, FR-3.2.3) empty cart, coupon on empty cart, checkout disabled', async ({ page }) => {
    await login(page, 'cus_normal');
    await openCart(page);

    await test.step('TC-01 empty cart shows empty state and checkout is disabled', async () => {
      await expect(page.getByText(EMPTY_CART_TEXT)).toBeVisible();
      await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('cart-coupon-code')).toHaveText(NO_COUPON_TEXT);
      await expect(page.getByTestId('checkout-button')).toBeDisabled();
    });

    await test.step('TC-02 SAVE10 can be bound while the cart is empty; checkout stays disabled', async () => {
      await applyCoupon(page, 'SAVE10');
      await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');
      await expect(page.getByTestId('checkout-button')).toBeDisabled();
    });
  });

  test('E2E-CART-2 (FR-2.5.2, FR-2.5.5, FR-2.5.6, FR-2.9) update quantity with +/- and direct input', async ({ page }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);
    await openCart(page);
    const p1 = line(page, 'P1');

    await test.step('TC-03 + button raises P1 to 2 and recalculates totals', async () => {
      await p1.getByRole('button', { name: 'เพิ่มจำนวน' }).click();
      await expect(p1.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '2');
      await expect(p1.locator('.line-total-amount')).toHaveAttribute('data-value', '900');
      await expect(p1.locator('.line-total-amount')).toHaveText('900 บาท');
      await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '900');
    });

    await test.step('TC-04 - button lowers P1 to 1 and then disables itself', async () => {
      await p1.getByRole('button', { name: 'ลดจำนวน' }).click();
      await expect(p1.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '1');
      await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '450');
      await expect(p1.getByRole('button', { name: 'ลดจำนวน' })).toBeDisabled();
    });

    await addFromProducts(page, 'P2', 1);
    await openCart(page);
    const p2 = line(page, 'P2');

    await test.step('TC-05 direct input 3 + update replaces P2 quantity', async () => {
      await updateQtyByInput(page, 'P2', 3);
      await expect(p2.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');
      await expect(p2.locator('.line-total-amount')).toHaveText('3,600 บาท');
      // P1 1 x 450 + P2 3 x 1,200
      await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '4050');
    });

    await test.step('TC-06 direct input above stock is rejected with INSUFFICIENT_STOCK', async () => {
      await updateQtyByInput(page, 'P2', 4);
      const message = page.getByTestId('app-message');
      await expect(message).toHaveAttribute('data-kind', 'error');
      await expect(message).toHaveAttribute('data-code', 'INSUFFICIENT_STOCK');
      await expect(p2.getByTestId('cart-line-qty')).toHaveAttribute('data-value', '3');
    });
  });

  test('E2E-CART-3 (FR-2.7.3, FR-2.7.4, FR-2.8) remove items until the cart is empty', async ({ page }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);
    await addFromProducts(page, 'P2', 1);
    await openCart(page);
    await expect(line(page, 'P1')).toBeVisible();
    await expect(line(page, 'P2')).toBeVisible();

    await test.step('TC-11 removing P1 keeps P2 and checkout stays enabled', async () => {
      await line(page, 'P1').getByTestId('cart-line-remove').click();
      await expect(line(page, 'P1')).toBeHidden();
      await expect(line(page, 'P2')).toBeVisible();
      await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('checkout-button')).toBeEnabled();
    });

    await test.step('TC-13 removing the last line shows empty state and info "ตะกร้าว่าง"', async () => {
      await line(page, 'P2').getByTestId('cart-line-remove').click();
      await expect(page.getByText(EMPTY_CART_TEXT)).toBeVisible();
      const message = page.getByTestId('app-message');
      await expect(message).toHaveAttribute('data-kind', 'info');
      await expect(message).toContainText('ตะกร้าว่าง');
      await expect(page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('checkout-button')).toBeDisabled();
    });
  });

  test('E2E-CART-4 (FR-3.1.1, FR-3.1.2, FR-3.2.1) coupon validation and case sensitivity', async ({ page }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);
    await openCart(page);
    const message = page.getByTestId('app-message');
    const couponCode = page.getByTestId('cart-coupon-code');

    // TC-08 runs before TC-07 because its precondition is "no coupon bound yet".
    await test.step('TC-08 lower-case "save10" is rejected with COUPON_INVALID', async () => {
      await applyCoupon(page, 'save10');
      await expect(message).toHaveAttribute('data-kind', 'error');
      await expect(message).toHaveAttribute('data-code', 'COUPON_INVALID');
      await expect(couponCode).toHaveText(NO_COUPON_TEXT);
    });

    await test.step('TC-09 unknown code "NOPE" is rejected with COUPON_INVALID', async () => {
      await applyCoupon(page, 'NOPE');
      await expect(message).toHaveAttribute('data-kind', 'error');
      await expect(message).toHaveAttribute('data-code', 'COUPON_INVALID');
    });

    await test.step('TC-07 SAVE10 is bound, input is cleared, no error', async () => {
      await applyCoupon(page, 'SAVE10');
      await expect(couponCode).toHaveText('SAVE10');
      await expect(page.getByTestId('coupon-input')).toHaveValue('');
      await expect(message).toHaveCount(0);
    });

    await test.step('TC-10 a wrong new code keeps SAVE10 bound', async () => {
      await applyCoupon(page, 'INVALID');
      await expect(message).toHaveAttribute('data-code', 'COUPON_INVALID');
      await expect(couponCode).toHaveText('SAVE10');
    });
  });

  test('E2E-CART-5 (FR-9.3.4, FR-2.7.3) remove a line the admin turned offSale', async ({ page, browser }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);
    await addFromProducts(page, 'P2', 1);

    await test.step('Precondition: admin01 turns P1 offSale in a separate session', async () => {
      const adminContext = await browser.newContext();
      try {
        const admin = await adminContext.newPage();
        await login(admin, 'admin01');
        const row = admin.getByTestId('admin-product-row-P1');
        await row.getByTestId('admin-product-toggle-status').click();
        await expect(row.getByTestId('admin-product-status')).toHaveAttribute('data-status', 'offSale');
      } finally {
        await adminContext.close();
      }
    });

    await openCart(page);
    const p1 = line(page, 'P1');
    await expect(p1.getByTestId('cart-line-availability')).toHaveAttribute('data-available', 'false');
    await expect(page.getByText('สินค้านี้หมดชั่วคราว')).toBeVisible();

    await test.step('TC-12 removing the offSale P1 line clears the out-of-stock warning', async () => {
      await p1.getByTestId('cart-line-remove').click();
      await expect(p1).toBeHidden();
      await expect(page.getByText('สินค้านี้หมดชั่วคราว')).toHaveCount(0);
      await expect(line(page, 'P2')).toBeVisible();
    });
  });

  test('E2E-CART-6 (FR-1.2.1, FR-1.2.2, FR-2.8) delivery selection, re-login persistence, checkout', async ({ page }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);
    await openCart(page);
    await applyCoupon(page, 'SAVE10');
    await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');

    await test.step('TC-14 choose zone "ต่างจังหวัด" and speed "ด่วน"', async () => {
      await page.getByTestId('zone-select').selectOption({ label: 'ต่างจังหวัด' });
      await page.getByTestId('speed-select').selectOption({ label: 'ด่วน' });
      await expect(page.getByTestId('zone-select')).toHaveValue('upcountry');
      await expect(page.getByTestId('speed-select')).toHaveValue('express');
    });

    await test.step('TC-15 cart line and coupon survive logout and login again', async () => {
      await page.getByTestId('logout-button').click();
      await expect(page.getByTestId('page-login')).toBeVisible();
      await login(page, 'cus_normal');
      await openCart(page);
      await expect(line(page, 'P1')).toBeVisible();
      await expect(page.getByTestId('cart-coupon-code')).toHaveText('SAVE10');
    });

    await test.step('TC-16 checkout button opens /checkout with an order id', async () => {
      await expect(page.getByTestId('checkout-button')).toBeEnabled();
      await page.getByTestId('checkout-button').click();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByTestId('page-checkout')).toBeVisible();
      await expect(page.getByTestId('checkout-order-id')).not.toBeEmpty();
    });
  });

  test('E2E-CART-7 (FR-5.2.1, FR-0.7, AC-9) checkout over 20,000 g is rejected with WEIGHT_LIMIT_EXCEEDED', async ({ page }) => {
    // P3 x 3 = 24,000 g (stock 5, so addItem itself is accepted)
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P3', 3);
    await openCart(page);
    await expect(page.getByTestId('zone-select')).toHaveValue('inCity');
    await expect(page.getByTestId('speed-select')).toHaveValue('standard');

    await test.step('TC-17 pressCheckout(inCity, standard) → WEIGHT_LIMIT_EXCEEDED, still at stage cart, cart unchanged', async () => {
      const { status, body } = await pressCheckout(page);
      expect(status).toBe(400);
      expect(body.error.code).toBe('WEIGHT_LIMIT_EXCEEDED');

      const message = page.getByTestId('app-message');
      await expect(message).toHaveAttribute('data-kind', 'error');
      await expect(message).toHaveAttribute('data-code', 'WEIGHT_LIMIT_EXCEEDED');
      await expectStillInCart(page, 'P3', 3, 45000);
    });
  });

  test('E2E-CART-8 (FR-5.2.1, FR-9.3.4, FR-0.7, AC-10) checkout with a line the admin turned offSale is rejected with ITEMS_UNAVAILABLE', async ({ page, browser }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);

    await test.step('Precondition: admin01 calls setProductStatus(P1, offSale)', async () => {
      const adminContext = await browser.newContext();
      try {
        const admin = await adminContext.newPage();
        await login(admin, 'admin01');
        const row = admin.getByTestId('admin-product-row-P1');
        await row.getByTestId('admin-product-toggle-status').click();
        await expect(row.getByTestId('admin-product-status')).toHaveAttribute('data-status', 'offSale');
      } finally {
        await adminContext.close();
      }
    });

    await openCart(page);
    await expect(line(page, 'P1')).toBeVisible();

    await test.step('TC-18 pressCheckout(inCity, standard) → ITEMS_UNAVAILABLE [P1], still at stage cart, cart unchanged', async () => {
      const { status, body } = await pressCheckout(page);
      expect(status).toBe(400);
      expect(body.error.code).toBe('ITEMS_UNAVAILABLE');
      expect(body.error.details.productIds).toEqual(['P1']);

      const message = page.getByTestId('app-message');
      await expect(message).toHaveAttribute('data-kind', 'error');
      await expect(message).toHaveAttribute('data-code', 'ITEMS_UNAVAILABLE');
      await expectStillInCart(page, 'P1', 1, 450);
    });
  });

  test('E2E-CART-9 (FR-5.2.1, FR-5.3.7, FR-0.7, AC-11b) stock reserved by another customer makes checkout fail with ITEMS_UNAVAILABLE', async ({ page, browser }) => {
    // cus_prime adds P2 x 1 before cus_normal reserves all 3 of P2
    await login(page, 'cus_prime');
    await addFromProducts(page, 'P2', 1);

    await test.step('Precondition: cus_normal checks out P2 x 3 (order awaiting payment, P2 available stock = 0)', async () => {
      const normalContext = await browser.newContext();
      try {
        const normal = await normalContext.newPage();
        await login(normal, 'cus_normal');
        await addFromProducts(normal, 'P2', 3);
        await openCart(normal);
        const { status } = await pressCheckout(normal);
        expect(status).toBe(201); // order created
        await expect(normal.getByTestId('page-checkout')).toBeVisible();
        await expect(normal.getByTestId('checkout-order-id')).not.toBeEmpty();
      } finally {
        await normalContext.close();
      }
    });

    await openCart(page);
    await expect(line(page, 'P2')).toBeVisible();

    await test.step('TC-19 cus_prime pressCheckout(inCity, standard) → ITEMS_UNAVAILABLE [P2], still at stage cart, cart unchanged', async () => {
      const { status, body } = await pressCheckout(page);
      expect(status).toBe(400);
      expect(body.error.code).toBe('ITEMS_UNAVAILABLE');
      expect(body.error.details.productIds).toEqual(['P2']);

      const message = page.getByTestId('app-message');
      await expect(message).toHaveAttribute('data-kind', 'error');
      await expect(message).toHaveAttribute('data-code', 'ITEMS_UNAVAILABLE');
      await expectStillInCart(page, 'P2', 1, 1200);
    });
  });
});
