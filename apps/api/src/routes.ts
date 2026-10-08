import type { FastifyInstance, FastifyRequest, HTTPMethods } from 'fastify';
import type { Role, Stage, Message, SuccessResponse } from '@cart/contracts';
import { REQUIRED_MESSAGES } from '@cart/contracts';
import { isProductAvailable, validateQuantityChange, validateProductUpdate } from '@cart/domain';
import { reject, noBody, bodyObject, stringField } from './errors.js';
import { cartView, userState } from './views.js';
import { checkout } from './workflow.js';
import type { PersistenceAdapter, StoreState, StoredUser, DeepReadonly } from './persistence.js';
import type { IdentityAdapter } from './mock-identity.js';

interface Access { role?: Role; stage?: Stage }
function authorize(state: DeepReadonly<StoreState>, request: FastifyRequest, identity: IdentityAdapter, access: Access) {
  const id = identity.resolveSession(request.headers.authorization);
  const user = state.users.find(user => user.userId === id);
  if (!user) reject('AUTH_REQUIRED');
  if (access.role && user.role !== access.role) reject('AUTH_FORBIDDEN');
  if (access.stage && user.stage !== access.stage) reject('OPERATION_NOT_ALLOWED');
  return user;
}
export function success<T>(data: T, messages: Message[] = []): SuccessResponse<T> { return { data, messages }; }

