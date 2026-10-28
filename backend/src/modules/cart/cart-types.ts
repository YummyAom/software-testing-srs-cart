import type { CheckoutFacts, CheckoutQuote } from './checkout-types.js';

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  weightGram: number;
  quantity: number;
  available: boolean;
}

export interface Cart {
  stage: 'cart' | 'checkout' | 'success';
  currentOrderId: string | null;
  couponCode: string | null;
  lineCount: number;
  checkoutEnabled: boolean;
  subtotal: number;
  lines: CartLine[];
}

export interface CheckoutResult {
  customer: { userId: string; stage: 'checkout'; currentOrderId: string };
  order: Record<string, unknown> & { orderId: string; status: 'pending' };
  couponRemoved: boolean;
}

export interface CancelResult {
  cart: Cart;
  order: Record<string, unknown> & { orderId: string; status: 'cancelled' };
}

export interface CartRepository {
  addItem(customerId: string, productId: string, quantity: unknown): Promise<Cart>;
  updateQuantity(customerId: string, productId: string, quantity: unknown): Promise<Cart>;
  removeItem(customerId: string, productId: string): Promise<Cart>;
  applyCoupon(customerId: string, code: string): Promise<Cart>;
  viewCart(customerId: string): Promise<Cart>;
  checkout(customerId: string, zone: unknown, speed: unknown,
    calculateQuote: (facts: CheckoutFacts, zone: unknown, speed: unknown) => CheckoutQuote): Promise<CheckoutResult>;
  cancelCheckout(customerId: string): Promise<CancelResult>;
}
