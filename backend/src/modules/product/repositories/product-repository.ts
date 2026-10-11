import type { SupabaseAuthConfig } from '../../../interfaces/config.js';

export interface Product {
  productId: string;
  name: string;
  price: number;
  weightGram: number;
  availableStock: number;
  status?: 'onSale' | 'offSale';
}

interface StoredProduct extends Product { status: 'onSale' | 'offSale' }

export interface ProductRepository {
  list(accessToken: string): Promise<{ kind: 'success'; products: StoredProduct[] } | { kind: 'unavailable' }>;
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly config: SupabaseAuthConfig) {}

  async list(accessToken: string): ReturnType<ProductRepository['list']> {
    const url = new URL('/rest/v1/products', this.config.url);
    url.searchParams.set('select', 'product_id,name,price,weight_gram,available_stock,status');
    url.searchParams.set('order', 'product_id.asc');
    try {
      const response = await fetch(url, {
        headers: { apikey: this.config.publishableKey, Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (!response.ok) return { kind: 'unavailable' };
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) return { kind: 'unavailable' };
      const products: StoredProduct[] = [];
      for (const row of rows as unknown[]) {
        if (!row || typeof row !== 'object'
          || !('product_id' in row) || typeof row.product_id !== 'string'
          || !('name' in row) || typeof row.name !== 'string'
          || !('price' in row) || !Number.isSafeInteger(row.price)
          || !('weight_gram' in row) || !Number.isSafeInteger(row.weight_gram)
          || !('available_stock' in row) || !Number.isSafeInteger(row.available_stock)
          || !('status' in row) || (row.status !== 'onSale' && row.status !== 'offSale')) {
          return { kind: 'unavailable' };
        }
        products.push({
          productId: row.product_id, name: row.name,
          price: row.price as number, weightGram: row.weight_gram as number,
          availableStock: row.available_stock as number, status: row.status,
        });
      }
      return { kind: 'success', products };
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
