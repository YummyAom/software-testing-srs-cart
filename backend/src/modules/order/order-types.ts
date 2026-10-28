export interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  weightGram: number;
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

export interface OrderRepository {
  findOwned(customerId: string, orderId: string): Promise<Order>;
}
