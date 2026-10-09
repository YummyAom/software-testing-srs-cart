import type { FastifyReply, FastifyRequest } from 'fastify';
import { bodyObject, reject, stringField } from '../../errors.js';
import { AuthService, AuthServiceError } from './auth-service.js';
import type { LoginRequest, LoginResponse } from '../../interfaces/auth.js';

export function createLoginHandler(service: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const input = bodyObject(request.body, ['email', 'password']);
    const credentials: LoginRequest = {
      email: stringField(input, 'email').trim(),
      password: stringField(input, 'password'),
    };
    const { email, password } = credentials;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reject('VALIDATION_ERROR', undefined, { fields: ['email'] });
    }
    if (!password.length || password.length > 4096) {
      reject('VALIDATION_ERROR', undefined, { fields: ['password'] });
    }
    try {
      const session = await service.login(email, password);
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
