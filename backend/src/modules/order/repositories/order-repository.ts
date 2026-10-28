import type { Database } from '../../../database.js';
import { OrderRepositoryError } from '../order-error.js';
import type { Order, OrderRepository } from '../order-types.js';

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  async findOwned(customerId: string, orderId: string): Promise<Order> {
    try {
      const result = await this.database.query<{
        order_id: string; created_at: Date; status: Order['status']; subtotal: string;
        discount: string; shipping_fee: string; net_total: string; zone: Order['zone'];
        speed: Order['speed']; coupon_code: string | null; discount_source: Order['discountSource'];
        total_weight_gram: string;
      }>(`select order_id, created_at, status, subtotal, discount, shipping_fee, net_total,
          zone, speed, coupon_code, discount_source, total_weight_gram
        from public.orders where order_id = $1 and owner_id = $2`, [orderId, customerId]);
      const row = result.rows[0];
      if (!row) throw new OrderRepositoryError(404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์');
      const lines = await this.database.query<{
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
    } catch (error) {
      if (error instanceof OrderRepositoryError) throw error;
      throw new OrderRepositoryError(503, 'ORDER_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลออเดอร์ได้');
    }
  }
}
