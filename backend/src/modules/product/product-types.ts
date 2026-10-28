export interface Product {
  productId: string;
  name: string;
  price: number;
  weightGram: number;
  availableStock: number;
  status?: 'onSale' | 'offSale';
}

export interface StoredProduct extends Product { status: 'onSale' | 'offSale' }

export interface ProductRepository {
  list(): Promise<{ kind: 'success'; products: StoredProduct[] } | { kind: 'unavailable' }>;
}
