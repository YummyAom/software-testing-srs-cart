import type { Database } from '../../../database.js';
import type { ProductRepository } from '../product-types.js';

export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly database: Database) {}

  async list(): ReturnType<ProductRepository['list']> {
    try {
      const result = await this.database.query<{
        product_id: string; name: string; price: number; weight_gram: number;
        available_stock: string; status: 'onSale' | 'offSale';
      }>('select product_id, name, price, weight_gram, available_stock, status from public.products order by product_id');
      return { kind: 'success', products: result.rows.map(row => ({
        productId: row.product_id, name: row.name, price: row.price,
        weightGram: row.weight_gram, availableStock: Number(row.available_stock), status: row.status,
      })) };
    } catch { return { kind: 'unavailable' }; }
  }
}
