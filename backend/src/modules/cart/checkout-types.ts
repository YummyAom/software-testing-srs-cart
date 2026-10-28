export interface CheckoutFacts {
  customer: { userId: string; username: string; memberTier: 'normal' | 'prime';
    stage: 'cart'; couponCode: string | null };
  lines: { productId: string; name: string; price: number; weightGram: number;
    quantity: number; availableStock: number; status: 'onSale' | 'offSale' }[];
  coupon: { percent: number; minSpend: number; status: 'active' | 'inactive' } | null;
}

export interface CheckoutQuote {
  subtotal: number;
  discount: number;
  shippingFee: number;
  netTotal: number;
  totalWeightGram: number;
  discountSource: 'coupon' | 'member' | 'none';
  couponCode: string | null;
  couponRemoved: boolean;
}
