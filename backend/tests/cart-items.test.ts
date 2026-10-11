import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createApp } from '../src/app.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const config = {
  appEnv: 'test' as const,
  uiOrigin: 'http://localhost:5173',
  supabase: { url: 'https://example.supabase.co', publishableKey: 'test-key' },
};
const cart = {
  stage: 'cart', currentOrderId: null, couponCode: null,
  lineCount: 1, checkoutEnabled: true, subtotal: 900,
  lines: [{ productId: 'P1', name: 'Coffee Beans', unitPrice: 450,
    weightGram: 300, quantity: 2, available: true }],
};

function mockSupabase(role: 'Customer' | 'Admin', rpc: unknown, rpcStatus = 200) {
  const calls: Array<{ path: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push({ path, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (path === '/auth/v1/user') return Response.json({ id: '11111111-1111-4111-8111-111111111111' });
    if (path === '/rest/v1/app_users') return Response.json([{
      id: '11111111-1111-4111-8111-111111111111', username: 'tester',
      role, member_tier: role === 'Customer' ? 'normal' : null,
    }]);
    if (path.startsWith('/rest/v1/rpc/cart_')) {
      return Response.json(rpc, { status: rpcStatus });
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  return calls;
}

test('adds an item and returns the complete cart', async () => {
  const calls = mockSupabase('Customer', cart);
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'POST', url: '/cart/items',
      headers: { authorization: 'Bearer valid-token' },
      payload: { productId: 'P1', quantity: 2 } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: cart, messages: [] });
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_add_item',
      body: { p_product_id: 'P1', p_quantity: 2 } });
  } finally { await app.close(); }
});

test('rejects missing auth and admin before calling cart RPC', async () => {
  const calls = mockSupabase('Admin', cart);
  const app = createApp(config);
  try {
    const unauthenticated = await app.inject({ method: 'POST', url: '/cart/items',
      payload: { productId: 'P1', quantity: 1 } });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.json().error.code, 'AUTH_REQUIRED');
    assert.equal(calls.length, 0);

    const admin = await app.inject({ method: 'POST', url: '/cart/items',
      headers: { authorization: 'Bearer valid-token' },
      payload: { productId: 'P1', quantity: 1 } });
    assert.equal(admin.statusCode, 403);
    assert.equal(admin.json().error.code, 'AUTH_FORBIDDEN');
    assert.equal(calls.some(call => call.path.includes('cart_add_item')), false);
  } finally { await app.close(); }
});

test('maps domain failures and upstream failures to different errors', async () => {
  const calls = mockSupabase('Customer', { error: 'INSUFFICIENT_STOCK' });
  const app = createApp(config);
  try {
    const request = { method: 'POST' as const, url: '/cart/items',
      headers: { authorization: 'Bearer valid-token' },
      payload: { productId: 'P1', quantity: 4 } };
    const stock = await app.inject(request);
    assert.equal(stock.statusCode, 400);
    assert.equal(stock.json().error.code, 'INSUFFICIENT_STOCK');
    assert.match(stock.json().error.message, /สต็อก/);
    assert.equal(calls.at(-1)?.path, '/rest/v1/rpc/cart_add_item');

    mockSupabase('Customer', { code: '42501', message: 'permission denied for table cart_lines' }, 403);
    const unavailable = await app.inject(request);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.json().error.code, 'CART_UNAVAILABLE');
    assert.deepEqual(unavailable.json().error.details,
      { upstreamStatus: 403, upstreamCode: '42501', permissionTarget: 'cart_lines' });
    assert.equal(JSON.stringify(unavailable.json()).includes('permission denied'), false);
  } finally { await app.close(); }
});

test('replaces a cart line quantity through the customer RPC', async () => {
  const updated = { ...cart, subtotal: 1350, lines: [{ ...cart.lines[0], quantity: 3 }] };
  const calls = mockSupabase('Customer', updated);
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'PUT', url: '/cart/items/P1',
      headers: { authorization: 'Bearer valid-token' }, payload: { quantity: 3 } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: updated, messages: [] });
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_update_quantity',
      body: { p_product_id: 'P1', p_quantity: 3 } });
  } finally { await app.close(); }
});

test('update rejects absent lines and admin requests', async () => {
  const calls = mockSupabase('Customer', { error: 'ITEM_NOT_IN_CART' });
  const app = createApp(config);
  try {
    const request = { method: 'PUT' as const, url: '/cart/items/P9',
      headers: { authorization: 'Bearer valid-token' }, payload: { quantity: 2 } };
    const missing = await app.inject(request);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, 'ITEM_NOT_IN_CART');
    assert.equal(calls.at(-1)?.path, '/rest/v1/rpc/cart_update_quantity');

    mockSupabase('Admin', cart);
    const forbidden = await app.inject(request);
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().error.code, 'AUTH_FORBIDDEN');
  } finally { await app.close(); }
});

