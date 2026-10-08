import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { createApp } from './app.js';
import { createMemoryPersistence } from './persistence.js';
import { createMockIdentity } from './mock-identity.js';
import type { PersistenceAdapter } from './persistence.js';

const apps: FastifyInstance[] = [];
export const fixtureConfig = {
  appEnv: 'test' as const,
  seedPasswords: { customerNormal: 'local-test-normal', customerPrime: 'local-test-prime', admin: 'local-test-admin' },
  uiOrigin: 'http://localhost:5173',
  testResetToken: 'local-reset-test-secret',
};
function setup() { const app = createApp(fixtureConfig); apps.push(app); return app; }
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

test('FR-0.1 / FR-1.1 seeded normal Customer logs in at empty initial cart stage', async () => {
  const app = setup();
  const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'cus_normal', password: 'local-test-normal' } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ data: {
    accessToken: expect.any(String), tokenType: 'Bearer', expiresIn: 3600,
    user: { userId: expect.stringMatching(/^[\da-f-]{36}$/), username: 'cus_normal', role: 'Customer', memberTier: 'normal', stage: 'cart', currentOrderId: null },
  }, messages: [] });
});

async function login(app: FastifyInstance, username = 'cus_normal') {
  const password = username === 'cus_normal' ? 'local-test-normal' : username === 'cus_prime' ? 'local-test-prime' : 'local-test-admin';
  const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { username, password } });
  expect(response.statusCode).toBe(200);
  return { authorization: `Bearer ${response.json().data.accessToken}` };
}

test('FR-0.2 / FR-1.3 authenticated users see exact seeded catalog, Customer omits sale status', async () => {
  const app = setup();
  expect((await app.inject('/products')).json().error.code).toBe('AUTH_REQUIRED');
  const headers = await login(app);
  expect((await app.inject({ url: '/products', headers })).json()).toEqual({ data: { products: [
    { productId: 'P1', name: 'Coffee Beans 250g', price: 450, weightGram: 300, availableStock: 20 },
    { productId: 'P2', name: 'Drip Kettle', price: 1200, weightGram: 900, availableStock: 3 },
    { productId: 'P3', name: 'Espresso Machine', price: 15000, weightGram: 8000, availableStock: 5 },
  ] }, messages: [] });
  const admin = await login(app, 'admin01');
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products.map((p: { status: string }) => p.status)).toEqual(['onSale', 'onSale', 'onSale']);
});

test('FR-1.1 / FR-2.8 / DESIGN auth-me: empty Customer cart and Admin null workflow state', async () => {
  const app = setup();
  const headers = await login(app);
  expect((await app.inject({ url: '/cart', headers })).json()).toEqual({ data: { stage: 'cart', currentOrderId: null, couponCode: null, lineCount: 0, checkoutEnabled: false, subtotal: 0, lines: [] }, messages: [] });
  expect((await app.inject({ url: '/auth/me', headers })).json().data).toMatchObject({ role: 'Customer', memberTier: 'normal', stage: 'cart', currentOrderId: null });
  const admin = await login(app, 'admin01');
  expect((await app.inject({ url: '/auth/me', headers: admin })).json().data).toMatchObject({ role: 'Admin', memberTier: null, stage: null, currentOrderId: null });
  expect((await app.inject({ url: '/cart', headers: admin })).json().error.code).toBe('AUTH_FORBIDDEN');
});

test('FR-2.3 add creates one line and combines quantity without reducing available stock', async () => {
  const app = setup(); const headers = await login(app);
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 2 } })).statusCode).toBe(200);
  const added = await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } });
  expect(added.json().data).toEqual({ stage: 'cart', currentOrderId: null, couponCode: null, lineCount: 1, checkoutEnabled: true, subtotal: 1350, lines: [{ productId: 'P1', name: 'Coffee Beans 250g', unitPrice: 450, weightGram: 300, quantity: 3, available: true }] });
  expect((await app.inject({ url: '/products', headers })).json().data.products[0].availableStock).toBe(20);
});

test('FR-2.5 update replaces quantity; FR-2.6 rejects invalid quantity before missing line, without changes', async () => {
  const app = setup(); const headers = await login(app);
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 8 } });
  const response = await app.inject({ method: 'PUT', url: '/cart/items/P1', headers, payload: { quantity: 2 } });
  expect(response.json().data).toMatchObject({ subtotal: 900, lineCount: 1, lines: [{ quantity: 2 }] });
  expect((await app.inject({ method: 'PUT', url: '/cart/items/P9', headers, payload: { quantity: '1' } })).json().error.code).toBe('VALIDATION_ERROR');
  expect((await app.inject({ method: 'PUT', url: '/cart/items/P9', headers, payload: { quantity: 1 } })).json().error.code).toBe('ITEM_NOT_IN_CART');
  expect((await app.inject({ url: '/cart', headers })).json().data).toEqual(response.json().data);
});

test('FR-2.7 removal has exact empty/absent errors and last-line info', async () => {
  const app = setup(); const headers = await login(app);
  expect((await app.inject({ method: 'DELETE', url: '/cart/items/P9', headers })).json()).toEqual({ error: { code: 'CART_EMPTY', message: 'ไม่มีสินค้าให้ลบ' } });
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } });
  expect((await app.inject({ method: 'DELETE', url: '/cart/items/P9', headers })).json()).toEqual({ error: { code: 'ITEM_NOT_IN_CART', message: 'ไม่พบสินค้าในตะกร้า' } });
  const removed = await app.inject({ method: 'DELETE', url: '/cart/items/P1', headers });
  expect(removed.json().data).toMatchObject({ lineCount: 0, checkoutEnabled: false });
  expect(removed.json().messages).toEqual([{ kind: 'info', code: '', message: 'ตะกร้าว่าง' }]);
});

