import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { authenticatePrincipal, bearerToken } from '../auth/services/auth-principal.js';
import { AuthServiceError } from '../auth/auth-error.js';
import { OrderRepositoryError } from './order-error.js';
import type { OrderService } from './services/order-service.js';
import type { Database } from '../../database.js';

export function createViewOrderHandler(config: SupabaseAuthConfig, database: Database, service: OrderService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config, database);
      if (principal.role !== 'Customer') {
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Only customers can view orders' } });
      }
      const { orderId } = request.params as { orderId: string };
      const order = await service.findOwned(principal.id, orderId);
      return { data: order, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof OrderRepositoryError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}
