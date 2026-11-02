import { OrderRepositoryError } from '../order-error.js';
import type { OrderRepository } from '../order-types.js';

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  private assertOrderId(orderId: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      throw new OrderRepositoryError(404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์');
    }
  }

  findOwned(customerId: string, orderId: string) {
    this.assertOrderId(orderId);
    return this.repository.findOwned(customerId, orderId);
  }

  listOwned(customerId: string) {
    return this.repository.listOwned(customerId);
  }

  paySuccess(orderId: string) {
    this.assertOrderId(orderId);
    return this.repository.paySuccess(orderId);
  }

  payFail(orderId: string) {
    this.assertOrderId(orderId);
    return this.repository.payFail(orderId);
  }
}