test('FR-3 / FR-1.2 binding SAVE10 works on empty cart, is case-sensitive and survives relogin/read/removal', async () => {
  const app = setup(); const headers = await login(app);
  const bound = await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  expect(bound.json().data).toMatchObject({ couponCode: 'SAVE10', lineCount: 0 });
  expect((await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'save10' } })).json().error.code).toBe('COUPON_INVALID');
  const again = await login(app);
  expect((await app.inject({ url: '/cart', headers: again })).json().data).toEqual(bound.json().data);
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } });
  await app.inject({ method: 'DELETE', url: '/cart/items/P1', headers });
  expect((await app.inject({ url: '/cart', headers })).json().data.couponCode).toBe('SAVE10');
});

test('AC-4 / FR-5.3 prime SAVE10 checkout snapshots 1650/165/0/1485, reserves stock and retains cart/relogin state', async () => {
  const app = setup(); const headers = await login(app, 'cus_prime');
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } });
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P2', quantity: 1 } });
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  const response = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  expect(response.statusCode).toBe(201);
  expect(response.json().data.order).toEqual({ orderId: expect.stringMatching(/^[\da-f-]{36}$/), createdAt: expect.any(String), status: 'pending', netTotal: 1485, subtotal: 1650, discount: 165, discountSource: 'coupon', shippingFee: 0, totalWeightGram: 1200, zone: 'inCity', speed: 'standard', couponCode: 'SAVE10', lines: [
    { productId: 'P1', name: 'Coffee Beans 250g', unitPrice: 450, weightGram: 300, quantity: 1 },
    { productId: 'P2', name: 'Drip Kettle', unitPrice: 1200, weightGram: 900, quantity: 1 },
  ] });
  const relogin = await login(app, 'cus_prime');
  expect((await app.inject({ url: '/auth/me', headers: relogin })).json().data).toEqual(response.json().data.customer);
  expect((await app.inject({ url: '/cart', headers: relogin })).json().data).toMatchObject({ stage: 'checkout', currentOrderId: response.json().data.order.orderId, couponCode: 'SAVE10', lineCount: 2, checkoutEnabled: false });
  expect((await app.inject({ url: '/products', headers })).json().data.products.map((p: { availableStock: number }) => p.availableStock)).toEqual([19, 2, 5]);
});

async function reserve(app: FastifyInstance, headers: { authorization: string }, productId = 'P2', quantity = 3) {
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId, quantity } })).statusCode).toBe(200);
  const response = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  expect(response.statusCode).toBe(201);
  return response.json().data.order as import('@cart/contracts').Order;
}

test('AC-11a / AC-12 / FR-7 cancelling checkout restores snapshot quantities once, preserves cart and creates new ID on next checkout', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  const order = await reserve(app, headers);
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(0);
  const cancelled = await app.inject({ method: 'DELETE', url: '/cart/checkout', headers });
  expect(cancelled.json().data.order).toEqual({ ...order, status: 'cancelled' });
  expect(cancelled.json().data.cart).toMatchObject({ stage: 'cart', currentOrderId: null, lines: [{ quantity: 3 }] });
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(3);
  expect((await app.inject({ method: 'DELETE', url: '/cart/checkout', headers })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(3);
  const next = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  expect(next.json().data.order.orderId).not.toBe(order.orderId);
});

test('FR-6.2/6.3 payFail can repeat indefinitely without changing pending order, stage, cart or stock', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  const order = await reserve(app, headers);
  const before = (await app.inject({ url: '/cart', headers })).json();
  for (let i = 0; i < 3; i++) {
    const response = await app.inject({ method: 'POST', url: `/orders/${order.orderId}/pay-fail`, payload: { result: 'fail' } });
    expect(response.json()).toMatchObject({ data: { customer: { stage: 'checkout', currentOrderId: order.orderId }, order }, messages: [{ kind: 'info', code: '', message: 'การชำระเงินล้มเหลว กรุณาลองใหม่' }] });
  }
  expect((await app.inject({ url: '/cart', headers })).json()).toEqual(before);
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(0);
});

