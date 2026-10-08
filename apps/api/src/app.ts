import Fastify from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { registerRoutes } from './routes.js';
import { bodyObject, DomainError, stringField, reject, noBody } from './errors.js';
import { createMemoryPersistence, createSeedState } from './persistence.js';
import type { PersistenceAdapter } from './persistence.js';
import { userState } from './views.js';
import { createMockIdentity } from './mock-identity.js';
import type { IdentityAdapter, SeedPasswords } from './mock-identity.js';

export interface AppConfig {
  appEnv: 'development' | 'test';
  seedPasswords: SeedPasswords;
  uiOrigin: string;
  testResetToken?: string;
}
export interface AppDependencies { persistence?: PersistenceAdapter; clock?: () => number; identity?: IdentityAdapter }

export function createApp(config: AppConfig, dependencies: AppDependencies = {}) {
  if (process.env.NODE_ENV === 'production' || (config.appEnv !== 'development' && config.appEnv !== 'test')) throw new Error('Mock backend requires explicit development/test APP_ENV; production is unsupported');
  if (!config.uiOrigin || new URL(config.uiOrigin).origin !== config.uiOrigin) throw new Error('Configure one exact UI_ORIGIN');
  if (config.appEnv === 'test' && !config.testResetToken) throw new Error('Configure TEST_RESET_TOKEN in test mode');
  const store = dependencies.persistence ?? createMemoryPersistence();
  const clock = dependencies.clock ?? Date.now;
  const identity = dependencies.identity ?? createMockIdentity(config.seedPasswords, clock);
  const app = Fastify({ exposeHeadRoutes: false, logger: { level: 'silent', redact: ['req.headers.authorization', 'req.headers.x-test-reset-token', 'req.body.password'] }, bodyLimit: 16384 });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff').header('cache-control', 'no-store');
    const origin = request.headers.origin;
    if (origin !== undefined) {
      reply.header('vary', 'Origin');
      if (origin !== config.uiOrigin) reject('AUTH_FORBIDDEN');
      reply.header('access-control-allow-origin', config.uiOrigin);
    }
  });
  app.options('/*', async (request, reply) => {
    const method = request.headers['access-control-request-method'];
    const requestedHeaders = request.headers['access-control-request-headers'];
    if (request.headers.origin !== config.uiOrigin || typeof method !== 'string' || !['GET', 'POST', 'PUT', 'DELETE'].includes(method)
      || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string' || requestedHeaders.split(',').some(h => !['authorization', 'content-type'].includes(h.trim().toLowerCase()))))) reject('AUTH_FORBIDDEN');
    return reply.header('access-control-allow-methods', 'GET, POST, PUT, DELETE').header('access-control-allow-headers', 'Authorization, Content-Type').code(204).send();
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) return reply.code(error.status).send({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    if (error instanceof Error && 'code' in error && (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY')) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: new DomainError('VALIDATION_ERROR').message } });
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send({ error: { code: 'REQUEST_ERROR', message: 'Invalid request' } });
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Unable to process request' } });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
  app.post('/auth/login', async request => {
    const input = bodyObject(request.body, ['username', 'password']);
    const username = stringField(input, 'username');
    const password = stringField(input, 'password');
    const user = await store.read(state => state.users.find(user => user.username === username));
    if (!await identity.verifyCredential(user?.userId, password) || !user) reject('AUTH_INVALID_CREDENTIALS');
    const currentUser = await store.read(state => {
      const current = state.users.find(candidate => candidate.userId === user.userId);
      if (!current) reject('AUTH_INVALID_CREDENTIALS');
      return userState(current);
    });
    return { data: { ...identity.issueSession(user.userId), user: currentUser }, messages: [] };
  });
  if (config.appEnv === 'test') {
    const expectedSecret = createHash('sha256').update(config.testResetToken!).digest();
    app.post('/test/reset', {
      onRequest: async request => {
        const token = request.headers['x-test-reset-token'];
        if (typeof token !== 'string' || !timingSafeEqual(createHash('sha256').update(token).digest(), expectedSecret)) reject('AUTH_FORBIDDEN');
      },
    }, request => store.transaction(state => {
      noBody(request.body);
      const seed = createSeedState();
      state.products = seed.products;
      state.coupons = seed.coupons;
      state.orders = [];
      state.orderSequence = 0;
      for (const user of state.users) {
        if (user.role === 'Customer') { user.stage = 'cart'; user.currentOrderId = null; user.cartLines = []; user.couponCode = null; }
      }
      return { data: { reset: true }, messages: [] };
    }));
  }
  registerRoutes(app, store, identity, clock, config.appEnv === 'test');
  return app;
}
