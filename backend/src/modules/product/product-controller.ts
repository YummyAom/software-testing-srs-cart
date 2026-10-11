import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { authenticatePrincipal, bearerToken } from '../auth/auth-principal.js';
import { AuthServiceError } from '../auth/auth-service.js';
import { ProductService, ProductServiceError } from './product-service.js';

export function createListProductsHandler(config: SupabaseAuthConfig, service: ProductService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config);
      const products = await service.listProducts(principal.role, token);
      return { data: { products }, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof ProductServiceError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}