test('AC-18a / FR-6.1 paySuccess clears cart/coupon, keeps paid snapshot, sets success without deducting stock twice', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  const order = await reserve(app, headers);
  const response = await app.inject({ method: 'POST', url: `/orders/${order.orderId}/pay-success`, payload: { result: 'success' } });
  expect(response.json().data).toMatchObject({ customer: { stage: 'success', currentOrderId: order.orderId }, order: { ...order, status: 'paid' } });
  expect((await app.inject({ url: '/cart', headers })).json().data).toMatchObject({ stage: 'success', lines: [], couponCode: null, checkoutEnabled: false });
  for (const operation of ['pay-success', 'pay-fail']) {
    expect((await app.inject({ method: 'POST', url: `/orders/${order.orderId}/${operation}`, payload: { result: operation === 'pay-success' ? 'success' : 'fail' } })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  }
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(0);
});

test('AC-18b / FR-6.4 continueShopping only returns success to empty cart and clears currentOrderId', async () => {
  const app = setup(); const headers = await login(app);
  expect((await app.inject({ method: 'POST', url: '/cart/continue', headers })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  const order = await reserve(app, headers, 'P1', 1);
  expect((await app.inject({ method: 'POST', url: '/cart/continue', headers })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  await app.inject({ method: 'POST', url: `/orders/${order.orderId}/pay-success`, payload: { result: 'success' } });
  expect((await app.inject({ method: 'POST', url: '/cart/continue', headers })).json()).toEqual({ data: { stage: 'cart', currentOrderId: null, lines: [], couponCode: null, lineCount: 0, checkoutEnabled: false, subtotal: 0 }, messages: [] });
});

test('AC-15 / FR-0.5.2 viewOrder returns owner snapshot; foreign and nonexistent have identical errors; Admin is forbidden', async () => {
  const app = setup(); const normal = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  const order = await reserve(app, normal, 'P1', 1);
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers: normal })).json()).toEqual({ data: order, messages: [] });
  const foreign = await app.inject({ url: `/orders/${order.orderId}`, headers: prime });
  const missing = await app.inject({ url: '/orders/not-there', headers: prime });
  expect(foreign.statusCode).toBe(404);
  expect(foreign.json()).toEqual({ error: { code: 'ORDER_NOT_FOUND', message: expect.any(String) } });
  expect(foreign.json()).toEqual(missing.json());
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers: admin })).json().error.code).toBe('AUTH_FORBIDDEN');
});

test('FR-0.5.1/0.6 listOrders is owner-scoped, newest-first and includes cancelled history', async () => {
  const app = setup(); const headers = await login(app); const prime = await login(app, 'cus_prime');
  const first = await reserve(app, headers, 'P1', 1);
  await app.inject({ method: 'DELETE', url: '/cart/checkout', headers });
  const second = (await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'remote', speed: 'express' } })).json().data.order;
  expect((await app.inject({ url: '/orders', headers })).json()).toEqual({ data: { orders: [
    { orderId: second.orderId, createdAt: second.createdAt, status: 'pending', netTotal: 570 },
    { orderId: first.orderId, createdAt: first.createdAt, status: 'cancelled', netTotal: 480 },
  ] }, messages: [] });
  expect((await app.inject({ url: '/orders', headers: prime })).json().data.orders).toEqual([]);
  expect((await app.inject({ url: '/orders', headers: await login(app, 'admin01') })).json().error.code).toBe('AUTH_FORBIDDEN');
});

test('AC-13/14/16 / FR-9.1 Admin validates existence then ALL fields atomically; new price changes live cart, not snapshot', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  const order = await reserve(app, headers, 'P1', 1);
  expect((await app.inject({ method: 'PUT', url: '/admin/products/P1', headers, payload: { price: 500 } })).json().error.code).toBe('AUTH_FORBIDDEN');
  const invalid = await app.inject({ method: 'PUT', url: '/admin/products/P1', headers: admin, payload: { price: 0, stock: 10000 } });
  expect(invalid.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String), details: { fields: ['price', 'stock'] } } });
  expect((await app.inject({ method: 'PUT', url: '/admin/products/P9', headers: admin, payload: { price: 0, stock: 10000 } })).json().error.code).toBe('PRODUCT_NOT_FOUND');
  const updated = await app.inject({ method: 'PUT', url: '/admin/products/P1', headers: admin, payload: { price: 500 } });
  expect(updated.json()).toEqual({ data: { productId: 'P1', name: 'Coffee Beans 250g', price: 500, weightGram: 300, availableStock: 19, status: 'onSale' }, messages: [] });
  expect((await app.inject({ url: '/cart', headers })).json().data).toMatchObject({ subtotal: 500, lines: [{ unitPrice: 500 }] });
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers })).json().data).toEqual(order);
});

test('FR-9.3 / AC-10 close product leaves live unavailable cart line, hides Customer catalog, and does not change existing order', async () => {
  const app = setup(); const headers = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  const order = await reserve(app, headers, 'P1', 1);
  await app.inject({ method: 'POST', url: '/cart/items', headers: prime, payload: { productId: 'P1', quantity: 1 } });
  const closed = await app.inject({ method: 'POST', url: '/admin/products/P1/status', headers: admin, payload: { status: 'offSale' } });
  expect(closed.statusCode).toBe(200);
  expect(closed.json().data.status).toBe('offSale');
  expect((await app.inject({ method: 'POST', url: '/admin/products/P1/status', headers: admin, payload: { status: 'offSale' } })).json()).toEqual(closed.json());
  expect((await app.inject({ url: '/cart', headers: prime })).json().data).toMatchObject({ checkoutEnabled: true, lineCount: 1, lines: [{ available: false }] });
  expect((await app.inject({ url: '/products', headers: prime })).json().data.products.map((p: { productId: string }) => p.productId)).toEqual(['P2', 'P3']);
  expect((await app.inject({ method: 'POST', url: '/cart/checkout', headers: prime, payload: { zone: 'inCity', speed: 'standard' } })).json().error).toMatchObject({ code: 'ITEMS_UNAVAILABLE', details: { productIds: ['P1'] } });
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers })).json().data).toEqual(order);
  expect((await app.inject({ method: 'DELETE', url: '/cart/items/P1', headers: prime })).statusCode).toBe(200);
});

