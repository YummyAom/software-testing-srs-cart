import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { createAddItemHandler, createCartActionHandler, createUpdateQuantityHandler } from './cart-controller.js';
import { SupabaseCartRepository } from './repositories/cart-repository.js';

export function registerCartRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string): void {
  const repository = new SupabaseCartRepository(config);
  app.post('/cart/items', createAddItemHandler(config, repository));
  app.put('/cart/items/:productId', createUpdateQuantityHandler(config, repository));
  app.delete('/cart/items/:productId', createCartActionHandler('remove', config, repository));
  app.put('/cart/coupon', createCartActionHandler('coupon', config, repository));
  app.get('/cart', createCartActionHandler('view', config, repository));
  app.post('/cart/checkout', createCartActionHandler('checkout', config, repository));
  app.delete('/cart/checkout', createCartActionHandler('cancel', config, repository));
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
