import type { PoolClient } from 'pg';
import { calculateSubtotal, isProductAvailable, validateQuantityChange } from '@cart/domain';
import type { Database } from '../../../database.js';
import { CartServiceError } from '../cart-error.js';
import type { CheckoutFacts, CheckoutQuote } from '../checkout-types.js';
import type { Cart, CartLine, CartRepository, CheckoutResult, CancelResult } from '../cart-types.js';

const domainErrors = {
  VALIDATION_ERROR: { status: 400, message: 'quantity ต้องเป็นจำนวนเต็ม' },
  QTY_OUT_OF_RANGE: { status: 400, message: 'quantity ต้องอยู่ระหว่าง 1 ถึง 10 และยอดรวมต่อสินค้าไม่เกิน 10' },
  PRODUCT_NOT_FOUND: { status: 404, message: 'ไม่พบสินค้า' },
  ITEM_NOT_IN_CART: { status: 404, message: 'ไม่พบสินค้าในตะกร้า' },
  CART_EMPTY: { status: 400, message: 'ไม่มีสินค้าให้ลบ' },
  COUPON_INVALID: { status: 400, message: 'คูปองไม่สามารถใช้ได้' },
  COUPON_NOT_FOUND: { status: 404, message: 'ไม่พบคูปอง' },
  ITEMS_UNAVAILABLE: { status: 400, message: 'มีสินค้าไม่พร้อมขายในตะกร้า' },
  WEIGHT_LIMIT_EXCEEDED: { status: 400, message: 'น้ำหนักรวมเกิน 20,000 กรัม' },
  PRODUCT_UNAVAILABLE: { status: 400, message: 'สินค้านี้ไม่พร้อมขาย' },
  INSUFFICIENT_STOCK: { status: 400, message: 'สินค้าในสต็อกไม่เพียงพอ' },
  OPERATION_NOT_ALLOWED: { status: 400, message: 'ดำเนินการได้เฉพาะขณะอยู่ในขั้นตะกร้า' },
  AUTH_FORBIDDEN: { status: 403, message: 'ไม่มีสิทธิ์เพิ่มสินค้าในตะกร้า' },
} as const;

type StateRow = { stage: Cart['stage']; current_order_id: string | null; coupon_code: string | null };
type ProductRow = { product_id: string; name: string; price: number; weight_gram: number;
  available_stock: string; status: 'onSale' | 'offSale' };
type LineRow = ProductRow & { quantity: number };

function businessError(code: keyof typeof domainErrors, details?: Record<string, unknown>): never {
  const error = domainErrors[code];
  throw new CartServiceError(error.status, code, error.message, details);
}

/** PostgreSQL stores rows; checkout arithmetic and decisions execute in TypeScript. */
export class PostgresCartRepository implements CartRepository {
  constructor(private readonly database: Database) {}