test('AC-19a / FR-10.1 disabling coupon returns whole catalog and changes only next checkout, not attached coupon or snapshot', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  const order = await reserve(app, headers);
  const disabled = await app.inject({ method: 'POST', url: '/admin/coupons/SAVE10/status', headers: admin, payload: { status: 'inactive' } });
  expect(disabled.json()).toEqual({ data: { coupons: [{ code: 'SAVE10', percent: 10, minSpend: 1000, status: 'inactive' }] }, messages: [] });
  expect((await app.inject({ url: '/cart', headers })).json().data.couponCode).toBe('SAVE10');
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers })).json().data).toEqual(order);
  await app.inject({ method: 'DELETE', url: '/cart/checkout', headers });
  expect((await app.inject({ url: '/cart', headers })).json().data.couponCode).toBe('SAVE10');
  const next = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  expect(next.json()).toMatchObject({ data: { order: { couponCode: null, discount: 0, discountSource: 'none', netTotal: 3650 } }, messages: [{ kind: 'notice', code: 'COUPON_NOT_APPLICABLE', message: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้' }] });
});

test('AC-19b / FR-10.2 Admin lists all exact coupon data and Customer cannot list coupons', async () => {
  const app = setup(); const headers = await login(app, 'admin01');
  expect((await app.inject({ url: '/admin/coupons', headers })).json()).toEqual({ data: { coupons: [{ code: 'SAVE10', percent: 10, minSpend: 1000, status: 'active' }] }, messages: [] });
  await app.inject({ method: 'POST', url: '/admin/coupons/SAVE10/status', headers, payload: { status: 'inactive' } });
  expect((await app.inject({ url: '/admin/coupons', headers })).json().data.coupons[0].status).toBe('inactive');
  expect((await app.inject({ url: '/admin/coupons', headers: await login(app) })).json().error.code).toBe('AUTH_FORBIDDEN');
});

test('DC-3.1 / DESIGN reset requires test secret and restores all business seed data without invalidating sessions', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  const order = await reserve(app, headers, 'P1', 1);
  await app.inject({ method: 'PUT', url: '/admin/products/P1', headers: admin, payload: { price: 500, stock: 1 } });
  await app.inject({ method: 'POST', url: '/admin/coupons/SAVE10/status', headers: admin, payload: { status: 'inactive' } });
  const denied = await app.inject({ method: 'POST', url: '/test/reset' });
  expect(denied.statusCode).toBe(403);
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers })).json().data.status).toBe('pending');
  const reset = await app.inject({ method: 'POST', url: '/test/reset', headers: { 'x-test-reset-token': 'local-reset-test-secret' } });
  expect(reset.json()).toEqual({ data: { reset: true }, messages: [] });
  expect((await app.inject({ url: '/cart', headers })).json().data).toMatchObject({ stage: 'cart', lines: [], couponCode: null, currentOrderId: null });
  expect((await app.inject({ url: '/orders', headers })).json().data.orders).toEqual([]);
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[0]).toEqual({ productId: 'P1', name: 'Coffee Beans 250g', price: 450, weightGram: 300, availableStock: 20, status: 'onSale' });
  expect((await app.inject({ url: '/admin/coupons', headers: admin })).json().data.coupons[0].status).toBe('active');
});

test('DESIGN local mock is refused in production; simulator and reset routes are absent outside test', async () => {
  expect(() => createApp({ ...fixtureConfig, appEnv: 'production' as 'test' })).toThrow(/production/);
  const app = createApp({ ...fixtureConfig, appEnv: 'development' }); apps.push(app);
  for (const url of ['/test/reset', '/orders/not-there/pay-success', '/orders/not-there/pay-fail']) {
    expect((await app.inject({ method: 'POST', url, payload: { result: 'success' } })).statusCode).toBe(404);
  }
});

