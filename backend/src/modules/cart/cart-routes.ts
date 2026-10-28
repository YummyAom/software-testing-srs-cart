import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { createAddItemHandler, createCartActionHandler, createUpdateQuantityHandler } from './cart-controller.js';
import { PostgresCartRepository } from './repositories/cart-repository.js';
import { CartService } from './services/cart-service.js';
import type { Database } from '../../database.js';

export function registerCartRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string, database: Database): void {
  const service = new CartService(new PostgresCartRepository(database));
  app.post('/cart/items', createAddItemHandler(config, database, service));
  app.put('/cart/items/:productId', createUpdateQuantityHandler(config, database, service));
  app.delete('/cart/items/:productId', createCartActionHandler('remove', config, database, service));
  app.put('/cart/coupon', createCartActionHandler('coupon', config, database, service));
  app.get('/cart', createCartActionHandler('view', config, database, service));
  app.post('/cart/checkout', createCartActionHandler('checkout', config, database, service));
  app.delete('/cart/checkout', createCartActionHandler('cancel', config, database, service));
  const preflight = (methods: string[]) => async (request: FastifyRequest, reply: FastifyReply) => {
    const requestedHeaders = request.headers['access-control-request-headers'];
    if (request.headers.origin !== uiOrigin || !methods.includes(request.headers['access-control-request-method'] ?? '')
      || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string'
        || requestedHeaders.split(',').some(header => !['authorization', 'content-type'].includes(header.trim().toLowerCase()))))) {
      return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } });
    }
    return reply.header('access-control-allow-methods', methods.join(', '))
      .header('access-control-allow-headers', 'Authorization, Content-Type').code(204).send();
  };
  app.options('/cart/items', preflight(['POST']));
  app.options('/cart/items/:productId', preflight(['PUT', 'DELETE']));
  app.options('/cart/coupon', preflight(['PUT']));
  app.options('/cart', preflight(['GET']));
  app.options('/cart/checkout', preflight(['POST', 'DELETE']));
}
