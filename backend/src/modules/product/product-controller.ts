import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { authenticatePrincipal, bearerToken } from '../auth/services/auth-principal.js';
import { AuthServiceError } from '../auth/auth-error.js';
import { ProductServiceError } from './product-error.js';
import { ProductService } from './services/product-service.js';
import type { Database } from '../../database.js';

export function createListProductsHandler(config: SupabaseAuthConfig, database: Database, service: ProductService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config, database);
      const products = await service.listProducts(principal.role);
      return { data: { products }, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof ProductServiceError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}