test('DESIGN CORS allows only configured exact origin with bounded preflight methods/headers', async () => {
  const app = setup();
  const allowed = await app.inject({ method: 'OPTIONS', url: '/cart/items', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
  expect(allowed.statusCode).toBe(204);
  expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  const denied = await app.inject({ method: 'OPTIONS', url: '/cart/items', headers: { origin: 'https://evil.invalid', 'access-control-request-method': 'POST' } });
  expect(denied.statusCode).toBe(403);
  expect(denied.headers['access-control-allow-origin']).toBeUndefined();
});

// Additional independent SRS acceptance oracles; these expand already-green checkout behavior.
test.each([
  ['AC-5', 'cus_prime', [['P1', 1], ['P2', 1]], false, 'inCity', 'standard', 1650, 82, 0, 1568, 'member'],
  ['AC-6', 'cus_prime', [['P1', 2]], true, 'upcountry', 'express', 900, 45, 25, 880, 'member'],
  ['AC-8', 'cus_normal', [['P3', 1]], false, 'remote', 'express', 15000, 0, 270, 15270, 'none'],
] as const)('%s exact SRS totals at HTTP checkout', async (_id, username, lines, coupon, zone, speed, subtotal, discount, shippingFee, netTotal, discountSource) => {
  const app = setup(); const headers = await login(app, username);
  for (const [productId, quantity] of lines) await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId, quantity } });
  if (coupon) await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  const response = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone, speed } });
  expect(response.statusCode).toBe(201);
  expect(response.json().data.order).toMatchObject({ subtotal, discount, shippingFee, netTotal, discountSource, couponCode: null });
  expect(response.json().messages).toEqual(coupon ? [{ kind: 'notice', code: 'COUPON_NOT_APPLICABLE', message: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้' }] : []);
  if (coupon) {
    await app.inject({ method: 'DELETE', url: '/cart/checkout', headers });
    expect((await app.inject({ url: '/cart', headers })).json().data.couponCode).toBeNull();
  }
});

test('AC-7 normal P2 with disabled SAVE10 removes coupon only at checkout and yields 0/30/1230', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P2', quantity: 1 } });
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  await app.inject({ method: 'POST', url: '/admin/coupons/SAVE10/status', headers: admin, payload: { status: 'inactive' } });
  expect((await app.inject({ url: '/cart', headers })).json().data.couponCode).toBe('SAVE10');
  const response = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  expect(response.json().data.order).toMatchObject({ subtotal: 1200, discount: 0, shippingFee: 30, netTotal: 1230, couponCode: null });
  expect(response.json().messages).toEqual([{ kind: 'notice', code: 'COUPON_NOT_APPLICABLE', message: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้' }]);
});

test('AC-1/2/3 quantity validation and cumulative stock rejections preserve original cart', async () => {
  const app = setup(); const headers = await login(app);
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 0 } })).json().error.code).toBe('QTY_OUT_OF_RANGE');
  expect((await app.inject({ url: '/cart', headers })).json().data.lines).toEqual([]);
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 8 } });
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 3 } })).json().error.code).toBe('QTY_OUT_OF_RANGE');
  expect((await app.inject({ url: '/cart', headers })).json().data.lines[0].quantity).toBe(8);
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P2', quantity: 2 } });
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P2', quantity: 2 } })).json().error.code).toBe('INSUFFICIENT_STOCK');
  expect((await app.inject({ url: '/cart', headers })).json().data.lines[1].quantity).toBe(2);
});

async function publicState(app: FastifyInstance, normal: { authorization: string }, prime: { authorization: string }, admin: { authorization: string }) {
  const views = [];
  for (const headers of [normal, prime]) {
    for (const url of ['/auth/me', '/cart', '/orders']) views.push((await app.inject({ url, headers })).json());
    const orders = (await app.inject({ url: '/orders', headers })).json().data.orders as { orderId: string }[];
    for (const order of orders) views.push((await app.inject({ url: `/orders/${order.orderId}`, headers })).json());
  }
  views.push((await app.inject({ url: '/products', headers: admin })).json());
  views.push((await app.inject({ url: '/admin/coupons', headers: admin })).json());
  return views;
}

test('FR-0.7 / AC-9 every domain error code preserves both Customers and entire observable store', async () => {
  const app = setup(); const normal = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  const check = async (request: InjectOptions, status: number, code: string) => {
    const before = await publicState(app, normal, prime, admin);
    const response = await app.inject(request);
    expect(response.statusCode).toBe(status);
    expect(response.json().error.code).toBe(code);
    expect(await publicState(app, normal, prime, admin)).toEqual(before);
  };
  await check({ method: 'POST', url: '/auth/login', payload: { username: 'cus_normal', password: 'wrong' } }, 401, 'AUTH_INVALID_CREDENTIALS');
  await check({ url: '/cart' }, 401, 'AUTH_REQUIRED');
  await check({ url: '/cart', headers: admin }, 403, 'AUTH_FORBIDDEN');
  await check({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P9', quantity: '1' } }, 400, 'VALIDATION_ERROR');
  await check({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P9', quantity: 0 } }, 400, 'QTY_OUT_OF_RANGE');
  await check({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P9', quantity: 1 } }, 404, 'PRODUCT_NOT_FOUND');
  await check({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P2', quantity: 4 } }, 400, 'INSUFFICIENT_STOCK');
  await check({ method: 'PUT', url: '/cart/items/P9', headers: normal, payload: { quantity: 1 } }, 404, 'ITEM_NOT_IN_CART');
  await check({ method: 'DELETE', url: '/cart/items/P1', headers: normal }, 400, 'CART_EMPTY');
  await check({ method: 'PUT', url: '/cart/coupon', headers: normal, payload: { code: 'save10' } }, 400, 'COUPON_INVALID');
  await check({ method: 'POST', url: '/cart/continue', headers: normal }, 400, 'OPERATION_NOT_ALLOWED');
  await check({ url: '/orders/unknown', headers: normal }, 404, 'ORDER_NOT_FOUND');
  await check({ method: 'POST', url: '/admin/coupons/unknown/status', headers: admin, payload: { status: 'active' } }, 404, 'COUPON_NOT_FOUND');
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers: normal, payload: { code: 'SAVE10' } });
  await app.inject({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P3', quantity: 3 } });
  await check({ method: 'POST', url: '/cart/checkout', headers: normal, payload: { zone: 'inCity', speed: 'standard' } }, 400, 'WEIGHT_LIMIT_EXCEEDED');
  await app.inject({ method: 'POST', url: '/admin/products/P3/status', headers: admin, payload: { status: 'offSale' } });
  await check({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P3', quantity: 1 } }, 400, 'PRODUCT_UNAVAILABLE');
  await check({ method: 'POST', url: '/cart/checkout', headers: normal, payload: { zone: 'inCity', speed: 'standard' } }, 400, 'ITEMS_UNAVAILABLE');
});

test('FR-2.6 / FR-5.2.1 local ordering includes ALL unavailable IDs and never evaluates coupon on rejected checkout', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  const invalidZone = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'bad', speed: 'standard' } });
  expect(invalidZone.json().error.code).toBe('VALIDATION_ERROR');
  expect((await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } })).json()).toEqual({ error: { code: 'CART_EMPTY', message: 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง' } });
  for (const [productId, quantity] of [['P1', 2], ['P2', 3], ['P3', 3]] as const) await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId, quantity } });
  await app.inject({ method: 'POST', url: '/admin/products/P1/status', headers: admin, payload: { status: 'offSale' } });
  await app.inject({ method: 'PUT', url: '/admin/products/P2', headers: admin, payload: { stock: 1 } });
  await app.inject({ method: 'POST', url: '/admin/coupons/SAVE10/status', headers: admin, payload: { status: 'inactive' } });
  const before = (await app.inject({ url: '/cart', headers })).json();
  const rejected = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  expect(rejected.json().error.code).toBe('ITEMS_UNAVAILABLE');
  expect(rejected.json().error.details.productIds.sort()).toEqual(['P1', 'P2']);
  expect((await app.inject({ url: '/cart', headers })).json()).toEqual(before);
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: null } })).json().error.code).toBe('VALIDATION_ERROR');
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 11 } })).json().error.code).toBe('QTY_OUT_OF_RANGE');
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } })).json().error.code).toBe('PRODUCT_UNAVAILABLE');
});

