import type { Cart, UserState } from '@cart/contracts';
import { calculateSubtotal, isProductAvailable } from '@cart/domain';
import type { DeepReadonly, StoredUser, StoreState } from './persistence.js';

export function userState(user: DeepReadonly<StoredUser>): UserState {
  return { userId: user.userId, username: user.username, role: user.role, memberTier: user.memberTier, stage: user.stage, currentOrderId: user.currentOrderId };
}
export function cartView(state: DeepReadonly<StoreState>, user: DeepReadonly<StoredUser>): Cart {
  if (user.stage === null) throw new Error('Customer state required');
  const lines = user.cartLines.map(line => {
    const product = state.products.find(p => p.productId === line.productId);
    if (!product) throw new Error('Broken cart product reference');
    return { productId: product.productId, name: product.name, unitPrice: product.price, weightGram: product.weightGram, quantity: line.quantity, available: isProductAvailable(product.status === 'onSale', product.availableStock) };
  });
  return { stage: user.stage, currentOrderId: user.currentOrderId, couponCode: user.couponCode, lineCount: lines.length, checkoutEnabled: lines.length > 0 && user.stage === 'cart', subtotal: calculateSubtotal(lines.map(l => ({ price: l.unitPrice, quantity: l.quantity }))), lines };
}
