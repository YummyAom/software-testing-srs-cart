export interface UserProfile {
  userId?: string;
  id?: string;
  username: string;
  email: string;
  role: 'admin' | 'customer';
  memberTier: 'free' | 'prime';
}

export interface LoginSession {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

export interface UserState {
  userId: string;
  username: string;
  role: 'Customer' | 'Admin' | 'customer' | 'admin';
  memberTier: 'normal' | 'prime' | 'free' | null;
  stage: 'cart' | 'checkout' | 'success' | null;
  currentOrderId: string | null;
}

export interface Product {
  productId: string;
  name: string;
  price: number;
  weightGram: number;
  availableStock: number;
  status?: 'onSale' | 'offSale';
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
  stage: 'cart' | 'checkout' | 'success';
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
  weightGram?: number;
  lineTotal?: number;
}

export interface Order {
  orderId: string;
  createdAt: string;
  status: 'pending' | 'paid' | 'cancelled';
  subtotal: number;
  discount: number;
  shippingFee: number;
  netTotal: number;
  zone: 'inCity' | 'upcountry' | 'remote';
  speed: 'standard' | 'express';
  couponCode: string | null;
  discountSource: 'coupon' | 'member' | 'none';
  totalWeightGram: number;
  lines: OrderLine[];
}

export interface OrderSummary {
  orderId: string;
  createdAt: string;
  status: 'pending' | 'paid' | 'cancelled';
  netTotal: number;
}

export interface Coupon {
  code: string;
  percent: number;
  minSpend: number;
  status: 'active' | 'inactive';
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/** Fired after any call that can change the cart's line count, so the nav badge can refresh. */
export const CART_CHANGED_EVENT = 'cart-changed';
function notifyCartChanged(): void {
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; messages: any[] }> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const json = await response.json();

  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
    throw new ApiError(errorData.message, errorData.code, response.status, errorData.details);
  }

  return json;
}

export async function loginApi(username: string, password: string): Promise<LoginSession> {
  const res = await request<LoginSession>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.data;
}

export async function getAuthMeApi(token: string): Promise<UserState> {
  const res = await request<UserState>('/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.data;
}

export async function getProductsApi(token?: string): Promise<Product[]> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await request<{ products: Product[] }>('/products', { headers });
  return res.data.products;
}

export async function getCartApi(token: string): Promise<Cart> {
  const res = await request<Cart>('/cart', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.data;
}

export async function addCartItemApi(token: string, productId: string, quantity: number): Promise<Cart> {
  const res = await request<Cart>('/cart/items', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, quantity }),
  });
  notifyCartChanged();
  return res.data;
}

export async function updateCartItemQtyApi(token: string, productId: string, quantity: number): Promise<Cart> {
  const res = await request<Cart>(`/cart/items/${productId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quantity }),
  });
  notifyCartChanged();
  return res.data;
}

export async function removeCartItemApi(token: string, productId: string): Promise<Cart> {
  const res = await request<Cart>(`/cart/items/${productId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  notifyCartChanged();
  return res.data;
}

export async function applyCartCouponApi(token: string, code: string): Promise<Cart> {
  const res = await request<Cart>('/cart/coupon', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });
  return res.data;
}

/** A response message from api-server, e.g. the COUPON_NOT_APPLICABLE notice (FR-4.3.2). */
export interface ApiMessage {
  kind: 'error' | 'notice' | 'info';
  code: string;
  message: string;
}

export async function checkoutCartApi(token: string, zone: string, speed: string): Promise<{ customer: any; order: Order; messages: ApiMessage[] }> {
  const res = await request<{ customer: any; order: Order }>('/cart/checkout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ zone, speed }),
  });
  return { ...res.data, messages: res.messages ?? [] };
}

export async function cancelCheckoutApi(token: string): Promise<any> {
  const res = await request<any>('/cart/checkout', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  notifyCartChanged();
  return res.data;
}

export async function paySuccessApi(orderId: string): Promise<any> {
  const res = await request(`/orders/${orderId}/pay-success`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'success' }),
  });
  notifyCartChanged();
  return res;
}

export async function payFailApi(orderId: string): Promise<any> {
  return request(`/orders/${orderId}/pay-fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'fail' }),
  });
}

export async function continueShoppingApi(token: string): Promise<any> {
  const res = await request<any>('/cart/continue', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  notifyCartChanged();
  return res.data;
}

export async function getOrdersApi(token: string): Promise<OrderSummary[]> {
  const res = await request<{ orders: OrderSummary[] }>('/orders', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.data.orders;
}

export async function getOrderApi(token: string, orderId: string): Promise<Order> {
  const res = await request<Order>(`/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.data;
}

export async function updateAdminProductApi(
  token: string,
  productId: string,
  patch: { price?: number; stock?: number }
): Promise<Product> {
  const res = await request<Product>(`/admin/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function toggleAdminProductStatusApi(
  token: string,
  productId: string,
  status: 'onSale' | 'offSale'
): Promise<Product> {
  const res = await request<Product>(`/admin/products/${productId}/status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return res.data;
}

export async function getAdminCouponsApi(token: string): Promise<Coupon[]> {
  const res = await request<{ coupons: Coupon[] }>('/admin/coupons', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.data.coupons;
}

export async function toggleAdminCouponStatusApi(
  token: string,
  code: string,
  status: 'active' | 'inactive'
): Promise<Coupon[]> {
  const res = await request<{ coupons: Coupon[] }>(`/admin/coupons/${code}/status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return res.data.coupons;
}
