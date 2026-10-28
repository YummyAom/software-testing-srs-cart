import { OrderRepositoryError } from '../order-error.js';
import type { OrderRepository } from '../order-types.js';

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  findOwned(customerId: string, orderId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      throw new OrderRepositoryError(404, 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์');
    }
    return this.repository.findOwned(customerId, orderId);
  }
}
