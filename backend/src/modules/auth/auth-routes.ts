import type { FastifyInstance } from 'fastify';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import { createLoginHandler, createLogoutHandler } from './auth-controller.js';
import { AuthService } from './auth-service.js';
import { SupabaseAppUserRepository } from './repositories/app-user-repository.js';
import { SupabaseAuthRepository } from './repositories/supabase-auth-repository.js';

export function registerAuthRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string): void {
  const service = new AuthService(
    new SupabaseAuthRepository(config),
    new SupabaseAppUserRepository(config),
  );
  app.post('/auth/login', createLoginHandler(service));
  app.post('/auth/logout', createLogoutHandler(service));

  for (const [path, allowedHeaders] of [
    ['/auth/login', ['Content-Type']],
    ['/auth/logout', ['Authorization']],
  ] as const) {
    app.options(path, async (request, reply) => {
      const requestedHeaders = request.headers['access-control-request-headers'];
      if (request.headers.origin !== uiOrigin || request.headers['access-control-request-method'] !== 'POST'
        || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string'
          || requestedHeaders.split(',').some(header => !allowedHeaders.some(allowed => allowed.toLowerCase() === header.trim().toLowerCase()))))) {
        return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } });
      }
      return reply.header('access-control-allow-methods', 'POST')
        .header('access-control-allow-headers', allowedHeaders.join(', ')).code(204).send();
    });
  }
}
