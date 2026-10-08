import { randomUUID } from 'node:crypto';
import type { CheckoutResult, Message, Order, Zone, Speed } from '@cart/contracts';
import { REQUIRED_MESSAGES, COUPON_NOT_APPLICABLE } from '@cart/contracts';
import { calculateSubtotal, calculateTotalWeight, calculateDiscount, classifyWeight, calculateShippingFee, calculateNetTotal, isProductAvailable, validateCheckout } from '@cart/domain';
import { bodyObject, reject } from './errors.js';
import type { StoreState, StoredUser } from './persistence.js';
import { userState } from './views.js';

export function checkout(state: StoreState, user: StoredUser, body: unknown, clock: () => number): { data: CheckoutResult; messages: Message[] } {
  const input = bodyObject(body, ['zone', 'speed']);
  if (!user.memberTier) throw new Error('Customer tier required');
  const lines = user.cartLines.map(line => {
    const product = state.products.find(p => p.productId === line.productId);
    if (!product) throw new Error('Broken cart product reference');
    return { product, quantity: line.quantity };
  });
  const totalWeightGram = calculateTotalWeight(lines.map(l => ({ weightGram: l.product.weightGram, quantity: l.quantity })));
  const validation = validateCheckout({ zone: input.zone, speed: input.speed, totalWeightGram, lines: lines.map(l => ({ productId: l.product.productId, quantity: l.quantity, available: isProductAvailable(l.product.status === 'onSale', l.product.availableStock), availableStock: l.product.availableStock })) });
  if (validation.result !== 'OK') {
    if (validation.result === 'ITEMS_UNAVAILABLE') reject(validation.result, undefined, { productIds: validation.productIds });
    reject(validation.result, validation.result === 'CART_EMPTY' ? REQUIRED_MESSAGES.checkoutEmptyCart : undefined);
  }
  const subtotal = calculateSubtotal(lines.map(l => ({ price: l.product.price, quantity: l.quantity })));
  const coupon = state.coupons.find(c => c.code === user.couponCode);
  const discount = calculateDiscount(subtotal, user.memberTier, coupon ? { percent: coupon.percent, minSpend: coupon.minSpend, active: coupon.status === 'active' } : null);
  const messages: Message[] = [];
  if (discount.couponRemoved) {
    user.couponCode = null;
    messages.push({ kind: 'notice', code: COUPON_NOT_APPLICABLE, message: REQUIRED_MESSAGES.couponNotApplicable });
  }
  const tier = classifyWeight(totalWeightGram);
  if (tier === 'overLimit') throw new Error('Checkout validation invariant failed');
  const zone = input.zone as Zone;
  const speed = input.speed as Speed;
  const shippingFee = calculateShippingFee(tier, zone, speed, user.memberTier);
  let orderId: string;
  do { orderId = randomUUID(); } while (state.orders.some(o => o.snapshot.orderId === orderId));
  const order: Order = {
    orderId, createdAt: new Date(clock()).toISOString(), status: 'pending', subtotal, discount: discount.discount, discountSource: discount.source, shippingFee,
    netTotal: calculateNetTotal(subtotal, discount.discount, shippingFee), zone, speed, couponCode: user.couponCode, totalWeightGram,
    lines: lines.map(l => ({ productId: l.product.productId, name: l.product.name, unitPrice: l.product.price, quantity: l.quantity, weightGram: l.product.weightGram })),
  };
  state.orders.push({ ownerId: user.userId, sequence: ++state.orderSequence, snapshot: order });
  for (const line of lines) line.product.availableStock -= line.quantity;
  user.stage = 'checkout';
  user.currentOrderId = orderId;
  return { data: { customer: userState(user), order }, messages };
}
