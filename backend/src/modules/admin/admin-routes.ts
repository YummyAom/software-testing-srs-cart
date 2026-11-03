import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { validateProductUpdate } from '@cart/domain';
import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import type { Database } from '../../database.js';
import { authenticatePrincipal, bearerToken } from '../auth/services/auth-principal.js';
import { AuthServiceError } from '../auth/auth-error.js';
import { HttpError, reject } from '../../errors.js';

export function registerAdminRoutes(app: FastifyInstance, config: SupabaseAuthConfig, uiOrigin: string, database: Database): void {
  async function requireAdmin(request: FastifyRequest) {
    const token = bearerToken(request.headers.authorization);
    const principal = await authenticatePrincipal(token, config, database);
    if (principal.role !== 'Admin') {
      reject('AUTH_FORBIDDEN', 'Requires Admin role');
    }
    return principal;
  }

  // OP-15: PUT /admin/products/:productId
  app.put('/admin/products/:productId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAdmin(request);
      const { productId } = request.params as { productId: string };
      const body = (request.body && typeof request.body === 'object') ? request.body as Record<string, unknown> : {};

      // FR-9.1.1 step 1: PRODUCT_NOT_FOUND before field validation.
      const existing = await database.query<{
        product_id: string; name: string; price: number; weight_gram: number;
        available_stock: string; status: 'onSale' | 'offSale';
      }>('select product_id, name, price, weight_gram, available_stock, status from public.products where product_id = $1', [productId]);
      const current = existing.rows[0];
      if (!current) {
        return reply.code(404).send({ error: { code: 'PRODUCT_NOT_FOUND', message: 'ไม่พบสินค้า' } });
      }

      // FR-9.1.1 step 2 via DC-1 pure function.
      const invalidFields = validateProductUpdate({
        ...('price' in body ? { price: body.price } : {}),
        ...('stock' in body ? { stock: body.stock } : {}),
      });
      if (invalidFields.length > 0) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: { fields: invalidFields },
          },
        });
      }

      const price = ('price' in body) ? (body.price as number) : current.price;
      const stock = ('stock' in body) ? (body.stock as number) : Number(current.available_stock);

      const updated = await database.query<{
        product_id: string; name: string; price: number; weight_gram: number;
        available_stock: string; status: 'onSale' | 'offSale';
      }>('update public.products set price = $1, available_stock = $2 where product_id = $3 returning product_id, name, price, weight_gram, available_stock, status', [price, stock, productId]);
      const row = updated.rows[0];
      if (!row) {
        return reply.code(404).send({ error: { code: 'PRODUCT_NOT_FOUND', message: 'ไม่พบสินค้า' } });
      }

      return {
        data: {
          productId: row.product_id,
          name: row.name,
          price: row.price,
          weightGram: row.weight_gram,
          availableStock: Number(row.available_stock),
          status: row.status,
        },
        messages: [],
      };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof HttpError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  // OP-16: POST /admin/products/:productId/status
  app.post('/admin/products/:productId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAdmin(request);
      const { productId } = request.params as { productId: string };
      const body = (request.body && typeof request.body === 'object') ? request.body as Record<string, unknown> : {};
      if (body.status !== 'onSale' && body.status !== 'offSale') {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
      }

      const updated = await database.query<{
        product_id: string; name: string; price: number; weight_gram: number;
        available_stock: string; status: 'onSale' | 'offSale';
      }>('update public.products set status = $1 where product_id = $2 returning product_id, name, price, weight_gram, available_stock, status', [body.status, productId]);
      const row = updated.rows[0];
      if (!row) {
        return reply.code(404).send({ error: { code: 'PRODUCT_NOT_FOUND', message: 'ไม่พบสินค้า' } });
      }

      return {
        data: {
          productId: row.product_id,
          name: row.name,
          price: row.price,
          weightGram: row.weight_gram,
          availableStock: Number(row.available_stock),
          status: row.status,
        },
        messages: [],
      };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof HttpError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  // OP-18: GET /admin/coupons
  app.get('/admin/coupons', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAdmin(request);
      const result = await database.query<{
        code: string; percent: number; min_spend: number; status: 'active' | 'inactive';
      }>('select code, percent, min_spend, status from public.coupons order by code');

      return {
        data: {
          coupons: result.rows.map(r => ({
            code: r.code,
            percent: r.percent,
            minSpend: r.min_spend,
            status: r.status,
          })),
        },
        messages: [],
      };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof HttpError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  // OP-17: POST /admin/coupons/:code/status
  app.post('/admin/coupons/:code/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireAdmin(request);
      const { code } = request.params as { code: string };
      const body = (request.body && typeof request.body === 'object') ? request.body as Record<string, unknown> : {};
      if (body.status !== 'active' && body.status !== 'inactive') {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
      }

      const updated = await database.query('update public.coupons set status = $1 where code = $2 returning code', [body.status, code]);
      if (updated.rowCount === 0) {
        return reply.code(404).send({ error: { code: 'COUPON_NOT_FOUND', message: 'ไม่พบคูปอง' } });
      }

      const result = await database.query<{
        code: string; percent: number; min_spend: number; status: 'active' | 'inactive';
      }>('select code, percent, min_spend, status from public.coupons order by code');

      return {
        data: {
          coupons: result.rows.map(r => ({
            code: r.code,
            percent: r.percent,
            minSpend: r.min_spend,
            status: r.status,
          })),
        },
        messages: [],
      };
    } catch (error) {
      if (error instanceof AuthServiceError || error instanceof HttpError) {
        return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  // Preflight CORS
  const preflight = (methods: string[]) => async (request: FastifyRequest, reply: FastifyReply) => {
    const requestedHeaders = request.headers['access-control-request-headers'];
    if (request.headers.origin !== uiOrigin || !methods.includes(request.headers['access-control-request-method'] ?? '')
      || (requestedHeaders !== undefined && (typeof requestedHeaders !== 'string'
        || requestedHeaders.split(',').some(header => !['authorization', 'content-type'].includes(header.trim().toLowerCase()))))) {
      return reply.code(403).send({ error: { code: 'AUTH_FORBIDDEN', message: 'Origin or request is not allowed' } });
    }
    return reply.header('access-control-allow-methods', methods.join(', '))
      .header('access-control-allow-headers', 'Authorization, Content-Type').code(204).send();
  };

  app.options('/admin/products/:productId', preflight(['PUT']));
  app.options('/admin/products/:productId/status', preflight(['POST']));
  app.options('/admin/coupons', preflight(['GET']));
  app.options('/admin/coupons/:code/status', preflight(['POST']));
}