  private async write<T>(customerId: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(async client => {
        await client.query('select pg_advisory_xact_lock(hashtextextended($1::text, 0))', [customerId]);
        return run(client);
      });
    } catch (error) {
      if (error instanceof CartServiceError) throw error;
      throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้', undefined, 'upstream');
    }
  }

  private async state(client: PoolClient, customerId: string, lock = false): Promise<StateRow> {
    const result = await client.query<StateRow>(
      `select stage, current_order_id, coupon_code from public.customer_state
       where customer_id = $1 ${lock ? 'for update' : ''}`, [customerId]);
    return result.rows[0] ?? { stage: 'cart', current_order_id: null, coupon_code: null };
  }

  private async lines(client: PoolClient, customerId: string, lock = false): Promise<LineRow[]> {
    const result = await client.query<LineRow>(
      `select c.quantity, p.product_id, p.name, p.price, p.weight_gram, p.available_stock, p.status
       from public.cart_lines c join public.products p on p.product_id = c.product_id
       where c.customer_id = $1 order by p.product_id ${lock ? 'for update of c, p' : ''}`, [customerId]);
    return result.rows;
  }

  private async cart(client: PoolClient, customerId: string): Promise<Cart> {
    const state = await this.state(client, customerId);
    const rows = await this.lines(client, customerId);
    const lines: CartLine[] = rows.map(row => ({ productId: row.product_id, name: row.name,
      unitPrice: row.price, weightGram: row.weight_gram, quantity: row.quantity,
      available: isProductAvailable(row.status === 'onSale', Number(row.available_stock)) }));
    return { stage: state.stage, currentOrderId: state.current_order_id,
      couponCode: state.coupon_code, lineCount: lines.length,
      checkoutEnabled: lines.length > 0 && state.stage === 'cart',
      subtotal: calculateSubtotal(lines.map(line => ({ price: line.unitPrice, quantity: line.quantity }))), lines };
  }

  async viewCart(customerId: string): Promise<Cart> {
    try { return await this.database.transaction(client => this.cart(client, customerId)); }
    catch { throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้', undefined, 'upstream'); }
  }

  async addItem(customerId: string, productId: string, quantity: unknown): Promise<Cart> {
    return this.write(customerId, async client => {
      const state = await this.state(client, customerId, true);
      if (state.stage !== 'cart') businessError('OPERATION_NOT_ALLOWED');
      const product = (await client.query<ProductRow>(
        'select product_id, name, price, weight_gram, available_stock, status from public.products where product_id = $1 for share',
        [productId])).rows[0];
      const existing = (await client.query<{ quantity: number }>(
        'select quantity from public.cart_lines where customer_id = $1 and product_id = $2 for update',
        [customerId, productId])).rows[0];
      const decision = validateQuantityChange({ operation: 'add', quantity,
        productExists: !!product, inCart: !!existing,
        available: !!product && isProductAvailable(product.status === 'onSale', Number(product.available_stock)),
        currentQtyInCart: existing?.quantity ?? 0, availableStock: Number(product?.available_stock ?? 0) });
      if (decision !== 'OK') businessError(decision);
      await client.query(`insert into public.customer_state(customer_id, stage, coupon_code, current_order_id)
        values ($1, 'cart', null, null) on conflict (customer_id) do nothing`, [customerId]);
      await client.query(`insert into public.cart_lines(customer_id, product_id, quantity)
        values ($1, $2, $3) on conflict (customer_id, product_id)
        do update set quantity = excluded.quantity`, [customerId, productId, (existing?.quantity ?? 0) + (quantity as number)]);
      return this.cart(client, customerId);
    });
  }

  async updateQuantity(customerId: string, productId: string, quantity: unknown): Promise<Cart> {
    return this.write(customerId, async client => {
      const state = await this.state(client, customerId, true);
      if (state.stage !== 'cart') businessError('OPERATION_NOT_ALLOWED');
      const existing = (await client.query<{ quantity: number }>(
        'select quantity from public.cart_lines where customer_id = $1 and product_id = $2 for update',
        [customerId, productId])).rows[0];
      const product = existing ? (await client.query<ProductRow>(
        'select product_id, name, price, weight_gram, available_stock, status from public.products where product_id = $1 for share',
        [productId])).rows[0] : undefined;
      const decision = validateQuantityChange({ operation: 'update', quantity,
        productExists: !!product, inCart: !!existing,
        available: !!product && isProductAvailable(product.status === 'onSale', Number(product.available_stock)),
        currentQtyInCart: existing?.quantity ?? 0, availableStock: Number(product?.available_stock ?? 0) });
      if (decision !== 'OK') businessError(decision);
      await client.query('update public.cart_lines set quantity = $3 where customer_id = $1 and product_id = $2',
        [customerId, productId, quantity]);
      return this.cart(client, customerId);
    });
  }

  async removeItem(customerId: string, productId: string): Promise<Cart> {
    return this.write(customerId, async client => {
      const state = await this.state(client, customerId, true);
      if (state.stage !== 'cart') businessError('OPERATION_NOT_ALLOWED');
      const count = await client.query('select product_id from public.cart_lines where customer_id = $1', [customerId]);
      if (count.rowCount === 0) businessError('CART_EMPTY');
      const result = await client.query('delete from public.cart_lines where customer_id = $1 and product_id = $2',
        [customerId, productId]);
      if (result.rowCount === 0) businessError('ITEM_NOT_IN_CART');
      return this.cart(client, customerId);
    });
  }

  async applyCoupon(customerId: string, code: string): Promise<Cart> {
    return this.write(customerId, async client => {
      const state = await this.state(client, customerId, true);
      if (state.stage !== 'cart') businessError('OPERATION_NOT_ALLOWED');
      const coupon = await client.query<{ status: string }>(
        'select status from public.coupons where code = $1 for share', [code]);
      if (coupon.rows[0]?.status !== 'active') businessError('COUPON_INVALID');
      await client.query(`insert into public.customer_state(customer_id, stage, coupon_code, current_order_id)
        values ($1, 'cart', $2, null) on conflict (customer_id) do update set coupon_code = excluded.coupon_code`,
      [customerId, code]);
      return this.cart(client, customerId);
    });
  }

  private async order(client: PoolClient, orderId: string): Promise<Record<string, unknown> & { orderId: string; status: 'pending' | 'cancelled' }> {
    const row = (await client.query<{
      order_id: string; created_at: Date; status: 'pending' | 'cancelled'; subtotal: string;
      discount: string; shipping_fee: string; net_total: string; zone: string; speed: string;
      coupon_code: string | null; discount_source: string; total_weight_gram: string;
    }>(`select order_id, created_at, status, subtotal, discount, shipping_fee, net_total,
      zone, speed, coupon_code, discount_source, total_weight_gram
      from public.orders where order_id = $1`, [orderId])).rows[0];
    if (!row) throw new Error('Missing order after mutation');
    const lines = await client.query<{ product_id: string; name_snapshot: string; unit_price: number;
      quantity: number; weight_gram: number }>(
      'select product_id, name_snapshot, unit_price, quantity, weight_gram from public.order_lines where order_id = $1 order by product_id',
      [orderId]);
    return { orderId: row.order_id, createdAt: row.created_at.toISOString(), status: row.status,
      subtotal: Number(row.subtotal), discount: Number(row.discount), shippingFee: Number(row.shipping_fee),
      netTotal: Number(row.net_total), zone: row.zone, speed: row.speed, couponCode: row.coupon_code,
      discountSource: row.discount_source, totalWeightGram: Number(row.total_weight_gram),
      lines: lines.rows.map(line => ({ productId: line.product_id, name: line.name_snapshot,
        unitPrice: line.unit_price, quantity: line.quantity, weightGram: line.weight_gram })) };
  }

  async checkout(customerId: string, zone: unknown, speed: unknown,
    calculateQuote: (facts: CheckoutFacts, zone: unknown, speed: unknown) => CheckoutQuote): Promise<CheckoutResult> {
    return this.write(customerId, async client => {
      const user = (await client.query<{ username: string; role: string; member_tier: 'normal' | 'prime' }>(
        'select username, role, member_tier from public.app_users where id = $1 for share', [customerId])).rows[0];
      if (user?.role !== 'Customer') businessError('AUTH_FORBIDDEN');
      const state = await this.state(client, customerId, true);
      if (state.stage !== 'cart') businessError('OPERATION_NOT_ALLOWED');
      const rows = await this.lines(client, customerId, true);
      const coupon = state.coupon_code ? (await client.query<{ percent: number; min_spend: number;
        status: 'active' | 'inactive' }>(
        'select percent, min_spend, status from public.coupons where code = $1 for share',
        [state.coupon_code])).rows[0] : undefined;
      const facts: CheckoutFacts = { customer: { userId: customerId, username: user.username,
        memberTier: user.member_tier, stage: 'cart', couponCode: state.coupon_code },
        lines: rows.map(row => ({ productId: row.product_id, name: row.name,
          price: row.price, weightGram: row.weight_gram, quantity: row.quantity,
          availableStock: Number(row.available_stock), status: row.status })),
        coupon: coupon ? { percent: coupon.percent, minSpend: coupon.min_spend, status: coupon.status } : null };
      const quote = calculateQuote(facts, zone, speed);
      const inserted = await client.query<{ order_id: string }>(`insert into public.orders
        (owner_id, status, subtotal, discount, shipping_fee, net_total, zone, speed,
         coupon_code, discount_source, total_weight_gram)
        values ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10) returning order_id`,
        [customerId, quote.subtotal, quote.discount, quote.shippingFee, quote.netTotal,
          zone, speed, quote.couponCode, quote.discountSource, quote.totalWeightGram]);
      const orderId = inserted.rows[0]?.order_id;
      if (!orderId) throw new Error('Order insert failed');
      for (const row of rows) {
        await client.query(`insert into public.order_lines
          (order_id, product_id, name_snapshot, unit_price, quantity, weight_gram)
          values ($1, $2, $3, $4, $5, $6)`,
        [orderId, row.product_id, row.name, row.price, row.quantity, row.weight_gram]);
        await client.query('update public.products set available_stock = $2 where product_id = $1',
          [row.product_id, Number(row.available_stock) - row.quantity]);
      }
      await client.query(`update public.customer_state set stage = 'checkout', current_order_id = $2,
        coupon_code = case when $3 then null else coupon_code end where customer_id = $1`,
        [customerId, orderId, quote.couponRemoved]);
      return { customer: { userId: customerId, username: user.username, role: 'Customer',
        memberTier: user.member_tier, stage: 'checkout', currentOrderId: orderId },
        order: await this.order(client, orderId) as CheckoutResult['order'],
        couponRemoved: quote.couponRemoved };
    });
  }

  async cancelCheckout(customerId: string): Promise<CancelResult> {
    return this.write(customerId, async client => {
      const state = await this.state(client, customerId, true);
      if (state.stage !== 'checkout' || !state.current_order_id) businessError('OPERATION_NOT_ALLOWED');
      const orderId = state.current_order_id;
      const order = (await client.query<{ status: string }>(
        'select status from public.orders where order_id = $1 and owner_id = $2 for update',
        [orderId, customerId])).rows[0];
      if (order?.status !== 'pending') businessError('OPERATION_NOT_ALLOWED');
      const lines = await client.query<{ product_id: string; quantity: number }>(
        'select product_id, quantity from public.order_lines where order_id = $1 order by product_id', [orderId]);
      for (const line of lines.rows) {
        const stock = (await client.query<{ available_stock: string }>(
          'select available_stock from public.products where product_id = $1 for update',
          [line.product_id])).rows[0];
        if (!stock) throw new Error('Missing reserved product');
        await client.query('update public.products set available_stock = $2 where product_id = $1',
          [line.product_id, Number(stock.available_stock) + line.quantity]);
      }
      await client.query("update public.orders set status = 'cancelled' where order_id = $1", [orderId]);
      await client.query("update public.customer_state set stage = 'cart', current_order_id = null where customer_id = $1", [customerId]);
      return { cart: await this.cart(client, customerId), order: await this.order(client, orderId) as CancelResult['order'] };
    });
  }
}
