import type { AppUser } from '../../../interfaces/user.js';
import type { Product, ProductRepository } from '../product-types.js';
import { ProductServiceError } from '../product-error.js';
import { isProductAvailable } from '@cart/domain';

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async listProducts(role: AppUser['role']): Promise<Product[]> {
    const result = await this.repository.list();
    if (result.kind === 'unavailable') throw new ProductServiceError(503, 'PRODUCTS_UNAVAILABLE', 'Unable to load products');
    return role === 'Admin'
      ? result.products
      : result.products.filter(product => isProductAvailable(product.status === 'onSale', product.availableStock))
        .map(({ status: _status, ...product }) => product);
  }
}
