import type { AppUser } from '../../interfaces/user.js';
import type { Product, ProductRepository } from './repositories/product-repository.js';

export class ProductServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async listProducts(role: AppUser['role'], token: string): Promise<Product[]> {
    const result = await this.repository.list(token);
    if (result.kind === 'unavailable') throw new ProductServiceError(503, 'PRODUCTS_UNAVAILABLE', 'Unable to load products');
    return role === 'Admin'
      ? result.products
      : result.products.filter(product => product.status === 'onSale' && product.availableStock >= 1)
        .map(({ status: _status, ...product }) => product);
  }
}
