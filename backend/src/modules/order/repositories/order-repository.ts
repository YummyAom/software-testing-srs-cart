import type { Database } from '../../../database.js';
import { OrderRepositoryError } from '../order-error.js';
import type { Order, OrderRepository, OrderSummary, PaymentResult } from '../order-types.js';

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  private async fetchOrder(client: { query: Database['query'] }, orderId: string, customerId?: string): Promise<Order> {
    const whereSql = customerId !== undefined
      ? 'from public.orders where order_id = $1 and owner_id = $2'
      : 'from public.orders where order_id = $1';
    const params = customerId !== undefined ? [orderId, customerId] : [orderId];

    const result = await client.query<{
      order_id: string; created_at: Date; status: Order['status']; subtotal: string;
      discount: string; shipping_fee: string; net_total: string; zone: Order['zone'];
      speed: Order['speed']; coupon_code: string | null; discount_source: Order['discountSource'];
      total_weight_gram: string;
    }>(`select order_id, created_at, status, subtotal, discount, shipping_fee, net_total,
        zone, speed, coupon_code, discount_source, total_weight_gram
      ${whereSql}`, params);
    const row = result.rows[0];
    if (!row) throw new OrderRepositoryError(404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์');
    const lines = await client.query<{
      product_id: string; name_snapshot: string; unit_price: number; quantity: number; weight_gram: number;
    }>(`select product_id, name_snapshot, unit_price, quantity, weight_gram
      from public.order_lines where order_id = $1 order by product_id`, [orderId]);
    return {
      orderId: row.order_id, createdAt: row.created_at.toISOString(), status: row.status,
      subtotal: Number(row.subtotal), discount: Number(row.discount),
      shippingFee: Number(row.shipping_fee), netTotal: Number(row.net_total),
      zone: row.zone, speed: row.speed, couponCode: row.coupon_code,
      discountSource: row.discount_source, totalWeightGram: Number(row.total_weight_gram),
      lines: lines.rows.map(line => ({ productId: line.product_id, name: line.name_snapshot,
        unitPrice: line.unit_price, quantity: line.quantity, weightGram: line.weight_gram })),
    };
  }

  async findOwned(customerId: string, orderId: string): Promise<Order> {
    try {
      return await this.fetchOrder(this.database, orderId, customerId);
    } catch (error) {
      if (error instanceof OrderRepositoryError) throw error;
      throw new OrderRepositoryError(503, 'ORDER_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลออเดอร์ได้');
    }
  }

  async listOwned(customerId: string): Promise<OrderSummary[]> {
    try {
      const result = await this.database.query<{
        order_id: string; created_at: Date; status: Order['status']; net_total: string;
      }>('select order_id, created_at, status, net_total from public.orders where owner_id = $1 order by created_at desc, sequence desc', [customerId]);
      return result.rows.map(row => ({
        orderId: row.order_id,
        createdAt: row.created_at.toISOString(),
        status: row.status,
        netTotal: Number(row.net_total),
      }));
    } catch {
      throw new OrderRepositoryError(503, 'ORDER_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลรายการคำสั่งซื้อได้');
    }
  }

  async paySuccess(orderId: string): Promise<PaymentResult> {
    try {
      return await this.database.transaction(async client => {
        const orderRow = (await client.query<{
          order_id: string; owner_id: string; status: Order['status'];
        }>('select order_id, owner_id, status from public.orders where order_id = $1 for update', [orderId])).rows[0];
        if (!orderRow) {
          throw new OrderRepositoryError(404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์');
        }
        if (orderRow.status !== 'pending') {
          throw new OrderRepositoryError(400, 'OPERATION_NOT_ALLOWED', 'ดำเนินการได้เฉพาะออเดอร์ที่รอชำระเงิน');
        }

        const stateRow = (await client.query<{
          stage: 'cart' | 'checkout' | 'success'; current_order_id: string | null;
        }>('select stage, current_order_id from public.customer_state where customer_id = $1 for update', [orderRow.owner_id])).rows[0];
        if (!stateRow || stateRow.stage !== 'checkout' || stateRow.current_order_id !== orderId) {
          throw new OrderRepositoryError(400, 'OPERATION_NOT_ALLOWED', 'ดำเนินการได้เฉพาะขณะอยู่ในขั้นชำระเงิน');
        }

        await client.query("update public.orders set status = 'paid' where order_id = $1", [orderId]);
        await client.query('delete from public.cart_lines where customer_id = $1', [orderRow.owner_id]);
        await client.query("update public.customer_state set stage = 'success', coupon_code = null where customer_id = $1", [orderRow.owner_id]);

        const user = (await client.query<{
          username: string; role: 'Customer' | 'Admin'; member_tier: 'normal' | 'prime' | null;
        }>('select username, role, member_tier from public.app_users where id = $1', [orderRow.owner_id])).rows[0];
        if (!user) throw new Error('Missing customer profile');

        const order = await this.fetchOrder(client, orderId);
        return {
          customer: {
            userId: orderRow.owner_id,
            username: user.username,
            role: user.role,
            memberTier: user.member_tier,
            stage: 'success',
            currentOrderId: orderId,
          },
          order,
        };
      });
    } catch (error) {
      if (error instanceof OrderRepositoryError) throw error;
      throw new OrderRepositoryError(503, 'ORDER_UNAVAILABLE', 'ไม่สามารถบันทึกผลการชำระเงินได้');
    }
  }

  async payFail(orderId: string): Promise<PaymentResult> {
    try {
      return await this.database.transaction(async client => {
        const orderRow = (await client.query<{
          order_id: string; owner_id: string; status: Order['status'];
        }>('select order_id, owner_id, status from public.orders where order_id = $1 for update', [orderId])).rows[0];
        if (!orderRow) {
          throw new OrderRepositoryError(404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์');
        }
        if (orderRow.status !== 'pending') {
          throw new OrderRepositoryError(400, 'OPERATION_NOT_ALLOWED', 'ดำเนินการได้เฉพาะออเดอร์ที่รอชำระเงิน');
        }

        const stateRow = (await client.query<{
          stage: 'cart' | 'checkout' | 'success'; current_order_id: string | null;
        }>('select stage, current_order_id from public.customer_state where customer_id = $1 for update', [orderRow.owner_id])).rows[0];
        if (!stateRow || stateRow.stage !== 'checkout' || stateRow.current_order_id !== orderId) {
          throw new OrderRepositoryError(400, 'OPERATION_NOT_ALLOWED', 'ดำเนินการได้เฉพาะขณะอยู่ในขั้นชำระเงิน');
        }

        const user = (await client.query<{
          username: string; role: 'Customer' | 'Admin'; member_tier: 'normal' | 'prime' | null;
        }>('select username, role, member_tier from public.app_users where id = $1', [orderRow.owner_id])).rows[0];
        if (!user) throw new Error('Missing customer profile');

        const order = await this.fetchOrder(client, orderId);
        return {
          customer: {
            userId: orderRow.owner_id,
            username: user.username,
            role: user.role,
            memberTier: user.member_tier,
            stage: 'checkout',
            currentOrderId: orderId,
          },
          order,
        };
      });
    } catch (error) {
      if (error instanceof OrderRepositoryError) throw error;
      throw new OrderRepositoryError(503, 'ORDER_UNAVAILABLE', 'ไม่สามารถบันทึกผลการชำระเงินได้');
    }
  }
}
