import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from '../../database.js';

// SRS §7 seed data (FR-1.4); app_users are seeded once per stack and kept across resets.
const seedProducts = [
  ['P1', 'Coffee Beans 250g', 450, 300, 20, 'onSale'],
  ['P2', 'Drip Kettle', 1200, 900, 3, 'onSale'],
  ['P3', 'Espresso Machine', 15000, 8000, 5, 'onSale'],
] as const;
const seedCoupons = [['SAVE10', 10, 1000, 'active']] as const;
const seedCustomers = ['cus_normal', 'cus_prime'];

function tokenMatches(expected: string, actual: unknown): boolean {
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** DC-3.1/DC-3.2: registered only when APP_ENV=test. */
export function registerTestRoutes(app: FastifyInstance, resetToken: string | undefined, database: Database): void {
  app.post('/test/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!resetToken || !tokenMatches(resetToken, request.headers['x-test-reset-token'])) {
      return reply.code(403).send({ error: { code: 'TEST_CONTROL_FORBIDDEN', message: 'Test control request is not allowed' } });
    }
    try {
      await database.transaction(async client => {
        const customers = await client.query<{ id: string }>(
          "select id from public.app_users where role = 'Customer' and username = any($1::text[])", [seedCustomers]);
        if (customers.rowCount !== seedCustomers.length) throw new Error('Seed accounts missing');
        // TRUNCATE takes ACCESS EXCLUSIVE locks, so reset queues behind in-flight commands.
        await client.query(`truncate table public.cart_lines, public.order_lines, public.customer_state,
          public.orders, public.products, public.coupons restart identity`);
        for (const product of seedProducts) {
          await client.query(`insert into public.products(product_id, name, price, weight_gram, available_stock, status)
            values ($1, $2, $3, $4, $5, $6)`, [...product]);
        }
        for (const coupon of seedCoupons) {
          await client.query('insert into public.coupons(code, percent, min_spend, status) values ($1, $2, $3, $4)', [...coupon]);
        }
        for (const customer of customers.rows) {
          await client.query(`insert into public.customer_state(customer_id, stage, coupon_code, current_order_id)
            values ($1, 'cart', null, null)`, [customer.id]);
        }
      });
    } catch {
      return reply.code(503).send({ error: { code: 'TEST_RESET_FAILED', message: 'Unable to reset test data' } });
    }
    return { data: { reset: true }, messages: [] };
  });
}
