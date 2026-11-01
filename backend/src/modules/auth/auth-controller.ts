import type { FastifyReply, FastifyRequest } from 'fastify';
import { bodyObject, reject, stringField } from '../../errors.js';
import { AuthServiceError } from './auth-error.js';
import { AuthService } from './services/auth-service.js';
import { authenticatePrincipal, bearerToken } from './services/auth-principal.js';
import type { LoginRequest, LoginResponse } from '../../interfaces/auth.js';
import type { UserState } from '../../interfaces/user.js';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import type { Database } from '../../database.js';

export function createLoginHandler(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const input = bodyObject(request.body, ['username', 'email', 'password'], ['password']);
    const rawIdentifier = input.username !== undefined ? input.username : input.email;
    if (typeof rawIdentifier !== 'string' || !rawIdentifier.trim() || rawIdentifier.length > 254) {
      reject('VALIDATION_ERROR', undefined, { fields: ['username'] });
    }
    const identifier = rawIdentifier.trim();
    const password = stringField(input, 'password');
    if (!password.length || password.length > 4096) {
      reject('VALIDATION_ERROR', undefined, { fields: ['password'] });
    }
    try {
      const session = await service.login(identifier, password);
      const response: LoginResponse = { data: session, messages: [] };
      return response;
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}

export function createLogoutHandler(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) return reply.code(401).send({ error: { code: 'AUTH_REQUIRED', message: 'Bearer access token is required' } });
    try {
      await service.logout(token);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}

export function createMeHandler(config: SupabaseAuthConfig, database: Database) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = bearerToken(request.headers.authorization);
      const principal = await authenticatePrincipal(token, config, database);
      if (principal.role === 'Admin') {
        const user: UserState = {
          userId: principal.id,
          username: principal.username,
          role: 'Admin',
          memberTier: null,
          stage: null,
          currentOrderId: null,
        };
        return { data: user, messages: [] };
      }
      const stateResult = await database.query<{ stage: 'cart' | 'checkout' | 'success'; current_order_id: string | null }>(
        'select stage, current_order_id from public.customer_state where customer_id = $1',
        [principal.id]
      );
      const state = stateResult.rows[0];
      const user: UserState = {
        userId: principal.id,
        username: principal.username,
        role: 'Customer',
        memberTier: principal.memberTier,
        stage: state?.stage ?? 'cart',
        currentOrderId: state?.current_order_id ?? null,
      };
      return { data: user, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  };
}
