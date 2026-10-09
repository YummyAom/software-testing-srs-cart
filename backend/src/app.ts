import Fastify from 'fastify';
import { HttpError, reject } from './errors.js';
import { registerAuthRoutes } from './modules/auth/auth-routes.js';
import type { AppConfig } from './interfaces/config.js';
import { registerSwagger } from './docs/swagger.js';

export type { AppConfig } from './interfaces/config.js';

export function createApp(config: AppConfig) {
  if (process.env.NODE_ENV === 'production' || (config.appEnv !== 'development' && config.appEnv !== 'test')) throw new Error('Local login API requires development/test APP_ENV; production is unsupported');
  if (!config.uiOrigin || new URL(config.uiOrigin).origin !== config.uiOrigin) throw new Error('Configure one exact UI_ORIGIN');
  const app = Fastify({ exposeHeadRoutes: false, logger: { level: 'silent', redact: ['req.headers.authorization', 'req.body.password'] }, bodyLimit: 16384 });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff').header('cache-control', 'no-store');
    const origin = request.headers.origin;
    if (origin !== undefined) {
      reply.header('vary', 'Origin');
      // Swagger's Try it out posts from this API's own localhost origin.
      const isLocalSameOrigin = ['127.0.0.1', 'localhost'].includes(request.hostname)
        && origin === `${request.protocol}://${request.host}`;
      if (origin !== config.uiOrigin && !isLocalSameOrigin) reject('AUTH_FORBIDDEN');
      reply.header('access-control-allow-origin', config.uiOrigin);
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    if (error instanceof Error && 'code' in error && (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY')) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: new HttpError('VALIDATION_ERROR').message } });
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send({ error: { code: 'REQUEST_ERROR', message: 'Invalid request' } });
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Unable to process request' } });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
  registerSwagger(app);
  registerAuthRoutes(app, config.supabase, config.uiOrigin);
  return app;
}
