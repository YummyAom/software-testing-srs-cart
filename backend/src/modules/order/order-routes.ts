import type { FastifyInstance } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { createViewOrderHandler } from './order-controller.js';
import { PostgresOrderRepository } from './repositories/order-repository.js';
import { OrderService } from './services/order-service.js';
import type { Database } from '../../database.js';

export function registerOrderRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string, database: Database): void {
  app.get('/orders/:orderId', createViewOrderHandler(config, database,
    new OrderService(new PostgresOrderRepository(database))));
  app.options('/orders/:orderId', async (request, reply) => {
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
