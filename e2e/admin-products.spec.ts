import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type Request } from '@playwright/test';

// Test design: docs/test-design/e2e-admin-products-page-test-design.md (TC-01..TC-25)
// Seed after /test/reset: P1 450 THB stock 20, P2 1,200 THB stock 3, P3 15,000 THB stock 5, all onSale.

const API_URL = `http://localhost:${process.env.API_PORT ?? '3001'}`;
const PASSWORD = {
  cus_normal: process.env.SEED_PASSWORD_CUSTOMER_NORMAL ?? '',
  cus_prime: process.env.SEED_PASSWORD_CUSTOMER_PRIME ?? '',
  admin01: process.env.SEED_PASSWORD_ADMIN ?? '',
};
type User = keyof typeof PASSWORD;

test.beforeEach(async ({ request }) => {
  // only the APP_ENV=test API has /test/reset, so anything but 200 means it is not the local test stack: stop here
  const reset = await request.post(`${API_URL}/test/reset`, {
    headers: { 'x-test-reset-token': process.env.TEST_RESET_TOKEN ?? '' },
  });
  expect(reset.status()).toBe(200);
});

// Same guard as cart.spec.ts: a request still running when a test ends can deadlock with the next
// test's TRUNCATE in /test/reset, so wait (capped) for every API call each page sent to be answered.
const UNANSWERED_CALL_WAIT_MS = 3000;
const unansweredApiCalls = new Set<Request>();

function trackApiCalls(page: Page) {
  page.on('request', (request) => {
    if (request.url().startsWith(API_URL)) unansweredApiCalls.add(request);
  });
  page.on('response', (response) => unansweredApiCalls.delete(response.request()));
  page.on('requestfailed', (request) => unansweredApiCalls.delete(request));
}

