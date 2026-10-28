import { calculateDiscount, calculateNetTotal, calculateShippingFee, calculateSubtotal,
  calculateTotalWeight, classifyWeight, isProductAvailable, validateCheckout,
  type Speed, type Zone } from '@cart/domain';
import { CartServiceError } from '../cart-error.js';
import type { CheckoutFacts, CheckoutQuote } from '../checkout-types.js';

/** Calculate a checkout quote from current database facts, with no I/O. */
export function calculateCheckoutQuote(facts: CheckoutFacts, zone: unknown, speed: unknown): CheckoutQuote {
  const totalWeightGram = calculateTotalWeight(facts.lines);
  const validation = validateCheckout({ zone, speed, totalWeightGram,
    lines: facts.lines.map(line => ({ productId: line.productId, quantity: line.quantity,
      available: isProductAvailable(line.status === 'onSale', line.availableStock),
      availableStock: line.availableStock })) });
  if (validation.result !== 'OK') {
    const messages = {
      VALIDATION_ERROR: 'พื้นที่หรือความเร็วการจัดส่งไม่ถูกต้อง',
      CART_EMPTY: 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง',
      ITEMS_UNAVAILABLE: 'มีสินค้าไม่พร้อมขายในตะกร้า',
      WEIGHT_LIMIT_EXCEEDED: 'น้ำหนักรวมเกิน 20,000 กรัม',
    } as const;
    throw new CartServiceError(400, validation.result, messages[validation.result],
      validation.result === 'ITEMS_UNAVAILABLE' ? { productIds: validation.productIds } : undefined);
  }
  const subtotal = calculateSubtotal(facts.lines);
  const discount = calculateDiscount(subtotal, facts.customer.memberTier,
    facts.coupon === null ? null : { percent: facts.coupon.percent,
      minSpend: facts.coupon.minSpend, active: facts.coupon.status === 'active' });
  const tier = classifyWeight(totalWeightGram);
  if (tier === 'overLimit') throw new CartServiceError(400, 'WEIGHT_LIMIT_EXCEEDED', 'น้ำหนักรวมเกิน 20,000 กรัม');
  const shippingFee = calculateShippingFee(tier, zone as Zone, speed as Speed, facts.customer.memberTier);
  return {
    subtotal, discount: discount.discount, shippingFee,
    netTotal: calculateNetTotal(subtotal, discount.discount, shippingFee),
    totalWeightGram, discountSource: discount.source,
    couponCode: discount.source === 'coupon' ? facts.customer.couponCode : null,
    couponRemoved: discount.couponRemoved,
  };
}