test('AC-11b/11c / FR-0.4 cross-Customer reservation blocks preexisting checkout and new adds, without changing other cart', async () => {
  const app = setup(); const normal = await login(app); const prime = await login(app, 'cus_prime');
  await app.inject({ method: 'POST', url: '/cart/items', headers: prime, payload: { productId: 'P2', quantity: 1 } });
  const order = await reserve(app, normal);
  const before = (await app.inject({ url: '/cart', headers: prime })).json();
  expect((await app.inject({ method: 'POST', url: '/cart/checkout', headers: prime, payload: { zone: 'inCity', speed: 'standard' } })).json().error).toMatchObject({ code: 'ITEMS_UNAVAILABLE', details: { productIds: ['P2'] } });
  expect((await app.inject({ url: '/cart', headers: prime })).json()).toEqual(before);
  await app.inject({ method: 'DELETE', url: '/cart/items/P2', headers: prime });
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers: prime, payload: { productId: 'P2', quantity: 1 } })).json().error.code).toBe('PRODUCT_UNAVAILABLE');
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers: normal })).json().data).toEqual(order);
});

test('FR-7.1.2 cancellation adds to CURRENT stock even above Admin input upper bound; used coupon stays bound', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers, payload: { code: 'SAVE10' } });
  await reserve(app, headers);
  await app.inject({ method: 'PUT', url: '/admin/products/P2', headers: admin, payload: { stock: 9999 } });
  const response = await app.inject({ method: 'DELETE', url: '/cart/checkout', headers });
  expect(response.json().data.cart).toMatchObject({ couponCode: 'SAVE10', lines: [{ quantity: 3 }] });
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(10002);
});

test('AC-17 / FR-8 cart mutators are rejected in checkout and success, while all reads remain allowed', async () => {
  const app = setup(); const headers = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  const order = await reserve(app, headers, 'P1', 1);
  for (const stage of ['checkout', 'success']) {
    if (stage === 'success') await app.inject({ method: 'POST', url: `/orders/${order.orderId}/pay-success`, payload: { result: 'success' } });
    const before = await publicState(app, headers, prime, admin);
    for (const request of [
      { method: 'POST', url: '/cart/items', payload: { productId: 'P1', quantity: 1 } },
      { method: 'PUT', url: '/cart/items/P1', payload: { quantity: 1 } },
      { method: 'DELETE', url: '/cart/items/P1' },
      { method: 'PUT', url: '/cart/coupon', payload: { code: 'SAVE10' } },
      { method: 'POST', url: '/cart/checkout', payload: { zone: 'inCity', speed: 'standard' } },
    ] as const) expect((await app.inject({ ...request, headers })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
    expect(await publicState(app, headers, prime, admin)).toEqual(before);
    for (const url of ['/products', '/cart', '/orders', `/orders/${order.orderId}`]) expect((await app.inject({ url, headers })).statusCode).toBe(200);
  }
});

test('DESIGN adapter failure after full checkout work rolls back coupon removal, stock, order, stage and cart; FIFO keeps working', async () => {
  const backing = createMemoryPersistence();
  let failCommit = false;
  const persistence: PersistenceAdapter = {
    read: work => backing.read(work),
    transaction: work => backing.transaction(async state => {
      const output = await work(state);
      if (failCommit) { failCommit = false; throw new Error('private DB connection password=must-not-leak'); }
      return output;
    }),
  };
  const app = createApp(fixtureConfig, { persistence }); apps.push(app);
  const normal = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  await app.inject({ method: 'POST', url: '/cart/items', headers: prime, payload: { productId: 'P1', quantity: 2 } });
  await app.inject({ method: 'PUT', url: '/cart/coupon', headers: prime, payload: { code: 'SAVE10' } });
  const before = await publicState(app, normal, prime, admin);
  failCommit = true;
  const failed = await app.inject({ method: 'POST', url: '/cart/checkout', headers: prime, payload: { zone: 'upcountry', speed: 'express' } });
  expect(failed.statusCode).toBe(500);
  expect(failed.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Unable to process request' } });
  expect(await publicState(app, normal, prime, admin)).toEqual(before);
  const retried = await app.inject({ method: 'POST', url: '/cart/checkout', headers: prime, payload: { zone: 'upcountry', speed: 'express' } });
  expect(retried.statusCode).toBe(201);
  expect(retried.json().data.order).toMatchObject({ netTotal: 880, couponCode: null, discount: 45, shippingFee: 25 });
});

test('DESIGN FIFO reads wait behind an in-flight transaction; concurrent adds never lose updates', async () => {
  const backing = createMemoryPersistence();
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const admission = new Promise<void>(resolve => { entered = resolve; });
  let hold = true;
  const persistence: PersistenceAdapter = {
    read: work => backing.read(work),
    transaction: work => backing.transaction(async state => {
      if (hold) { hold = false; entered(); await gate; }
      return work(state);
    }),
  };
  const app = createApp(fixtureConfig, { persistence }); apps.push(app);
  const headers = await login(app);
  const first = app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } });
  await admission;
  const read = app.inject({ url: '/cart', headers });
  release();
  expect((await first).statusCode).toBe(200);
  expect((await read).json().data.lines[0].quantity).toBe(1);
  const commands = await Promise.all(Array.from({ length: 11 }, () => app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } })));
  expect(commands.filter(r => r.statusCode === 200)).toHaveLength(9);
  expect(commands.filter(r => r.json().error?.code === 'QTY_OUT_OF_RANGE')).toHaveLength(2);
  expect((await app.inject({ url: '/cart', headers })).json().data).toMatchObject({ lineCount: 1, subtotal: 4500, lines: [{ quantity: 10 }] });
});

