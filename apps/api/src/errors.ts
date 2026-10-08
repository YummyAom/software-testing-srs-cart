import { DOMAIN_ERROR_HTTP_STATUS } from '@cart/contracts';
import type { DomainErrorCode } from '@cart/contracts';

// DESIGN wording from SRS §5 descriptions; only REQUIRED_MESSAGES has exact SRS text oracles.
const descriptions: Record<DomainErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: 'username/password ไม่ถูกต้อง',
  AUTH_REQUIRED: 'ยังไม่ได้ login',
  AUTH_FORBIDDEN: 'บทบาทไม่มีสิทธิ์',
  VALIDATION_ERROR: 'รูปแบบหรือช่วงของข้อมูลไม่ถูกต้อง',
  QTY_OUT_OF_RANGE: 'quantity อยู่นอกช่วง 1–10',
  PRODUCT_NOT_FOUND: 'ไม่มีสินค้า',
  PRODUCT_UNAVAILABLE: 'ไม่ใช่สินค้าพร้อมขาย',
  INSUFFICIENT_STOCK: 'quantity เกินสต็อกพร้อมขาย',
  ITEM_NOT_IN_CART: 'สินค้าไม่อยู่ในตะกร้า',
  CART_EMPTY: 'ตะกร้าว่าง',
  COUPON_INVALID: 'คูปองไม่มีหรือปิดใช้ ณ ขณะผูก',
  ITEMS_UNAVAILABLE: 'มีรายการที่ไม่พร้อมขาย ณ checkout',
  WEIGHT_LIMIT_EXCEEDED: 'น้ำหนักรวมเกิน 20,000 กรัม',
  OPERATION_NOT_ALLOWED: 'operation ไม่อนุญาตใน stage/สถานะปัจจุบัน',
  ORDER_NOT_FOUND: 'ไม่พบออเดอร์',
  COUPON_NOT_FOUND: 'ไม่พบคูปอง',
};

export class DomainError extends Error {
  readonly status: number;
  constructor(readonly code: DomainErrorCode, message: string = descriptions[code], readonly details?: Record<string, unknown>) {
    super(message);
    this.status = DOMAIN_ERROR_HTTP_STATUS[code];
  }
}
export function reject(code: DomainErrorCode, message?: string, details?: Record<string, unknown>): never {
  throw new DomainError(code, message, details);
}

// DESIGN/SOI-08: exact whitelists, no coercion. Called after role/stage and resource precedence checks.
export function bodyObject(body: unknown, allowed: string[], required: string[] = allowed): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) reject('VALIDATION_ERROR');
  const input = body as Record<string, unknown>;
  const extra = Object.keys(input).filter(key => !allowed.includes(key));
  const missing = required.filter(key => !Object.hasOwn(input, key));
  if (extra.length || missing.length) reject('VALIDATION_ERROR', undefined, { fields: [...missing, ...extra] });
  return input;
}
export function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') reject('VALIDATION_ERROR', undefined, { fields: [key] });
  return value;
}
export function noBody(body: unknown): void {
  if (body !== undefined) reject('VALIDATION_ERROR');
}