test('update preflight allows the configured UI origin and PUT method', async () => {
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'OPTIONS', url: '/cart/items/P1', headers: {
      origin: config.uiOrigin, 'access-control-request-method': 'PUT',
      'access-control-request-headers': 'authorization,content-type',
    } });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-methods'], 'PUT, DELETE');
  } finally { await app.close(); }
});

test('removing the last line returns an empty cart and its information message', async () => {
  const empty = { ...cart, lineCount: 0, checkoutEnabled: false, subtotal: 0, lines: [] };
  const calls = mockSupabase('Customer', empty);
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'DELETE', url: '/cart/items/P1',
      headers: { authorization: 'Bearer valid-token' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: empty,
      messages: [{ kind: 'info', code: '', message: 'ตะกร้าว่าง' }] });
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_remove_item',
      body: { p_product_id: 'P1' } });
  } finally { await app.close(); }
});

test('view cart and apply coupon use customer RPCs', async () => {
  const couponCart = { ...cart, couponCode: 'SAVE10' };
  const calls = mockSupabase('Customer', couponCart);
  const app = createApp(config);
  try {
    const view = await app.inject({ method: 'GET', url: '/cart',
      headers: { authorization: 'Bearer valid-token' } });
    assert.equal(view.statusCode, 200);
    assert.deepEqual(view.json(), { data: couponCart, messages: [] });
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_view', body: {} });
    const apply = await app.inject({ method: 'PUT', url: '/cart/coupon',
      headers: { authorization: 'Bearer valid-token' }, payload: { code: 'SAVE10' } });
    assert.equal(apply.statusCode, 200);
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_apply_coupon', body: { p_code: 'SAVE10' } });
  } finally { await app.close(); }
});

test('checkout returns 201 with order and notice when coupon is removed', async () => {
  const result = { customer: { userId: '11111111-1111-4111-8111-111111111111', stage: 'checkout',
    currentOrderId: '22222222-2222-4222-8222-222222222222' },
  order: { orderId: '22222222-2222-4222-8222-222222222222', status: 'pending' }, couponRemoved: true };
  const calls = mockSupabase('Customer', result);
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'POST', url: '/cart/checkout',
      headers: { authorization: 'Bearer valid-token' },
      payload: { zone: 'inCity', speed: 'standard' } });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), { data: { customer: result.customer, order: result.order },
      messages: [{ kind: 'notice', code: 'COUPON_NOT_APPLICABLE',
        message: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้' }] });
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_press_checkout',
      body: { p_zone: 'inCity', p_speed: 'standard' } });
  } finally { await app.close(); }
});

test('cancel checkout returns cart and cancelled order', async () => {
  const result = { cart, order: { orderId: '22222222-2222-4222-8222-222222222222', status: 'cancelled' } };
  const calls = mockSupabase('Customer', result);
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'DELETE', url: '/cart/checkout',
      headers: { authorization: 'Bearer valid-token' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: result, messages: [] });
    assert.deepEqual(calls.at(-1), { path: '/rest/v1/rpc/cart_cancel_checkout', body: {} });
  } finally { await app.close(); }
});

test('remove and checkout preserve distinct domain errors', async () => {
  const app = createApp(config);
  try {
    mockSupabase('Customer', { error: 'CART_EMPTY' });
    const remove = await app.inject({ method: 'DELETE', url: '/cart/items/P1',
      headers: { authorization: 'Bearer valid-token' } });
    assert.equal(remove.statusCode, 400);
    assert.equal(remove.json().error.message, 'ไม่มีสินค้าให้ลบ');
    const checkout = await app.inject({ method: 'POST', url: '/cart/checkout',
      headers: { authorization: 'Bearer valid-token' },
      payload: { zone: 'inCity', speed: 'standard' } });
    assert.equal(checkout.statusCode, 400);
    assert.equal(checkout.json().error.message, 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง');
  } finally { await app.close(); }
});

test('a missing workflow RPC remains an infrastructure error', async () => {
  mockSupabase('Customer', { code: 'PGRST202', message: 'Function was not found' }, 404);
  const app = createApp(config);
  try {
    const response = await app.inject({ method: 'GET', url: '/cart',
      headers: { authorization: 'Bearer valid-token' } });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json().error.details,
      { upstreamStatus: 404, upstreamCode: 'PGRST202' });
  } finally { await app.close(); }
});