test('DESIGN FIFO two preexisting carts contend for final available stock without overbooking', async () => {
  const app = setup(); const normal = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  for (const headers of [normal, prime]) await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P2', quantity: 3 } });
  const responses = await Promise.all([normal, prime].map(headers => app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } })));
  expect(responses.map(r => r.statusCode).sort()).toEqual([201, 400]);
  expect(responses.find(r => r.statusCode === 400)?.json().error).toMatchObject({ code: 'ITEMS_UNAVAILABLE', details: { productIds: ['P2'] } });
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(0);
  const states = await Promise.all([normal, prime].map(headers => app.inject({ url: '/auth/me', headers })));
  expect(states.map(r => r.json().data.stage).sort()).toEqual(['cart', 'checkout']);
});

test('DESIGN expiring opaque mock sessions cannot be forged and expiration/relogin never releases reservations', async () => {
  let now = Date.parse('2026-10-08T00:00:00Z');
  const app = createApp(fixtureConfig, { clock: () => now }); apps.push(app);
  const headers = await login(app);
  const order = await reserve(app, headers);
  now += 3599_999;
  expect((await app.inject({ url: '/auth/me', headers })).statusCode).toBe(200);
  now += 1;
  expect((await app.inject({ url: '/auth/me', headers })).json().error.code).toBe('AUTH_REQUIRED');
  for (const authorization of ['Bearer forged', `Bearer ${'a'.repeat(43)}`, headers.authorization + 'x', 'Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiQWRtaW4ifQ.', 'Basic bad']) {
    expect((await app.inject({ url: '/products', headers: { authorization } })).json().error.code).toBe('AUTH_REQUIRED');
  }
  const relogin = await login(app);
  expect((await app.inject({ url: '/auth/me', headers: relogin })).json().data).toMatchObject({ stage: 'checkout', currentOrderId: order.orderId });
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers: relogin })).json().data).toEqual(order);
  expect((await app.inject({ url: '/products', headers: await login(app, 'admin01') })).json().data.products[1].availableStock).toBe(0);
});

test('DESIGN/SOI-01/04/08 role and stage precede raw body validation; spoofed identity keys and malformed JSON cannot change state', async () => {
  const app = setup(); const normal = await login(app); const prime = await login(app, 'cus_prime'); const admin = await login(app, 'admin01');
  const before = await publicState(app, normal, prime, admin);
  expect((await app.inject({ method: 'POST', url: '/cart/items', payload: { role: 'Customer', quantity: 1 } })).json().error.code).toBe('AUTH_REQUIRED');
  expect((await app.inject({ method: 'POST', url: '/cart/items', headers: admin, payload: { quantity: 'bad' } })).json().error.code).toBe('AUTH_FORBIDDEN');
  for (const extra of [{ role: 'Admin' }, { customerId: 'foreign' }, { memberTier: 'prime' }, { qty: 1 }, { __proto__: null, ownerId: 'other' }]) {
    expect((await app.inject({ method: 'POST', url: '/cart/items', headers: normal, payload: { productId: 'P1', quantity: 1, ...extra } })).json().error.code).toBe('VALIDATION_ERROR');
  }
  const malformed = { method: 'POST' as const, url: '/cart/items', payload: '{secret-bad-json', headers: { ...normal, 'content-type': 'application/json' } };
  expect((await app.inject(malformed)).json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } });
  expect((await app.inject({ ...malformed, headers: { ...admin, 'content-type': 'application/json' } })).json().error.code).toBe('AUTH_FORBIDDEN');
  expect(await publicState(app, normal, prime, admin)).toEqual(before);
  const order = await reserve(app, normal, 'P1', 1);
  const checkoutBefore = await publicState(app, normal, prime, admin);
  expect((await app.inject(malformed)).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  expect((await app.inject({ method: 'PUT', url: '/cart/coupon', headers: normal, payload: { role: 'Admin' } })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  expect(await publicState(app, normal, prime, admin)).toEqual(checkoutBefore);
  const wrong = await app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'cus_normal', password: 'bad' } });
  const unknown = await app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'CUS_NORMAL', password: 'local-test-normal' } });
  expect(wrong.json()).toEqual(unknown.json());
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers: normal })).json().data).toEqual(order);
});

