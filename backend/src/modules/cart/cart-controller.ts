import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { bodyObject, stringField, HttpError } from '../../errors.js';
import { authenticatePrincipal, bearerToken } from '../auth/services/auth-principal.js';
import { AuthServiceError } from '../auth/auth-error.js';
import { CartServiceError } from './cart-error.js';
import type { CartService } from './services/cart-service.js';
import type { Database } from '../../database.js';

function createItemHandler(operation: 'add' | 'update', config: SupabaseAuthConfig, database: Database, service: CartService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config, database);
      request.log.info({ event: `cart_${operation}_authenticated`, role: principal.role }, 'Cart user authenticated');
      if (principal.role !== 'Customer') {
        request.log.warn({ event: `cart_${operation}_rejected`, code: 'AUTH_FORBIDDEN' }, 'Cart request rejected');
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Only customers can change a cart' } });
      }
      const body = bodyObject(request.body, operation === 'add' ? ['productId', 'quantity'] : ['quantity']);
      const source = operation === 'add' ? body : request.params as Record<string, unknown>;
      const productId = stringField(source, 'productId');
      if (!productId) throw new HttpError('VALIDATION_ERROR', 'productId ต้องไม่ว่าง', { fields: ['productId'] });
      request.log.info({ event: `cart_${operation}_db_start` }, 'Updating cart');
      const cart = operation === 'add'
        ? await service.addItem(principal.id, productId, body.quantity)
        : await service.updateQuantity(principal.id, productId, body.quantity);
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

export function createAddItemHandler(config: SupabaseAuthConfig, database: Database, service: CartService) {
  return createItemHandler('add', config, database, service);
}

export function createUpdateQuantityHandler(config: SupabaseAuthConfig, database: Database, service: CartService) {
  return createItemHandler('update', config, database, service);
}

type CartAction = 'remove' | 'coupon' | 'view' | 'checkout' | 'cancel';

export function createCartActionHandler(action: CartAction, config: SupabaseAuthConfig, database: Database, service: CartService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config, database);
      if (principal.role !== 'Customer') {
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Only customers can access a cart' } });
      }
      request.log.info({ event: `cart_${action}_db_start` }, 'Processing cart action');
      if (action === 'remove') {
        const productId = stringField(request.params as Record<string, unknown>, 'productId');
        if (!productId) throw new HttpError('VALIDATION_ERROR', 'productId ต้องไม่ว่าง');
        const cart = await service.removeItem(principal.id, productId);
        return { data: cart, messages: cart.lineCount === 0
          ? [{ kind: 'info', code: '', message: 'ตะกร้าว่าง' }] : [] };
      }
      if (action === 'coupon') {
        const body = bodyObject(request.body, ['code']);
        const code = stringField(body, 'code');
        if (!code) throw new HttpError('VALIDATION_ERROR', 'code ต้องไม่ว่าง', { fields: ['code'] });
        return { data: await service.applyCoupon(principal.id, code), messages: [] };
      }
      if (action === 'view') return { data: await service.viewCart(principal.id), messages: [] };
      if (action === 'checkout') {
        const body = bodyObject(request.body, ['zone', 'speed']);
        const result = await service.checkout(principal.id, body.zone, body.speed);
        return reply.code(201).send({ data: { customer: result.customer, order: result.order },
          messages: result.couponRemoved
            ? [{ kind: 'notice', code: 'COUPON_NOT_APPLICABLE', message: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้' }] : [] });
      }
      const result = await service.cancelCheckout(principal.id);
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