test.beforeEach(async ({ page }) => {
  unansweredApiCalls.clear();
  trackApiCalls(page);
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

/** Second actor in the same test (Admin next to a Customer, or a guest). Closed by the test. */
async function newActor(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  trackApiCalls(page);
  return { context, page };
}

async function login(page: Page, user: User) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(user);
  await page.getByTestId('login-password').fill(PASSWORD[user]);
  await page.getByTestId('login-submit').click();
  // wait until login finishes, otherwise the next goto runs before the session is saved and lands on /login
  await expect(page.getByTestId(user === 'admin01' ? 'page-admin-products' : 'page-products')).toBeVisible();
}

const productRow = (page: Page, productId: string) => page.getByTestId(`admin-product-row-${productId}`);

async function expectProduct(row: Locator, price: number, stock: number, status?: 'onSale' | 'offSale') {
  await expect(row.getByTestId('admin-product-price')).toHaveAttribute('data-value', String(price));
  await expect(row.getByTestId('admin-product-stock')).toHaveAttribute('data-value', String(stock));
  if (status) await expect(row.getByTestId('admin-product-status')).toHaveAttribute('data-status', status);
}

/** Fill both inputs (Save always sends price and stock) and wait for the PUT answer. */
async function editAndSave(page: Page, productId: string, price: string, stock: string) {
  const row = productRow(page, productId);
  await row.getByTestId('admin-product-price-input').fill(price);
  await row.getByTestId('admin-product-stock-input').fill(stock);
  const saved = page.waitForResponse(
    (res) => res.url().endsWith(`/admin/products/${productId}`) && res.request().method() === 'PUT',
  );
  await row.getByTestId('admin-product-save').click();
  return (await saved).status();
}

async function toggleStatus(page: Page, productId: string) {
  const toggled = page.waitForResponse(
    (res) => res.url().endsWith(`/admin/products/${productId}/status`) && res.request().method() === 'POST',
  );
  await productRow(page, productId).getByTestId('admin-product-toggle-status').click();
  return (await toggled).status();
}

async function expectNoError(page: Page) {
  await expect(page.locator('[data-testid="app-message"][data-kind="error"]')).toHaveCount(0);
}

async function expectError(page: Page, code: string) {
  const message = page.getByTestId('app-message');
  await expect(message).toHaveAttribute('data-kind', 'error');
  await expect(message).toHaveAttribute('data-code', code);
}

/** Customer side: add from /products and wait for the API answer (the page shows no success message). */
async function addFromProducts(page: Page, productId: string, quantity: number) {
  await page.getByTestId('nav-products').click();
  await expect(page.getByTestId('page-products')).toBeVisible();
  const row = page.getByTestId(`product-row-${productId}`);
  await row.getByTestId('product-add-qty').fill(String(quantity));
  const added = page.waitForResponse((res) => res.url().endsWith('/cart/items') && res.request().method() === 'POST');
  await row.getByTestId('product-add-button').click();
  expect((await added).status()).toBe(200);
}

test.describe('page-admin-products', () => {
  test('E2E-ADMIN-1 (FR-1.3.2, DC-2.7, DC-2.9, DC-2.12) admin sees every product with price, stock, status', async ({ page }) => {
    await test.step('TC-01 admin login lands on /admin/products with all products and admin menu', async () => {
      await login(page, 'admin01');
      await expect(page).toHaveURL(/\/admin\/products$/);
      for (const id of ['P1', 'P2', 'P3']) await expect(productRow(page, id)).toBeVisible();
      await expect(page.locator('[data-testid^="admin-product-row-"]')).toHaveCount(3);
      await expect(page.getByTestId('nav-admin-products')).toBeVisible();
      await expect(page.getByTestId('nav-admin-coupons')).toBeVisible();
      await expect(page.getByTestId('nav-cart')).toHaveCount(0);
    });

    await test.step('TC-02 price, stock and status follow the DC-2 contract', async () => {
      await expectProduct(productRow(page, 'P1'), 450, 20, 'onSale');
      await expectProduct(productRow(page, 'P2'), 1200, 3, 'onSale');
      await expectProduct(productRow(page, 'P3'), 15000, 5, 'onSale');
    });

    await test.step('TC-03 edit inputs are prefilled with current values', async () => {
      const p1 = productRow(page, 'P1');
      await expect(p1.getByTestId('admin-product-price-input')).toHaveValue('450');
      await expect(p1.getByTestId('admin-product-stock-input')).toHaveValue('20');
    });

    await test.step('TC-04 /admin/products opens directly by URL', async () => {
      await page.getByTestId('nav-admin-coupons').click();
      await expect(page).toHaveURL(/\/admin\/coupons$/);
      await page.goto('/admin/products');
      await expect(page.getByTestId('page-admin-products')).toBeVisible();
      await expect(page.locator('[data-testid^="admin-product-row-"]')).toHaveCount(3);
    });
  });

  test('E2E-ADMIN-2 (FR-9.1.1, FR-9.1.2) update price and stock with valid values and boundaries', async ({ page }) => {
    await login(page, 'admin01');
    const p1 = productRow(page, 'P1');

    await test.step('TC-05 price 500 / stock 15 is saved; other products unchanged', async () => {
      expect(await editAndSave(page, 'P1', '500', '15')).toBe(200);
      await expectProduct(p1, 500, 15);
      await expectNoError(page);
      await expectProduct(productRow(page, 'P2'), 1200, 3);
      await expectProduct(productRow(page, 'P3'), 15000, 5);
    });

    await test.step('TC-08 saved values survive a reload', async () => {
      await page.reload();
      await expectProduct(p1, 500, 15);
    });

    await test.step('TC-06 lower boundaries price 1 / stock 0 are accepted', async () => {
      expect(await editAndSave(page, 'P1', '1', '0')).toBe(200);
      await expectProduct(p1, 1, 0);
      await expectNoError(page);
    });

    await test.step('TC-07 upper boundaries price 50,000 / stock 9,999 are accepted', async () => {
      expect(await editAndSave(page, 'P1', '50000', '9999')).toBe(200);
      await expectProduct(p1, 50000, 9999);
      await expectNoError(page);
    });
  });

  test('E2E-ADMIN-3 (FR-9.1.1, FR-0.7, AC-16) invalid price or stock is rejected and nothing changes', async ({ page }) => {
    await login(page, 'admin01');
    const p1 = productRow(page, 'P1');
    const cases: [string, string, string, string][] = [
      ['TC-09', 'price 0 (below 1)', '0', '20'],
      ['TC-10', 'price 50,001 (above 50,000)', '50001', '20'],
      ['TC-11', 'stock -1 (below 0)', '450', '-1'],
      ['TC-12', 'stock 10,000 (above 9,999)', '450', '10000'],
      ['TC-13', 'price 0 and stock 10,000 together (AC-16)', '0', '10000'],
      ['TC-14', 'price 1.5 (not an integer)', '1.5', '20'],
    ];

    for (const [id, label, price, stock] of cases) {
      await test.step(`${id} ${label} → VALIDATION_ERROR, P1 stays 450 / 20`, async () => {
        expect(await editAndSave(page, 'P1', price, stock)).toBe(400);
        await expectError(page, 'VALIDATION_ERROR');
        await expectProduct(p1, 450, 20, 'onSale');
      });
    }
  });

  test('E2E-ADMIN-4 (FR-9.3.2, DC-2.9) toggle sale status off and on', async ({ page }) => {
    await login(page, 'admin01');
    const p1 = productRow(page, 'P1');
    const status = p1.getByTestId('admin-product-status');
    const toggle = p1.getByTestId('admin-product-toggle-status');

    await test.step('TC-15 turning P1 offSale', async () => {
      expect(await toggleStatus(page, 'P1')).toBe(200);
      await expect(status).toHaveAttribute('data-status', 'offSale');
      await expect(status).toHaveText('ปิดจำหน่าย');
      await expect(toggle).toHaveText('เปิดขาย');
      await expect(productRow(page, 'P2').getByTestId('admin-product-status')).toHaveAttribute('data-status', 'onSale');
      await expect(productRow(page, 'P3').getByTestId('admin-product-status')).toHaveAttribute('data-status', 'onSale');
    });

    await test.step('TC-16 offSale survives a reload', async () => {
      await page.reload();
      await expect(status).toHaveAttribute('data-status', 'offSale');
    });

    await test.step('TC-17 turning P1 back onSale', async () => {
      expect(await toggleStatus(page, 'P1')).toBe(200);
      await expect(status).toHaveAttribute('data-status', 'onSale');
      await expect(status).toHaveText('วางจำหน่าย');
      await expect(toggle).toHaveText('ปิดขาย');
    });
  });

  test('E2E-ADMIN-5a (FR-9.2.1, FR-9.2.2, AC-13) new price reaches carts but not existing orders', async ({ page, browser }) => {
    // cus_normal holds a pending order with P1 at 450; cus_prime holds P1 in the cart.
    // (A customer with a pending order is in the checkout stage, so /cart is not reachable for the same account.)
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);
    await page.getByTestId('nav-cart').click();
    await expect(page.getByTestId('page-cart')).toBeVisible();
    await page.getByTestId('checkout-button').click();
    await expect(page.getByTestId('page-checkout')).toBeVisible();
    const orderId = (await page.getByTestId('checkout-order-id').textContent())?.trim() ?? '';
    expect(orderId).not.toBe('');

    const prime = await newActor(browser);
    const admin = await newActor(browser);
    try {
      await login(prime.page, 'cus_prime');
      await addFromProducts(prime.page, 'P1', 1);

      await login(admin.page, 'admin01');
      expect(await editAndSave(admin.page, 'P1', '500', '20')).toBe(200);
      await expectProduct(productRow(admin.page, 'P1'), 500, 20);

      await test.step('TC-18 cart of cus_prime shows the new price 500 at once', async () => {
        await prime.page.getByTestId('nav-cart').click();
        const line = prime.page.getByTestId('cart-line-P1');
        await expect(line.getByTestId('cart-line-unit-price')).toHaveAttribute('data-value', '500');
        await expect(prime.page.getByTestId('cart-subtotal')).toHaveAttribute('data-value', '500');
      });

      await test.step('TC-19 existing order of cus_normal keeps P1 at 450', async () => {
        await page.goto(`/orders/${orderId}`);
        await expect(page.getByTestId('order-detail-id')).toHaveText(orderId);
        await expect(page.getByTestId('order-line-P1').getByTestId('order-line-unit-price')).toHaveAttribute('data-value', '450');
      });
    } finally {
      await prime.context.close();
      await admin.context.close();
    }
  });

  test('E2E-ADMIN-5b (FR-1.3.1, FR-9.1.2, FR-9.3.4, AC-10) offSale and stock 0 as the customer sees them', async ({ page, browser }) => {
    await login(page, 'cus_normal');
    await addFromProducts(page, 'P1', 1);

    const admin = await newActor(browser);
    try {
      await login(admin.page, 'admin01');
      expect(await toggleStatus(admin.page, 'P1')).toBe(200);
      await expect(productRow(admin.page, 'P1').getByTestId('admin-product-status')).toHaveAttribute('data-status', 'offSale');
      expect(await editAndSave(admin.page, 'P2', '1200', '0')).toBe(200);
      await expectProduct(productRow(admin.page, 'P2'), 1200, 0);
    } finally {
      await admin.context.close();
    }

    await page.getByTestId('nav-products').click();
    await page.reload();
    await expect(page.getByTestId('page-products')).toBeVisible();

    await test.step('TC-20 offSale P1 disappears from the customer product list', async () => {
      await expect(page.getByTestId('product-row-P3')).toBeVisible();
      await expect(page.getByTestId('product-row-P1')).toHaveCount(0);
    });

    await test.step('TC-22 P2 with stock 0 disappears from the customer product list', async () => {
      await expect(page.getByTestId('product-row-P2')).toHaveCount(0);
    });

    await test.step('TC-21 offSale P1 stays in the cart but is marked unavailable', async () => {
      await page.getByTestId('nav-cart').click();
      const line = page.getByTestId('cart-line-P1');
      await expect(line).toBeVisible();
      await expect(line.getByTestId('cart-line-availability')).toHaveAttribute('data-available', 'false');
    });
  });

  test('E2E-ADMIN-6 (FR-0.2, FR-0.3.2, FR-0.7, AC-14) only an admin can change products', async ({ page, browser }) => {
    await login(page, 'cus_normal');
    await page.goto('/admin/products');
    await expect(page.getByTestId('page-admin-products')).toBeVisible();
    await expect(productRow(page, 'P1')).toBeVisible();

    await test.step('TC-23 customer save is rejected with AUTH_FORBIDDEN', async () => {
      expect(await editAndSave(page, 'P1', '500', '20')).toBe(403);
      await expectError(page, 'AUTH_FORBIDDEN');
    });

    await test.step('TC-24 customer status toggle is rejected with AUTH_FORBIDDEN', async () => {
      expect(await toggleStatus(page, 'P1')).toBe(403);
      await expectError(page, 'AUTH_FORBIDDEN');
      // /admin/products always renders the admin menu (AppShell role="admin"), so open /products by URL
      await page.goto('/products');
      await expect(page.getByTestId('product-row-P1')).toBeVisible();
    });

    const admin = await newActor(browser);
    try {
      await login(admin.page, 'admin01');
      // FR-0.7: neither rejected call changed P1
      await expectProduct(productRow(admin.page, 'P1'), 450, 20, 'onSale');
    } finally {
      await admin.context.close();
    }

    await test.step('TC-25 a guest opening /admin/products sees no product rows', async () => {
      const guest = await newActor(browser);
      try {
        await guest.page.goto('/admin/products');
        await guest.page.waitForTimeout(1000); // give a would-be product load time to show up
        await expect(guest.page.locator('[data-testid^="admin-product-row-"]')).toHaveCount(0);
      } finally {
        await guest.context.close();
      }
    });
  });
});
