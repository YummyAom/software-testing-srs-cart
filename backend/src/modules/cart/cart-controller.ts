import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { bodyObject, stringField, HttpError } from '../../errors.js';
import { authenticatePrincipal, bearerToken } from '../auth/auth-principal.js';
import { AuthServiceError } from '../auth/auth-service.js';
import { CartServiceError, type CartRepository } from './repositories/cart-repository.js';

function createItemHandler(operation: 'add' | 'update', config: SupabaseAuthConfig, repository: CartRepository) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config);
      request.log.info({ event: `cart_${operation}_authenticated`, role: principal.role }, 'Cart user authenticated');
      if (principal.role !== 'Customer') {
        request.log.warn({ event: `cart_${operation}_rejected`, code: 'AUTH_FORBIDDEN' }, 'Cart request rejected');
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Only customers can change a cart' } });
      }
      const body = bodyObject(request.body, operation === 'add' ? ['productId', 'quantity'] : ['quantity']);
      const source = operation === 'add' ? body : request.params as Record<string, unknown>;
      const productId = stringField(source, 'productId');
      if (!productId) throw new HttpError('VALIDATION_ERROR', 'productId ต้องไม่ว่าง', { fields: ['productId'] });
      request.log.info({ event: `cart_${operation}_rpc_start` }, 'Calling cart RPC');
      const cart = operation === 'add'
        ? await repository.addItem(token, productId, body.quantity)
        : await repository.updateQuantity(token, productId, body.quantity);
      request.log.info({ event: `cart_${operation}_succeeded`, lineCount: cart.lineCount }, 'Cart changed');
      return { data: cart, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof CartServiceError || error instanceof HttpError) {
        request.log.warn({ event: `cart_${operation}_failed`, code: error.code, status: error.status,
          ...(error instanceof CartServiceError ? { reason: error.reason, ...error.details,
            ...(error.permissionTarget ? { permissionTarget: error.permissionTarget } : {}) } : {}) }, 'Cart request failed');
        return reply.code(error.status).send({ error: { code: error.code, message: error.message,
          ...('details' in error && error.details ? { details: error.details } : {}) } });
      }
      throw error;
    }
  };
}

export function createAddItemHandler(config: SupabaseAuthConfig, repository: CartRepository) {
  return createItemHandler('add', config, repository);
}

export function createUpdateQuantityHandler(config: SupabaseAuthConfig, repository: CartRepository) {
  return createItemHandler('update', config, repository);
}

type CartAction = 'remove' | 'coupon' | 'view' | 'checkout' | 'cancel';

export function createCartActionHandler(action: CartAction, config: SupabaseAuthConfig, repository: CartRepository) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config);
      if (principal.role !== 'Customer') {
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Only customers can access a cart' } });
      }
      request.log.info({ event: `cart_${action}_rpc_start` }, 'Calling cart RPC');
      if (action === 'remove') {
        const productId = stringField(request.params as Record<string, unknown>, 'productId');
        if (!productId) throw new HttpError('VALIDATION_ERROR', 'productId ต้องไม่ว่าง');
        const cart = await repository.removeItem(token, productId);
        return { data: cart, messages: cart.lineCount === 0
          ? [{ kind: 'info', code: '', message: 'ตะกร้าว่าง' }] : [] };
      }
      if (action === 'coupon') {
        const body = bodyObject(request.body, ['code']);
        const code = stringField(body, 'code');
        if (!code) throw new HttpError('VALIDATION_ERROR', 'code ต้องไม่ว่าง', { fields: ['code'] });
        return { data: await repository.applyCoupon(token, code), messages: [] };
      }
      if (action === 'view') return { data: await repository.viewCart(token), messages: [] };
      if (action === 'checkout') {
        const body = bodyObject(request.body, ['zone', 'speed']);
        const result = await repository.checkout(token, body.zone, body.speed);
        return reply.code(201).send({ data: { customer: result.customer, order: result.order },
          messages: result.couponRemoved
            ? [{ kind: 'notice', code: 'COUPON_NOT_APPLICABLE', message: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้' }] : [] });
      }
      const result = await repository.cancelCheckout(token);
      return { data: result, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof CartServiceError || error instanceof HttpError) {
        request.log.warn({ event: `cart_${action}_failed`, code: error.code, status: error.status,
          ...(error instanceof CartServiceError ? { reason: error.reason, ...error.details } : {}) }, 'Cart request failed');
        return reply.code(error.status).send({ error: { code: error.code, message: error.message,
          ...('details' in error && error.details ? { details: error.details } : {}) } });
      }
      throw error;
    }
  };
}
