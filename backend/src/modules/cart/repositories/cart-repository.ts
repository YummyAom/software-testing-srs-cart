import type { SupabaseAuthConfig } from '../../../interfaces/config.js';

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

export class CartServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string,
    readonly details?: Record<string, unknown>,
    readonly reason?: 'timeout' | 'transport' | 'upstream' | 'invalid_response',
    readonly permissionTarget?: string) { super(message); }
}

export interface CartRepository {
  addItem(accessToken: string, productId: string, quantity: unknown): Promise<Cart>;
  updateQuantity(accessToken: string, productId: string, quantity: unknown): Promise<Cart>;
  removeItem(accessToken: string, productId: string): Promise<Cart>;
  applyCoupon(accessToken: string, code: string): Promise<Cart>;
  viewCart(accessToken: string): Promise<Cart>;
  checkout(accessToken: string, zone: unknown, speed: unknown): Promise<CheckoutResult>;
  cancelCheckout(accessToken: string): Promise<CancelResult>;
}

function isCart(value: unknown): value is Cart {
  if (!value || typeof value !== 'object') return false;
  const cart = value as Record<string, unknown>;
  return (cart.stage === 'cart' || cart.stage === 'checkout' || cart.stage === 'success')
    && (cart.currentOrderId === null || typeof cart.currentOrderId === 'string')
    && (cart.couponCode === null || typeof cart.couponCode === 'string')
    && Number.isSafeInteger(cart.lineCount) && typeof cart.checkoutEnabled === 'boolean'
    && Number.isSafeInteger(cart.subtotal) && Array.isArray(cart.lines)
    && cart.lines.every((line: unknown) => {
      if (!line || typeof line !== 'object') return false;
      const item = line as Record<string, unknown>;
      return typeof item.productId === 'string' && typeof item.name === 'string'
        && Number.isSafeInteger(item.unitPrice) && Number.isSafeInteger(item.weightGram)
        && Number.isSafeInteger(item.quantity) && typeof item.available === 'boolean';
    });
}

export class SupabaseCartRepository implements CartRepository {
  constructor(private readonly config: SupabaseAuthConfig) {}

  async addItem(accessToken: string, productId: string, quantity: unknown): Promise<Cart> {
    return this.callCartRpc('cart_add_item', accessToken, { p_product_id: productId, p_quantity: quantity }, isCart);
  }

  async updateQuantity(accessToken: string, productId: string, quantity: unknown): Promise<Cart> {
    return this.callCartRpc('cart_update_quantity', accessToken, { p_product_id: productId, p_quantity: quantity }, isCart);
  }

  async removeItem(accessToken: string, productId: string): Promise<Cart> {
    return this.callCartRpc('cart_remove_item', accessToken, { p_product_id: productId }, isCart);
  }

  async applyCoupon(accessToken: string, code: string): Promise<Cart> {
    return this.callCartRpc('cart_apply_coupon', accessToken, { p_code: code }, isCart);
  }

  async viewCart(accessToken: string): Promise<Cart> {
    return this.callCartRpc('cart_view', accessToken, {}, isCart);
  }

  async checkout(accessToken: string, zone: unknown, speed: unknown): Promise<CheckoutResult> {
    return this.callCartRpc('cart_press_checkout', accessToken, { p_zone: zone, p_speed: speed },
      (value): value is CheckoutResult => !!value && typeof value === 'object'
        && 'customer' in value && !!value.customer && typeof value.customer === 'object'
        && 'order' in value && !!value.order && typeof value.order === 'object'
        && 'couponRemoved' in value && typeof value.couponRemoved === 'boolean');
  }

  async cancelCheckout(accessToken: string): Promise<CancelResult> {
    return this.callCartRpc('cart_cancel_checkout', accessToken, {},
      (value): value is CancelResult => !!value && typeof value === 'object'
        && 'cart' in value && isCart(value.cart)
        && 'order' in value && !!value.order && typeof value.order === 'object');
  }

  private async callCartRpc<T>(name: string, accessToken: string, parameters: Record<string, unknown>,
    validate: (value: unknown) => value is T): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(`/rest/v1/rpc/${name}`, this.config.url), {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey, Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json', Accept: 'application/json',
        },
        body: JSON.stringify(parameters),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'transport';
      throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้', undefined, reason);
    }
    if (!response.ok) {
      // PostgREST reports missing RPCs, tables and grants with different codes.
      // Keep its message private, but expose the status/code needed to diagnose setup.
      let upstreamCode: string | undefined;
      let permissionTarget: string | undefined;
      try {
        const error: unknown = await response.json();
        if (error && typeof error === 'object' && 'code' in error
          && typeof error.code === 'string' && /^[A-Z0-9]{5,8}$/.test(error.code)) {
          upstreamCode = error.code;
        }
        if (upstreamCode === '42501' && error && typeof error === 'object'
          && 'message' in error && typeof error.message === 'string') {
          // Record only an SQL identifier, never the upstream message or user data.
          permissionTarget = /^(?:permission denied for (?:table|schema|function|sequence|relation) |new row violates row-level security policy for table ")([a-z_][a-z0-9_.]*)/i
            .exec(error.message)?.[1];
        }
      } catch { /* A non-JSON upstream error still has a useful HTTP status. */ }
      throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้',
        { upstreamStatus: response.status, ...(upstreamCode ? { upstreamCode } : {}),
          ...(permissionTarget ? { permissionTarget } : {}) }, 'upstream', permissionTarget);
    }
    let result: unknown;
    try { result = await response.json(); } catch {
      throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลตะกร้าได้', undefined, 'invalid_response');
    }
    if (result && typeof result === 'object' && 'error' in result) {
      const code = result.error;
      if (typeof code === 'string' && Object.hasOwn(domainErrors, code)) {
        const detail = domainErrors[code as keyof typeof domainErrors];
        const message = code === 'CART_EMPTY' && name === 'cart_press_checkout'
          ? 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง' : detail.message;
        throw new CartServiceError(detail.status, code, message,
          code === 'ITEMS_UNAVAILABLE' && 'productIds' in result && Array.isArray(result.productIds)
            ? { productIds: result.productIds } : undefined);
      }
      throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้', undefined, 'invalid_response');
    }
    if (!validate(result)) throw new CartServiceError(503, 'CART_UNAVAILABLE', 'ข้อมูลตะกร้าไม่ถูกต้อง', undefined, 'invalid_response');
    return result;
  }
}
