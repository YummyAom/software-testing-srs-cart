// SRS-CART-002 v1.8 §6.1 (DC-1): pure functions; callers supply current domain facts.

export type Zone = 'inCity' | 'upcountry' | 'remote';
export type Speed = 'standard' | 'express';
export type MemberTier = 'normal' | 'prime';
export type WeightTier = 'light' | 'medium' | 'heavy' | 'overLimit';

export function isProductAvailable(isOnSale: boolean, availableStock: number): boolean {
  return isOnSale && availableStock >= 1;
}

export function validateQuantityChange(input: {
  operation: 'add' | 'update';
  quantity: unknown;          // ค่าที่ได้รับจาก request (อาจไม่ใช่จำนวนเต็ม)
  productExists: boolean;     // ใช้เมื่อ operation = 'add' (ขั้น 3)
  inCart: boolean;            // ใช้เมื่อ operation = 'update' (ขั้น 3)
  available: boolean;         // ผลของ isProductAvailable (ขั้น 4)
  currentQtyInCart: number;   // 0 เมื่อสินค้ายังไม่อยู่ในตะกร้า (ขั้น 5–6)
  availableStock: number;     // ขั้น 6
}): 'OK' | 'VALIDATION_ERROR' | 'QTY_OUT_OF_RANGE' | 'PRODUCT_NOT_FOUND'
   | 'ITEM_NOT_IN_CART' | 'PRODUCT_UNAVAILABLE' | 'INSUFFICIENT_STOCK' {
  const { quantity } = input;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) return 'VALIDATION_ERROR';
  if (quantity < 1 || quantity > 10) return 'QTY_OUT_OF_RANGE';
  if (input.operation === 'add' && !input.productExists) return 'PRODUCT_NOT_FOUND';
  if (input.operation === 'update' && !input.inCart) return 'ITEM_NOT_IN_CART';
  if (!input.available) return 'PRODUCT_UNAVAILABLE';
  const resultingQty = input.operation === 'add' ? input.currentQtyInCart + quantity : quantity;
  if (input.operation === 'add' && resultingQty > 10) return 'QTY_OUT_OF_RANGE';
  if (resultingQty > input.availableStock) return 'INSUFFICIENT_STOCK';
  return 'OK';
}

export function calculateSubtotal(lines: { price: number; quantity: number }[]): number {
  return lines.reduce((total, line) => total + line.price * line.quantity, 0);
}

export function calculateTotalWeight(lines: { weightGram: number; quantity: number }[]): number {
  return lines.reduce((total, line) => total + line.weightGram * line.quantity, 0);
}

export function calculateDiscount(
  subtotal: number,
  memberTier: MemberTier,
  coupon: { percent: number; minSpend: number; active: boolean } | null
): { discount: number; source: 'coupon' | 'member' | 'none'; couponRemoved: boolean } {
  if (coupon !== null && coupon.active && subtotal >= coupon.minSpend) {
    return { discount: Math.floor(subtotal * coupon.percent / 100), source: 'coupon', couponRemoved: false };
  }
  return {
    discount: memberTier === 'prime' ? Math.floor(subtotal * 5 / 100) : 0,
    source: memberTier === 'prime' ? 'member' : 'none',
    couponRemoved: coupon !== null,
  };
}

// FR-4.5: caller supplies a positive integer gram weight (SOI-06 excludes zero/negative).
export function classifyWeight(totalWeightGram: number): WeightTier {
  if (totalWeightGram <= 1000) return 'light';
  if (totalWeightGram <= 5000) return 'medium';
  if (totalWeightGram <= 20000) return 'heavy';
  return 'overLimit';
}

const baseShippingRates = {
  light: { inCity: 30, upcountry: 50, remote: 80 },
  medium: { inCity: 50, upcountry: 80, remote: 120 },
  heavy: { inCity: 80, upcountry: 120, remote: 180 },
} as const;

export function calculateShippingFee(
  weightTier: Exclude<WeightTier, 'overLimit'>, zone: Zone, speed: Speed, memberTier: MemberTier
): number {
  const base = baseShippingRates[weightTier][zone];
  if (memberTier === 'prime') return speed === 'standard' ? 0 : Math.floor(base / 2);
  return speed === 'standard' ? base : Math.floor(base * 3 / 2);
}

export function calculateNetTotal(subtotal: number, discount: number, shippingFee: number): number {
  return subtotal - discount + shippingFee;
}

export function validateCheckout(input: {
  zone: unknown;
  speed: unknown;
  lines: { productId: string; quantity: number; available: boolean; availableStock: number }[];
  totalWeightGram: number;    // ผลของ calculateTotalWeight
}):
  | { result: 'OK' }
  | { result: 'VALIDATION_ERROR' | 'CART_EMPTY' | 'WEIGHT_LIMIT_EXCEEDED' }
  | { result: 'ITEMS_UNAVAILABLE'; productIds: string[] } {  // productId ทุกตัวที่ไม่ผ่านขั้น 3
  if ((input.zone !== 'inCity' && input.zone !== 'upcountry' && input.zone !== 'remote')
      || (input.speed !== 'standard' && input.speed !== 'express')) {
    return { result: 'VALIDATION_ERROR' };
  }
  if (input.lines.length === 0) return { result: 'CART_EMPTY' };
  const productIds = input.lines
    .filter((line) => !line.available || line.quantity > line.availableStock)
    .map((line) => line.productId);
  if (productIds.length > 0) return { result: 'ITEMS_UNAVAILABLE', productIds };
  if (classifyWeight(input.totalWeightGram) === 'overLimit') return { result: 'WEIGHT_LIMIT_EXCEEDED' };
  return { result: 'OK' };
}

export function validateProductUpdate(input: { price?: unknown; stock?: unknown }): ('price' | 'stock')[] {
  // SOI-05 design disposition: SRS requires at least one field; exact empty-input fields are unspecified.
  if (!('price' in input) && !('stock' in input)) return ['price', 'stock'];
  const invalidFields: ('price' | 'stock')[] = [];
  if ('price' in input && (typeof input.price !== 'number' || !Number.isInteger(input.price)
      || input.price < 1 || input.price > 50000)) {
    invalidFields.push('price');
  }
  if ('stock' in input && (typeof input.stock !== 'number' || !Number.isInteger(input.stock)
      || input.stock < 0 || input.stock > 9999)) {
    invalidFields.push('stock');
  }
  return invalidFields;
}
