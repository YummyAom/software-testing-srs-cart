import type { FastifyInstance } from 'fastify';
import { bodyObject, reject, stringField } from '../errors.js';
import { AuthService, AuthServiceError } from '../services/auth-service.js';

export function registerAuthController(app: FastifyInstance, service: AuthService): void {
  app.post('/auth/login', async (request, reply) => {
    const input = bodyObject(request.body, ['email', 'password']);
    const email = stringField(input, 'email').trim();
    const password = stringField(input, 'password');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reject('VALIDATION_ERROR', undefined, { fields: ['email'] });
    }
    if (!password.length || password.length > 4096) {
      reject('VALIDATION_ERROR', undefined, { fields: ['password'] });
    }
    try {
      const session = await service.login(email, password);
      return { data: session, messages: [] };
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });
}
