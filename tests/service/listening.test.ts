import { expect, test } from 'vitest';
import { createApp } from '@cart/api';
import type { LoginResult, SuccessResponse } from '@cart/contracts';

// HTTP seam: real loopback socket, spec-seeded mock storage; no real DB claim.
test('DESIGN transport smoke: local server accepts login and protects Customer reads', async () => {
  const app = createApp({
    appEnv: 'development',
    uiOrigin: 'http://localhost:5173',
    seedPasswords: {
      customerNormal: 'local-transport-test-only',
      customerPrime: 'local-transport-test-only',
      admin: 'local-transport-test-only',
    },
  });
  try {
    const origin = await app.listen({ host: '127.0.0.1', port: 0 });
    const unauthenticated = await fetch(`${origin}/cart`);
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });

    const login = await fetch(`${origin}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cus_normal', password: 'local-transport-test-only' }),
    });
    expect(login.status).toBe(200);
    const session = await login.json() as SuccessResponse<LoginResult>;
    expect(session.data.user).toMatchObject({ role: 'Customer', memberTier: 'normal', stage: 'cart' });
    const cart = await fetch(`${origin}/cart`, {
      headers: { Authorization: `Bearer ${session.data.accessToken}` },
    });
    expect(cart.status).toBe(200);
    expect(cart.headers.get('cache-control')).toBe('no-store');
    expect(await cart.json()).toEqual({
      data: { stage: 'cart', currentOrderId: null, couponCode: null, lineCount: 0, checkoutEnabled: false, subtotal: 0, lines: [] },
      messages: [],
    });
    const simulator = await fetch(`${origin}/orders/missing/pay-success`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result: 'success' }),
    });
    expect(simulator.status).toBe(404);
  } finally {
    await app.close();
  }
});