test('DESIGN/SOI-02/05 whitelisted Admin updates preserve resource-first validation and empty-field disposition', async () => {
  const app = setup(); const headers = await login(app, 'admin01');
  expect((await app.inject({ method: 'PUT', url: '/admin/products/P9', headers, payload: {} })).json().error.code).toBe('PRODUCT_NOT_FOUND');
  expect((await app.inject({ method: 'PUT', url: '/admin/products/P1', headers, payload: {} })).json().error.details).toEqual({ fields: ['price', 'stock'] });
  expect((await app.inject({ method: 'PUT', url: '/admin/products/P1', headers, payload: { price: 500, stock: null } })).json().error.details).toEqual({ fields: ['stock'] });
  for (const [url, code] of [['/admin/products/P9/status', 'PRODUCT_NOT_FOUND'], ['/admin/coupons/unknown/status', 'COUPON_NOT_FOUND']] as const) expect((await app.inject({ method: 'POST', url, headers, payload: { status: 'invalid' } })).json().error.code).toBe(code);
  for (const url of ['/admin/products/P1/status', '/admin/coupons/SAVE10/status']) expect((await app.inject({ method: 'POST', url, headers, payload: { status: 'invalid' } })).json().error.details).toEqual({ fields: ['status'] });
  expect((await app.inject({ url: '/products', headers })).json().data.products[0]).toMatchObject({ price: 450, availableStock: 20, status: 'onSale' });
});

test('FR-6.5 / FR-8 callbacks for missing or cancelled orders are rejected without double effects', async () => {
  const app = setup(); const headers = await login(app); const admin = await login(app, 'admin01');
  for (const [operation, result] of [['pay-success', 'success'], ['pay-fail', 'fail']] as const) {
    expect((await app.inject({ method: 'POST', url: `/orders/missing/${operation}`, payload: { result } })).json().error.code).toBe('ORDER_NOT_FOUND');
  }
  const order = await reserve(app, headers);
  await app.inject({ method: 'DELETE', url: '/cart/checkout', headers });
  for (const [operation, result] of [['pay-success', 'success'], ['pay-fail', 'fail']] as const) expect((await app.inject({ method: 'POST', url: `/orders/${order.orderId}/${operation}`, payload: { result } })).json().error.code).toBe('OPERATION_NOT_ALLOWED');
  expect((await app.inject({ url: '/products', headers: admin })).json().data.products[1].availableStock).toBe(3);
  expect((await app.inject({ url: `/orders/${order.orderId}`, headers })).json().data.status).toBe('cancelled');
});

test('DESIGN transport errors are bounded, sanitized envelopes, not infrastructure success or raw framework details', async () => {
  const app = setup(); const headers = await login(app);
  const unsupported = await app.inject({ method: 'POST', url: '/cart/items', headers: { ...headers, 'content-type': 'application/xml' }, payload: '<secret-password/>' });
  expect(unsupported.statusCode).toBe(415);
  expect(unsupported.json()).toEqual({ error: { code: 'REQUEST_ERROR', message: 'Invalid request' } });
  const oversized = await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1, secret: 'x'.repeat(16384) } });
  expect(oversized.statusCode).toBe(413);
  expect(oversized.json()).toEqual({ error: { code: 'REQUEST_ERROR', message: 'Invalid request' } });
  expect((await app.inject('/private-secret-path')).json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  expect((await app.inject({ url: '/cart', headers })).json().data.lines).toEqual([]);
});

test('DESIGN identity-boundary latency never makes relogin return stale workflow state', async () => {
  const realIdentity = createMockIdentity(fixtureConfig.seedPasswords, Date.now);
  let pause = false; let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const admission = new Promise<void>(resolve => { entered = resolve; });
  const app = createApp(fixtureConfig, { identity: {
    ...realIdentity,
    async verifyCredential(userId, password) {
      const result = await realIdentity.verifyCredential(userId, password);
      if (pause) { pause = false; entered(); await gate; }
      return result;
    },
  } }); apps.push(app);
  const headers = await login(app);
  await app.inject({ method: 'POST', url: '/cart/items', headers, payload: { productId: 'P1', quantity: 1 } });
  pause = true;
  const relogin = app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'cus_normal', password: 'local-test-normal' } });
  await admission;
  const checkoutResponse = await app.inject({ method: 'POST', url: '/cart/checkout', headers, payload: { zone: 'inCity', speed: 'standard' } });
  release();
  expect((await relogin).json().data.user).toEqual(checkoutResponse.json().data.customer);
});
