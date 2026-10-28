import type { CartRepository } from '../cart-types.js';
import { calculateCheckoutQuote } from './checkout-pricing.js';

export class CartService {
  constructor(private readonly repository: CartRepository) {}

  addItem(customerId: string, productId: string, quantity: unknown) {
    return this.repository.addItem(customerId, productId, quantity);
  }

  updateQuantity(customerId: string, productId: string, quantity: unknown) {
    return this.repository.updateQuantity(customerId, productId, quantity);
  }

  removeItem(customerId: string, productId: string) {
    return this.repository.removeItem(customerId, productId);
  }

  applyCoupon(customerId: string, code: string) {
    return this.repository.applyCoupon(customerId, code);
  }

  viewCart(customerId: string) {
    return this.repository.viewCart(customerId);
  }

  checkout(customerId: string, zone: unknown, speed: unknown) {
    return this.repository.checkout(customerId, zone, speed, calculateCheckoutQuote);
  }

  cancelCheckout(customerId: string) {
    return this.repository.cancelCheckout(customerId);
  }
}
