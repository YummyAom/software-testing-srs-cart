import type { FastifyInstance } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { createListOrdersHandler, createPayFailHandler, createPaySuccessHandler, createViewOrderHandler } from './order-controller.js';
import { PostgresOrderRepository } from './repositories/order-repository.js';
import { OrderService } from './services/order-service.js';
import type { Database } from '../../database.js';

export function registerOrderRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string, database: Database,
  enableGatewaySimulator: boolean): void {
  const service = new OrderService(new PostgresOrderRepository(database));

  app.get('/orders', createListOrdersHandler(config, database, service));
  app.get('/orders/:orderId', createViewOrderHandler(config, database, service));

  const optionsGet = async (request: any, reply: any) => {
    const requestedHeaders = request.headers['access-control-request-headers'];
    if (request.headers.origin !== uiOrigin || request.headers['access-control-request-method'] !== 'GET'
      || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string'
        || requestedHeaders.split(',').some((header: string) => header.trim().toLowerCase() !== 'authorization')))) {
      return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } });
    }
    return reply.header('access-control-allow-methods', 'GET')
      .header('access-control-allow-headers', 'Authorization').code(204).send();
  };

  app.options('/orders', optionsGet);
  app.options('/orders/:orderId', optionsGet);

  // OP-10/11 gateway simulator exists only in development/test environments (D-03; SRS §1.3, DC-3.3).
  if (!enableGatewaySimulator) return;
  app.post('/orders/:orderId/pay-success', createPaySuccessHandler(service));
  app.post('/orders/:orderId/pay-fail', createPayFailHandler(service));
  for (const path of ['/orders/:orderId/pay-success', '/orders/:orderId/pay-fail'] as const) {
    app.options(path, async (request, reply) => {
      const requestedHeaders = request.headers['access-control-request-headers'];
      if (request.headers.origin !== uiOrigin || request.headers['access-control-request-method'] !== 'POST'
        || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string'
          || requestedHeaders.split(',').some(header => !['authorization', 'content-type'].includes(header.trim().toLowerCase()))))) {
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } });
      }
      return reply.header('access-control-allow-methods', 'POST')
        .header('access-control-allow-headers', 'Authorization, Content-Type').code(204).send();
    });
  }
}