export function registerRoutes(app: FastifyInstance, store: PersistenceAdapter, identity: IdentityAdapter, clock: () => number, testMode: boolean) {
  function read<T>(method: HTTPMethods, url: string, access: Access, work: (state: DeepReadonly<StoreState>, user: DeepReadonly<StoredUser>, request: FastifyRequest) => SuccessResponse<T>) {
    app.route({ method, url,
      onRequest: async request => { await store.read(state => { authorize(state, request, identity, access); }); },
      handler: request => store.read(state => work(state, authorize(state, request, identity, access), request)),
    });
  }
  function write<T>(method: HTTPMethods, url: string, access: Access, work: (state: StoreState, user: StoredUser, request: FastifyRequest) => SuccessResponse<T>, status = 200) {
    app.route({ method, url,
      onRequest: async request => { await store.read(state => { authorize(state, request, identity, access); }); },
      handler: async (request, reply) => {
        const result = await store.transaction(state => {
          const principal = authorize(state, request, identity, access);
          const user = state.users.find(user => user.userId === principal.userId)!;
          return work(state, user, request);
        });
        return reply.code(status).send(result);
      },
    });
  }
  write('POST', '/cart/items', { role: 'Customer', stage: 'cart' }, (state, user, request) => {
    const input = bodyObject(request.body, ['productId', 'quantity']);
    const productId = stringField(input, 'productId');
    const product = state.products.find(p => p.productId === productId);
    const line = user.cartLines.find(l => l.productId === productId);
    const code = validateQuantityChange({ operation: 'add', quantity: input.quantity, productExists: !!product, inCart: !!line, available: !!product && isProductAvailable(product.status === 'onSale', product.availableStock), currentQtyInCart: line?.quantity ?? 0, availableStock: product?.availableStock ?? 0 });
    if (code !== 'OK') reject(code);
    const quantity = input.quantity as number;
    if (line) line.quantity += quantity;
    else user.cartLines.push({ productId, quantity });
    return success(cartView(state, user));
  });
  write('PUT', '/cart/items/:productId', { role: 'Customer', stage: 'cart' }, (state, user, request) => {
    const input = bodyObject(request.body, ['quantity']);
    const { productId } = request.params as { productId: string };
    const product = state.products.find(p => p.productId === productId);
    const line = user.cartLines.find(l => l.productId === productId);
    const code = validateQuantityChange({ operation: 'update', quantity: input.quantity, productExists: !!product, inCart: !!line, available: !!product && isProductAvailable(product.status === 'onSale', product.availableStock), currentQtyInCart: line?.quantity ?? 0, availableStock: product?.availableStock ?? 0 });
    if (code !== 'OK') reject(code);
    line!.quantity = input.quantity as number;
    return success(cartView(state, user));
  });
  write('DELETE', '/cart/items/:productId', { role: 'Customer', stage: 'cart' }, (state, user, request) => {
    noBody(request.body);
    if (!user.cartLines.length) reject('CART_EMPTY', REQUIRED_MESSAGES.removeEmptyCart);
    const { productId } = request.params as { productId: string };
    const index = user.cartLines.findIndex(l => l.productId === productId);
    if (index < 0) reject('ITEM_NOT_IN_CART', REQUIRED_MESSAGES.removeAbsentItem);
    user.cartLines.splice(index, 1);
    return success(cartView(state, user), user.cartLines.length ? [] : [{ kind: 'info', code: '', message: REQUIRED_MESSAGES.cartEmptied }]);
  });
  write('PUT', '/cart/coupon', { role: 'Customer', stage: 'cart' }, (state, user, request) => {
    const input = bodyObject(request.body, ['code']);
    const code = stringField(input, 'code');
    const coupon = state.coupons.find(c => c.code === code && c.status === 'active');
    if (!coupon) reject('COUPON_INVALID');
    user.couponCode = code;
    return success(cartView(state, user));
  });
  write('POST', '/cart/checkout', { role: 'Customer', stage: 'cart' }, (state, user, request) => checkout(state, user, request.body, clock), 201);
  write('DELETE', '/cart/checkout', { role: 'Customer', stage: 'checkout' }, (state, user, request) => {
    noBody(request.body);
    const order = state.orders.find(o => o.ownerId === user.userId && o.snapshot.orderId === user.currentOrderId)?.snapshot;
    if (!order || order.status !== 'pending') reject('OPERATION_NOT_ALLOWED');
    for (const line of order.lines) {
      const product = state.products.find(p => p.productId === line.productId);
      if (!product) throw new Error('Broken order product reference');
      product.availableStock += line.quantity;
    }
    order.status = 'cancelled';
    user.stage = 'cart';
    user.currentOrderId = null;
    return success({ cart: cartView(state, user), order });
  });
  if (testMode) {
    app.post('/orders/:orderId/pay-success', request => store.transaction(state => {
      const { orderId } = request.params as { orderId: string };
      const record = state.orders.find(o => o.snapshot.orderId === orderId);
      if (!record) reject('ORDER_NOT_FOUND');
      const user = state.users.find(u => u.userId === record.ownerId);
      if (!user || user.stage !== 'checkout' || user.currentOrderId !== orderId || record.snapshot.status !== 'pending') reject('OPERATION_NOT_ALLOWED');
      const input = bodyObject(request.body, ['result']);
      if (input.result !== 'success') reject('VALIDATION_ERROR', undefined, { fields: ['result'] });
      record.snapshot.status = 'paid';
      user.cartLines = [];
      user.couponCode = null;
      user.stage = 'success';
      return success({ customer: userState(user), order: record.snapshot });
    }));
    app.post('/orders/:orderId/pay-fail', request => store.read(state => {
      const { orderId } = request.params as { orderId: string };
      const record = state.orders.find(o => o.snapshot.orderId === orderId);
      if (!record) reject('ORDER_NOT_FOUND');
      const user = state.users.find(u => u.userId === record.ownerId);
      if (!user || user.stage !== 'checkout' || user.currentOrderId !== orderId || record.snapshot.status !== 'pending') reject('OPERATION_NOT_ALLOWED');
      const input = bodyObject(request.body, ['result']);
      if (input.result !== 'fail') reject('VALIDATION_ERROR', undefined, { fields: ['result'] });
      return success({ customer: userState(user), order: record.snapshot }, [{ kind: 'info', code: '', message: REQUIRED_MESSAGES.paymentFailed }]);
    }));
  }
  write('POST', '/cart/continue', { role: 'Customer', stage: 'success' }, (state, user, request) => {
    noBody(request.body);
    user.stage = 'cart';
    user.currentOrderId = null;
    return success(cartView(state, user));
  });
  read('GET', '/orders/:orderId', { role: 'Customer' }, (state, user, request) => {
    noBody(request.body);
    const { orderId } = request.params as { orderId: string };
    const order = state.orders.find(o => o.ownerId === user.userId && o.snapshot.orderId === orderId);
    if (!order) reject('ORDER_NOT_FOUND');
    return success(order.snapshot);
  });
  read('GET', '/orders', { role: 'Customer' }, (state, user, request) => {
    noBody(request.body);
    const orders = state.orders.filter(o => o.ownerId === user.userId)
      .sort((a, b) => b.snapshot.createdAt.localeCompare(a.snapshot.createdAt) || b.sequence - a.sequence)
      .map(({ snapshot: o }) => ({ orderId: o.orderId, createdAt: o.createdAt, status: o.status, netTotal: o.netTotal }));
    return success({ orders });
  });
  write('PUT', '/admin/products/:productId', { role: 'Admin' }, (state, _user, request) => {
    const { productId } = request.params as { productId: string };
    const product = state.products.find(p => p.productId === productId);
    if (!product) reject('PRODUCT_NOT_FOUND');
    const input = bodyObject(request.body, ['price', 'stock'], []);
    const fields = validateProductUpdate(input);
    if (fields.length) reject('VALIDATION_ERROR', undefined, { fields });
    if (Object.hasOwn(input, 'price')) product.price = input.price as number;
    if (Object.hasOwn(input, 'stock')) product.availableStock = input.stock as number;
    return success(product);
  });
  write('POST', '/admin/products/:productId/status', { role: 'Admin' }, (state, _user, request) => {
    const { productId } = request.params as { productId: string };
    const product = state.products.find(p => p.productId === productId);
    if (!product) reject('PRODUCT_NOT_FOUND');
    const input = bodyObject(request.body, ['status']);
    if (input.status !== 'onSale' && input.status !== 'offSale') reject('VALIDATION_ERROR', undefined, { fields: ['status'] });
    product.status = input.status;
    return success(product);
  });
  write('POST', '/admin/coupons/:code/status', { role: 'Admin' }, (state, _user, request) => {
    const { code } = request.params as { code: string };
    const coupon = state.coupons.find(c => c.code === code);
    if (!coupon) reject('COUPON_NOT_FOUND');
    const input = bodyObject(request.body, ['status']);
    if (input.status !== 'active' && input.status !== 'inactive') reject('VALIDATION_ERROR', undefined, { fields: ['status'] });
    coupon.status = input.status;
    return success({ coupons: state.coupons });
  });
  read('GET', '/admin/coupons', { role: 'Admin' }, (state, _user, request) => { noBody(request.body); return success({ coupons: state.coupons }); });
  read('GET', '/auth/me', {}, (_state, user, request) => { noBody(request.body); return success(userState(user)); });
  read('GET', '/cart', { role: 'Customer' }, (state, user, request) => { noBody(request.body); return success(cartView(state, user)); });
  read('GET', '/products', {}, (state, user, request) => {
    noBody(request.body);
    return success({ products: state.products.filter(p => user.role === 'Admin' || isProductAvailable(p.status === 'onSale', p.availableStock)).map(p => {
      const { status, ...product } = p;
      return user.role === 'Admin' ? { ...product, status } : product;
    }) });
  });
}
