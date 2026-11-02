import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { bodyObject, reject, HttpError } from '../../errors.js';
import { authenticatePrincipal, bearerToken } from '../auth/services/auth-principal.js';
import { AuthServiceError } from '../auth/auth-error.js';
import { OrderRepositoryError } from './order-error.js';
import type { OrderService } from './services/order-service.js';
import type { Database } from '../../database.js';

export function createListOrdersHandler(config: SupabaseAuthConfig, database: Database, service: OrderService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config, database);
      if (principal.role !== 'Customer') {
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Only customers can view orders' } });
      }
      const orders = await service.listOwned(principal.id);
      return { data: { orders }, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof OrderRepositoryError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}

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

export function createPaySuccessHandler(service: OrderService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const body = bodyObject(request.body, ['result'], ['result']);
      if (body.result !== 'success') {
        reject('VALIDATION_ERROR', undefined, { fields: ['result'] });
      }
      const result = await service.paySuccess(orderId);
      return { data: result, messages: [] };
    } catch (error) {
      if (error instanceof OrderRepositoryError || error instanceof HttpError) {
        return reply.code(error.status).send({
          error: {
            code: error.code,
            message: error.message,
            ...('details' in error && error.details ? { details: error.details } : {}),
          },
        });
      }
      throw error;
    }
  };
}

export function createPayFailHandler(service: OrderService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const body = bodyObject(request.body, ['result'], ['result']);
      if (body.result !== 'fail') {
        reject('VALIDATION_ERROR', undefined, { fields: ['result'] });
      }
      const result = await service.payFail(orderId);
      return {
        data: result,
        messages: [{ kind: 'info', code: '', message: 'การชำระเงินล้มเหลว กรุณาลองใหม่' }],
      };
    } catch (error) {
      if (error instanceof OrderRepositoryError || error instanceof HttpError) {
        return reply.code(error.status).send({
          error: {
            code: error.code,
            message: error.message,
            ...('details' in error && error.details ? { details: error.details } : {}),
          },
        });
      }
      throw error;
    }
  };
}
