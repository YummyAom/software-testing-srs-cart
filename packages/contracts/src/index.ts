// Wire DTOs follow docs/api/openapi.json and docs/spec/03-api-contract.md.
// Numeric bounds, UUID formats and conditional role invariants require runtime validation.
export type Role = 'Customer' | 'Admin';
export type MemberTier = 'normal' | 'prime';
export type Stage = 'cart' | 'checkout' | 'success';
export type ProductStatus = 'onSale' | 'offSale';
export type CouponStatus = 'active' | 'inactive';
export type OrderStatus = 'pending' | 'paid' | 'cancelled';
export type Zone = 'inCity' | 'upcountry' | 'remote';
export type Speed = 'standard' | 'express';
export type DiscountSource = 'coupon' | 'member' | 'none';

export interface Message {
  kind: 'notice' | 'info';
  code: string;
  message: string;
}

export interface SuccessResponse<T> {
  data: T;
  messages: Message[];
}

// OpenAPI permits non-domain infrastructure codes; keep the general error envelope open.
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface UserState {
  userId: string;
  username: string;
  role: Role;
  memberTier: MemberTier | null;
  stage: Stage | null;
  currentOrderId: string | null;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserState;
}

export interface Product {
  productId: string;
  name: string;
  price: number;
  weightGram: number;
  availableStock: number;
}

export interface AdminProduct extends Product {
  status: ProductStatus;
}

export interface Coupon {
  code: string;
  percent: number;
  minSpend: number;
  status: CouponStatus;
}

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  weightGram: number;
  quantity: number;
  available: boolean;
}

export interface Cart {
  stage: Stage;
  currentOrderId: string | null;
  couponCode: string | null;
  lineCount: number;
  checkoutEnabled: boolean;
  subtotal: number;
  lines: CartLine[];
}

export interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  weightGram: number;
}

export interface OrderSummary {
  orderId: string;
  createdAt: string;
  status: OrderStatus;
  netTotal: number;
}

export interface Order extends OrderSummary {
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  zone: Zone;
  speed: Speed;
  couponCode: string | null;
  discountSource: DiscountSource;
  totalWeightGram: number;
}

export interface ProductsResult {
  products: (Product | AdminProduct)[];
}

export interface CouponsResult {
  coupons: Coupon[];
}

export interface OrdersResult {
  orders: OrderSummary[];
}

export interface CheckoutResult {
  customer: UserState;
  order: Order;
}

export interface CancelCheckoutResult {
  cart: Cart;
  order: Order;
}

export interface ResetResult {
  reset: true;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// Raw values must reach the ordered domain checks without coercion or early type rejection.
export interface AddItemRequest {
  productId: string;
  quantity: unknown;
}

export interface UpdateQuantityRequest {
  quantity: unknown;
}

export interface ApplyCouponRequest {
  code: string;
}

export interface CheckoutRequest {
  zone: unknown;
  speed: unknown;
}

export interface PaySuccessRequest {
  result: 'success';
}

export interface PayFailRequest {
  result: 'fail';
}

export interface UpdateProductRequest {
  price?: unknown;
  stock?: unknown;
}

export interface SetStatusRequest {
  status: unknown;
}

export interface ProductIdParams {
  productId: string;
}

export interface OrderIdParams {
  orderId: string;
}

export interface CouponCodeParams {
  code: string;
}

// All 16 SRS section 5 codes, mapped by the API workbook's shared status table.
export const DOMAIN_ERROR_HTTP_STATUS = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_REQUIRED: 401,
  AUTH_FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  QTY_OUT_OF_RANGE: 400,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 400,
  INSUFFICIENT_STOCK: 400,
  ITEM_NOT_IN_CART: 404,
  CART_EMPTY: 400,
  COUPON_INVALID: 400,
  ITEMS_UNAVAILABLE: 400,
  WEIGHT_LIMIT_EXCEEDED: 400,
  OPERATION_NOT_ALLOWED: 400,
  ORDER_NOT_FOUND: 404,
  COUPON_NOT_FOUND: 404,
} as const;

export type DomainErrorCode = keyof typeof DOMAIN_ERROR_HTTP_STATUS;

// Exact required SRS texts; other descriptions are not specified as exact literals.
export const REQUIRED_MESSAGES = {
  removeEmptyCart: 'ไม่มีสินค้าให้ลบ',
  removeAbsentItem: 'ไม่พบสินค้าในตะกร้า',
  cartEmptied: 'ตะกร้าว่าง',
  checkoutEmptyCart: 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง',
  couponNotApplicable: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้',
  paymentFailed: 'การชำระเงินล้มเหลว กรุณาลองใหม่',
} as const;

export const COUPON_NOT_APPLICABLE = 'COUPON_NOT_APPLICABLE';
