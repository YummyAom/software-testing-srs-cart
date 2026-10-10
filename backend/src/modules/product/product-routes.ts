import type { FastifyInstance } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { createListProductsHandler } from './product-controller.js';
import { ProductService } from './product-service.js';
import { SupabaseProductRepository } from './repositories/product-repository.js';

export function registerProductRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string): void {
  app.get('/products', createListProductsHandler(config, new ProductService(new SupabaseProductRepository(config))));
  app.options('/products', async (request, reply) => {
    const requestedHeaders = request.headers['access-control-request-headers'];
    if (request.headers.origin !== uiOrigin || request.headers['access-control-request-method'] !== 'GET'
      || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string'
        || requestedHeaders.split(',').some(header => header.trim().toLowerCase() !== 'authorization')))) {
      return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } });
    }
    return reply.header('access-control-allow-methods', 'GET')
      .header('access-control-allow-headers', 'Authorization').code(204).send();
  });
}
