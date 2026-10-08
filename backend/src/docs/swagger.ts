import swagger from '@fastify/swagger';
import type { StaticDocumentSpec } from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

function errorResponse(description: string, code: string, message: string) {
  return { description, content: { 'application/json': {
    schema: { $ref: '#/components/schemas/ErrorResponse' },
    example: { error: { code, message } },
  } } };
}

// Documentation only: request validation remains in the controller.
const specification: StaticDocumentSpec = {
  document: {
    openapi: '3.0.3',
    info: {
      title: 'Supabase Login API',
      version: '1.0.0',
      description: 'Email/password login through Supabase Auth, with username, role and membership loaded from app_users.',
    },
    servers: [{ url: '/', description: 'Current API server' }],
    tags: [{ name: 'Auth', description: 'Authentication' }],
    paths: {
      '/auth/login': {
        post: {
          operationId: 'login',
          tags: ['Auth'],
          summary: 'Login with email and password',
          description: 'Use an existing Supabase Auth account linked to app_users. Returns tokens and userId/username/email/role/memberTier. No token is required to call Login. Roles Admin/Customer become admin/customer; normal and Admin NULL tier become free, prime stays prime.',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: { email: 'user@email.com', password: 'YOUR_SUPABASE_PASSWORD' },
            } },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
                example: { data: {
                  accessToken: 'SUPABASE_JWT', refreshToken: 'SUPABASE_REFRESH_TOKEN', tokenType: 'Bearer', expiresIn: 3600,
                  user: { userId: '851cb40a-3d75-44bd-874a-9951ff57bbca', username: 'admin_johndoe', email: 'admin@email.com', role: 'admin', memberTier: 'free' },
                }, messages: [] },
              } },
            },
            '400': errorResponse('Invalid input or malformed JSON', 'VALIDATION_ERROR', 'รูปแบบหรือช่วงของข้อมูลไม่ถูกต้อง'),
            '401': errorResponse('Incorrect email or password', 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect'),
            '403': {
              description: 'Email is not confirmed, app_users profile is missing, or request Origin is not allowed',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  emailNotConfirmed: { value: { error: { code: 'AUTH_EMAIL_NOT_CONFIRMED', message: 'Please confirm your email before logging in' } } },
                  forbiddenOrigin: { value: { error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } } },
                  profileNotFound: { value: { error: { code: 'AUTH_PROFILE_NOT_FOUND', message: 'Account is not configured in app_users' } } },
                },
              } },
            },
            '413': errorResponse('Request body exceeds 16 KiB', 'REQUEST_ERROR', 'Invalid request'),
            '415': errorResponse('Unsupported content type; send application/json', 'REQUEST_ERROR', 'Invalid request'),
            '429': errorResponse('Too many login attempts', 'AUTH_RATE_LIMITED', 'Too many login attempts; please try again later'),
            '500': errorResponse('Unexpected API failure', 'INTERNAL_ERROR', 'Unable to process request'),
            '503': {
              description: 'Supabase Auth or app_users lookup is unavailable, including missing column grants or RLS configuration',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  authenticationUnavailable: { value: { error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication service is unavailable' } } },
                  profileUnavailable: { value: { error: { code: 'AUTH_PROFILE_UNAVAILABLE', message: 'Unable to load account profile' } } },
                },
              } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        LoginRequest: {
          type: 'object', required: ['email', 'password'], additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email', maxLength: 254, description: 'Supabase Auth email; surrounding whitespace is trimmed' },
            password: { type: 'string', format: 'password', minLength: 1, maxLength: 4096, writeOnly: true },
          },
        },
        LoginResponse: {
          type: 'object', required: ['data', 'messages'], additionalProperties: false,
          properties: {
            data: {
              type: 'object', required: ['accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'user'], additionalProperties: false,
              properties: {
                accessToken: { type: 'string', description: 'JWT access token issued by Supabase Auth' },
                refreshToken: { type: 'string', description: 'Supabase refresh token' },
                tokenType: { type: 'string', enum: ['Bearer'] },
                expiresIn: { type: 'number', minimum: 0, exclusiveMinimum: true, description: 'Access token lifetime in seconds, supplied by Supabase' },
                user: {
                  type: 'object', required: ['userId', 'username', 'email', 'role', 'memberTier'], additionalProperties: false,
                  properties: {
                    userId: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' },
                    username: { type: 'string', description: 'Username stored in app_users' },
                    role: { type: 'string', enum: ['admin', 'customer'], description: 'Authoritative app_users role mapped to lowercase' },
                    memberTier: { type: 'string', enum: ['free', 'prime'], description: 'normal and Admin NULL map to free; prime stays prime' },
                  },
                },
              },
            },
            messages: { type: 'array', items: {}, maxItems: 0, description: 'Empty for a successful login' },
          },
        },
        ErrorResponse: {
          type: 'object', required: ['error'], additionalProperties: false,
          properties: {
            error: {
              type: 'object', required: ['code', 'message'], additionalProperties: false,
              properties: {
                code: { type: 'string' }, message: { type: 'string' },
                details: { type: 'object', properties: { fields: { type: 'array', items: { type: 'string' } } } },
              },
            },
          },
        },
      },
    },
  },
};

export function registerSwagger(app: FastifyInstance): void {
  app.register(swagger, { mode: 'static', specification });
  app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    uiConfig: { docExpansion: 'list', deepLinking: true, validatorUrl: null, persistAuthorization: false },
  });
}
