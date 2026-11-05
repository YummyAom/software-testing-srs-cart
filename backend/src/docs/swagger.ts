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

function cartResponse(description: string) {
  return { description, content: { 'application/json': { schema: {
    type: 'object' as const, required: ['data', 'messages'], properties: {
      data: { $ref: '#/components/schemas/Cart' }, messages: { type: 'array' as const, items: {} },
    },
  } } } };
}

function adminProductResponse(description: string) {
  return { description, content: { 'application/json': { schema: {
    type: 'object' as const, required: ['data', 'messages'], properties: {
      data: { $ref: '#/components/schemas/AdminProduct' }, messages: { type: 'array' as const, items: {} },
    },
  } } } };
}

function couponListResponse(description: string) {
  return { description, content: { 'application/json': { schema: {
    type: 'object' as const, required: ['data', 'messages'], properties: {
      data: { type: 'object' as const, required: ['coupons'], properties: {
        coupons: { type: 'array' as const, items: { $ref: '#/components/schemas/Coupon' } },
      } },
      messages: { type: 'array' as const, items: {} },
    },
  } } } };
}

function paymentOperation(result: 'success' | 'fail') {
  const success = result === 'success';
  return { post: {
    operationId: success ? 'paySuccess' : 'payFail', tags: ['Payment Simulator'],
    summary: success ? 'Simulate a successful gateway payment' : 'Simulate a failed gateway payment',
    description: 'Gateway simulator: registered only in development and test environments (D-03). No bearer token. '
      + (success ? 'Marks the pending order paid and moves the customer to success stage.'
        : 'Marks the pending order cancelled, returns the customer to cart stage and adds an info message.'),
    security: [],
    parameters: [{ name: 'orderId', in: 'path' as const, required: true, schema: { type: 'string' as const, format: 'uuid' } }],
    requestBody: { required: true, content: { 'application/json': {
      schema: { type: 'object' as const, required: ['result'], additionalProperties: false,
        properties: { result: { type: 'string' as const, enum: [result] } } },
      example: { result },
    } } },
    responses: {
      '200': { description: success ? 'Paid order and customer state' : 'Cancelled order and customer state', content: { 'application/json': {
        schema: { type: 'object' as const, required: ['data', 'messages'], properties: {
          data: { type: 'object' as const, required: ['customer', 'order'], properties: {
            customer: { $ref: '#/components/schemas/UserState' }, order: { $ref: '#/components/schemas/Order' },
          } },
          messages: { type: 'array' as const, items: {} },
        } },
        ...(success ? {} : { example: { messages: [{ kind: 'info', code: '', message: 'การชำระเงินล้มเหลว กรุณาลองใหม่' }] } }),
      } } },
      '400': {
        description: 'Invalid result body, order not pending, or customer not in checkout stage',
        content: { 'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          examples: {
            validation: { value: { error: { code: 'VALIDATION_ERROR', message: 'รูปแบบหรือช่วงของข้อมูลไม่ถูกต้อง', details: { fields: ['result'] } } } },
            notPending: { value: { error: { code: 'OPERATION_NOT_ALLOWED', message: 'ดำเนินการได้เฉพาะออเดอร์ที่รอชำระเงิน' } } },
            wrongStage: { value: { error: { code: 'OPERATION_NOT_ALLOWED', message: 'ดำเนินการได้เฉพาะขณะอยู่ในขั้นชำระเงิน' } } },
          },
        } },
      },
      '404': errorResponse('Order does not exist', 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์'),
      '503': errorResponse('Payment result could not be saved', 'ORDER_UNAVAILABLE', 'ไม่สามารถบันทึกผลการชำระเงินได้'),
    },
  } };
}

// Documentation only: request validation remains in the controller.
const specification: StaticDocumentSpec = {
  document: {
    openapi: '3.0.3',
    info: {
      title: 'Shopping Cart API',
      version: '1.0.0',
      description: 'Username/password login (Supabase Auth), product listing, customer cart, checkout and orders, payment gateway simulator, and admin product/coupon management. Username, role and membership come from app_users.',
    },
    servers: [{ url: '/', description: 'Current API server' }],
    tags: [
      { name: 'Auth', description: 'Authentication' }, { name: 'Products', description: 'Product catalog' },
      { name: 'Cart', description: 'Customer cart' }, { name: 'Orders', description: 'Customer orders' },
      { name: 'Payment Simulator', description: 'Gateway simulator (development/test only)' },
      { name: 'Admin', description: 'Admin product and coupon management' },
      { name: 'Test', description: 'Test control (APP_ENV=test only)' },
    ],
    paths: {
      '/auth/login': {
        post: {
          operationId: 'login',
          tags: ['Auth'],
          summary: 'Login with username (or email) and password',
          description: 'Use an existing Supabase Auth account linked to app_users. Returns tokens and userId/username/email/role/memberTier. No token is required to call Login. Roles Admin/Customer become admin/customer; normal and Admin NULL tier become free, prime stays prime.',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: { username: 'cus_normal', password: 'YOUR_PASSWORD' },
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
      '/auth/logout': {
        post: {
          operationId: 'logout',
          tags: ['Auth'],
          summary: 'Log out the current session',
          description: 'Revokes the current Supabase session refresh token. The client must discard its stored tokens. An issued access token remains valid until it expires.',
          security: [{ bearerAuth: [] }],
          responses: {
            '204': { description: 'Current session logged out' },
            '401': {
              description: 'Bearer token is missing, invalid or expired',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  missing: { value: { error: { code: 'AUTH_REQUIRED', message: 'Bearer access token is required' } } },
                  invalid: { value: { error: { code: 'AUTH_REQUIRED', message: 'Invalid or expired access token' } } },
                },
              } },
            },
            '403': errorResponse('Request Origin is not allowed', 'AUTH_FORBIDDEN', 'Origin or request is not allowed'),
            '503': errorResponse('Supabase Auth is unavailable', 'AUTH_UNAVAILABLE', 'Authentication service is unavailable'),
          },
        },
      },
      '/products': {
        get: {
          operationId: 'listProducts',
          tags: ['Products'],
          summary: 'List products visible to the current user',
          description: 'Customer sees on-sale products with stock. Admin sees all products including status.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Products visible to the current user',
              content: { 'application/json': {
                schema: { type: 'object', required: ['data', 'messages'], properties: {
                  data: { type: 'object', required: ['products'], properties: {
                    products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                  } },
                  messages: { type: 'array', items: {} },
                } },
              } },
            },
            '401': errorResponse('Bearer token is missing, invalid or expired', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Profile is missing or request Origin is not allowed', 'AUTH_PROFILE_NOT_FOUND', 'Account is not configured in app_users'),
            '503': errorResponse('Auth, profile or product service is unavailable', 'PRODUCTS_UNAVAILABLE', 'Unable to load products'),
          },
        },
      },
      '/cart/items': {
        post: {
          operationId: 'addCartItem',
          tags: ['Cart'],
          summary: 'Add a product to the current customer cart',
          description: 'Adds quantity to an existing cart line. Allowed only in cart stage. Cart data is stored in PostgreSQL.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': {
            schema: { type: 'object', required: ['productId', 'quantity'], additionalProperties: false,
              properties: { productId: { type: 'string', minLength: 1 }, quantity: { type: 'integer', minimum: 1, maximum: 10 } } },
            example: { productId: 'P1', quantity: 2 },
          } } },
          responses: {
            '200': { description: 'Complete cart after the addition', content: { 'application/json': {
              schema: { type: 'object', required: ['data', 'messages'], properties: {
                data: { $ref: '#/components/schemas/Cart' }, messages: { type: 'array', items: {} },
              } },
            } } },
            '400': errorResponse('Invalid quantity, unavailable product, insufficient stock or wrong stage', 'QTY_OUT_OF_RANGE', 'quantity ต้องอยู่ระหว่าง 1 ถึง 10 และยอดรวมต่อสินค้าไม่เกิน 10'),
            '401': errorResponse('Bearer token is missing, invalid or expired', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Only customers may add items', 'AUTH_FORBIDDEN', 'Only customers can add items to a cart'),
            '404': errorResponse('Product does not exist', 'PRODUCT_NOT_FOUND', 'ไม่พบสินค้า'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
      },
      '/cart/items/{productId}': {
        put: {
          operationId: 'updateCartQuantity',
          tags: ['Cart'],
          summary: 'Replace the quantity of an item in the current customer cart',
          description: 'Requires a cart line and cart stage. Replaces the quantity rather than adding to it.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'productId', in: 'path', required: true,
            schema: { type: 'string', minLength: 1 }, example: 'P1' }],
          requestBody: { required: true, content: { 'application/json': {
            schema: { type: 'object', required: ['quantity'], additionalProperties: false,
              properties: { quantity: { type: 'integer', minimum: 1, maximum: 10 } } },
            example: { quantity: 3 },
          } } },
          responses: {
            '200': { description: 'Complete cart after replacing the quantity', content: { 'application/json': {
              schema: { type: 'object', required: ['data', 'messages'], properties: {
                data: { $ref: '#/components/schemas/Cart' }, messages: { type: 'array', items: {} },
              } },
            } } },
            '400': errorResponse('Invalid quantity, unavailable product, insufficient stock or wrong stage', 'QTY_OUT_OF_RANGE', 'quantity ต้องอยู่ระหว่าง 1 ถึง 10'),
            '401': errorResponse('Bearer token is missing, invalid or expired', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Only customers may update a cart', 'AUTH_FORBIDDEN', 'Only customers can change a cart'),
            '404': errorResponse('Product is not in the cart', 'ITEM_NOT_IN_CART', 'ไม่พบสินค้าในตะกร้า'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
        delete: {
          operationId: 'removeCartItem', tags: ['Cart'], summary: 'Remove one item from the cart',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': cartResponse('Complete cart; an info message says ตะกร้าว่าง after the last line is removed'),
            '400': errorResponse('Cart is empty or wrong stage', 'CART_EMPTY', 'ไม่มีสินค้าให้ลบ'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can access a cart'),
            '404': errorResponse('Item absent from a nonempty cart', 'ITEM_NOT_IN_CART', 'ไม่พบสินค้าในตะกร้า'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
      },
      '/cart/coupon': {
        put: {
          operationId: 'applyCartCoupon', tags: ['Cart'], summary: 'Attach or replace a coupon',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['code'], additionalProperties: false,
            properties: { code: { type: 'string', minLength: 1 } },
          }, example: { code: 'SAVE10' } } } },
          responses: {
            '200': cartResponse('Cart with the attached coupon code'),
            '400': errorResponse('Coupon invalid or cart stage disallows changes', 'COUPON_INVALID', 'คูปองไม่สามารถใช้ได้'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can access a cart'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
      },
      '/cart': {
        get: {
          operationId: 'viewCart', tags: ['Cart'], summary: 'Read the current cart',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': cartResponse('Cart state, items, count and checkoutEnabled'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can access a cart'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
      },
      '/cart/checkout': {
        post: {
          operationId: 'pressCheckout', tags: ['Cart'], summary: 'Create a pending order from the cart',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['zone', 'speed'], additionalProperties: false,
            properties: { zone: { type: 'string', enum: ['inCity', 'upcountry', 'remote'] },
              speed: { type: 'string', enum: ['standard', 'express'] } },
          }, example: { zone: 'inCity', speed: 'standard' } } } },
          responses: {
            '201': { description: 'Pending order and customer checkout state', content: { 'application/json': {
              schema: { type: 'object', properties: { data: { type: 'object', properties: {
                customer: { type: 'object' }, order: { $ref: '#/components/schemas/Order' },
              } }, messages: { type: 'array', items: {} } } },
            } } },
            '400': errorResponse('Invalid delivery, empty cart, unavailable items, excessive weight or wrong stage', 'CART_EMPTY', 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can access a cart'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
        delete: {
          operationId: 'cancelCheckout', tags: ['Cart'], summary: 'Cancel current pending checkout',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Cart and cancelled order', content: { 'application/json': {
              schema: { type: 'object', properties: { data: { type: 'object', properties: {
                cart: { $ref: '#/components/schemas/Cart' }, order: { $ref: '#/components/schemas/Order' },
              } }, messages: { type: 'array', items: {} } } },
            } } },
            '400': errorResponse('No pending checkout', 'OPERATION_NOT_ALLOWED', 'ดำเนินการได้เฉพาะขณะอยู่ในขั้นตะกร้า'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can access a cart'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
      },
      '/cart/continue': {
        post: {
          operationId: 'continueShopping', tags: ['Cart'], summary: 'Return to cart stage after a successful payment',
          description: 'Allowed only in success stage. Resets stage to cart and clears currentOrderId.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': cartResponse('Cart in cart stage'),
            '400': errorResponse('Customer is not in success stage', 'OPERATION_NOT_ALLOWED', 'ดำเนินการได้เฉพาะขณะอยู่ในขั้นตะกร้า'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can access a cart'),
            '503': errorResponse('Cart storage is unavailable', 'CART_UNAVAILABLE', 'ไม่สามารถเข้าถึงตะกร้าได้'),
          },
        },
      },
      '/orders': {
        get: {
          operationId: 'listOrders', tags: ['Orders'], summary: 'List orders owned by the current customer',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Order summaries owned by the customer', content: { 'application/json': {
              schema: { type: 'object', required: ['data', 'messages'], properties: {
                data: { type: 'object', required: ['orders'], properties: {
                  orders: { type: 'array', items: { $ref: '#/components/schemas/OrderSummary' } },
                } },
                messages: { type: 'array', items: {} },
              } },
            } } },
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can view orders'),
            '503': errorResponse('Order data unavailable', 'ORDER_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลรายการคำสั่งซื้อได้'),
          },
        },
      },
      '/orders/{orderId}': {
        get: {
          operationId: 'viewOrder', tags: ['Orders'], summary: 'Read an owned order and its item snapshots',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'orderId', in: 'path', required: true,
            schema: { type: 'string', format: 'uuid' } }],
          responses: {
            '200': { description: 'Owned order with complete item snapshots', content: { 'application/json': {
              schema: { type: 'object', required: ['data', 'messages'], properties: {
                data: { $ref: '#/components/schemas/Order' }, messages: { type: 'array', items: {} },
              } },
            } } },
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Customer role required', 'AUTH_FORBIDDEN', 'Only customers can view orders'),
            '404': errorResponse('Order missing or owned by another customer', 'ORDER_NOT_FOUND', 'ไม่พบออเดอร์'),
            '503': errorResponse('Order data unavailable', 'ORDER_UNAVAILABLE', 'ไม่สามารถอ่านข้อมูลออเดอร์ได้'),
          },
        },
      },
      '/orders/{orderId}/pay-success': paymentOperation('success'),
      '/orders/{orderId}/pay-fail': paymentOperation('fail'),
      '/auth/me': {
        get: {
          operationId: 'me', tags: ['Auth'], summary: 'Read the current user state',
          description: 'Customer receives memberTier, stage and currentOrderId. Admin receives null memberTier, stage and currentOrderId.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Current user state', content: { 'application/json': {
              schema: { type: 'object', required: ['data', 'messages'], properties: {
                data: { $ref: '#/components/schemas/UserState' }, messages: { type: 'array', items: {} },
              } },
            } } },
            '401': errorResponse('Bearer token is missing, invalid or expired', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Profile is missing', 'AUTH_PROFILE_NOT_FOUND', 'Account is not configured in app_users'),
            '503': errorResponse('Auth or profile service is unavailable', 'AUTH_UNAVAILABLE', 'Authentication service is unavailable'),
          },
        },
      },
      '/admin/products/{productId}': {
        put: {
          operationId: 'adminUpdateProduct', tags: ['Admin'], summary: 'Update product price and/or stock',
          description: 'Admin only. PRODUCT_NOT_FOUND is checked before field validation (FR-9.1.1). Omitted fields keep their current value. Values are validated raw (no coercion).',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' }, example: 'P1' }],
          requestBody: { required: true, content: { 'application/json': {
            schema: { type: 'object', additionalProperties: false, properties: {
              price: { type: 'integer', minimum: 0 }, stock: { type: 'integer', minimum: 0 },
            } },
            example: { price: 500, stock: 15 },
          } } },
          responses: {
            '200': adminProductResponse('Updated product'),
            '400': {
              description: 'price or stock is invalid',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: { fields: ['price'] } } },
              } },
            },
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Admin role required', 'AUTH_FORBIDDEN', 'Requires Admin role'),
            '404': errorResponse('Product does not exist', 'PRODUCT_NOT_FOUND', 'ไม่พบสินค้า'),
          },
        },
      },
      '/admin/products/{productId}/status': {
        post: {
          operationId: 'adminSetProductStatus', tags: ['Admin'], summary: 'Put a product on or off sale',
          description: 'Admin only. A missing product is reported before an invalid status (FR-9.3.1, SOI-02).',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' }, example: 'P1' }],
          requestBody: { required: true, content: { 'application/json': {
            schema: { type: 'object', required: ['status'], additionalProperties: false, properties: {
              status: { type: 'string', enum: ['onSale', 'offSale'] },
            } },
            example: { status: 'offSale' },
          } } },
          responses: {
            '200': adminProductResponse('Product with the new status'),
            '400': {
              description: 'status is not onSale or offSale',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: { code: 'VALIDATION_ERROR', message: 'Invalid status', details: { fields: ['status'] } } },
              } },
            },
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Admin role required', 'AUTH_FORBIDDEN', 'Requires Admin role'),
            '404': errorResponse('Product does not exist', 'PRODUCT_NOT_FOUND', 'ไม่พบสินค้า'),
          },
        },
      },
      '/admin/coupons': {
        get: {
          operationId: 'adminListCoupons', tags: ['Admin'], summary: 'List all coupons ordered by code',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': couponListResponse('All coupons'),
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Admin role required', 'AUTH_FORBIDDEN', 'Requires Admin role'),
          },
        },
      },
      '/admin/coupons/{code}/status': {
        post: {
          operationId: 'adminSetCouponStatus', tags: ['Admin'], summary: 'Activate or deactivate a coupon',
          description: 'Admin only. A missing coupon is reported before an invalid status (FR-10.1.1, SOI-02). Returns the full coupon list.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' }, example: 'SAVE10' }],
          requestBody: { required: true, content: { 'application/json': {
            schema: { type: 'object', required: ['status'], additionalProperties: false, properties: {
              status: { type: 'string', enum: ['active', 'inactive'] },
            } },
            example: { status: 'inactive' },
          } } },
          responses: {
            '200': couponListResponse('All coupons after the change'),
            '400': {
              description: 'status is not active or inactive',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: { code: 'VALIDATION_ERROR', message: 'Invalid status', details: { fields: ['status'] } } },
              } },
            },
            '401': errorResponse('Bearer token required', 'AUTH_REQUIRED', 'Bearer access token is required'),
            '403': errorResponse('Admin role required', 'AUTH_FORBIDDEN', 'Requires Admin role'),
            '404': errorResponse('Coupon does not exist', 'COUPON_NOT_FOUND', 'ไม่พบคูปอง'),
          },
        },
      },
      '/test/reset': {
        post: {
          operationId: 'testReset', tags: ['Test'], summary: 'Reset products, coupons, carts and orders to seed data',
          description: 'Registered only when APP_ENV=test (DC-3.1/DC-3.2). Requires the X-Test-Reset-Token header. app_users are kept.',
          security: [{ testResetToken: [] }],
          responses: {
            '200': { description: 'Data reset', content: { 'application/json': {
              schema: { type: 'object', required: ['data', 'messages'], properties: {
                data: { type: 'object', required: ['reset'], properties: { reset: { type: 'boolean', enum: [true] } } },
                messages: { type: 'array', items: {} },
              } },
            } } },
            '403': errorResponse('Reset token missing or wrong', 'TEST_CONTROL_FORBIDDEN', 'Test control request is not allowed'),
            '503': errorResponse('Reset transaction failed', 'TEST_RESET_FAILED', 'Unable to reset test data'),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        testResetToken: { type: 'apiKey', in: 'header', name: 'X-Test-Reset-Token' },
      },
      schemas: {
        UserState: {
          type: 'object', required: ['userId', 'username', 'role', 'memberTier', 'stage', 'currentOrderId'],
          properties: {
            userId: { type: 'string', format: 'uuid' }, username: { type: 'string' },
            role: { type: 'string', enum: ['Customer', 'Admin'] },
            memberTier: { type: 'string', enum: ['normal', 'prime'], nullable: true, description: 'null for Admin' },
            stage: { type: 'string', enum: ['cart', 'checkout', 'success'], nullable: true, description: 'null for Admin' },
            currentOrderId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        AdminProduct: {
          type: 'object', required: ['productId', 'name', 'price', 'weightGram', 'availableStock', 'status'],
          properties: {
            productId: { type: 'string' }, name: { type: 'string' }, price: { type: 'integer' },
            weightGram: { type: 'integer' }, availableStock: { type: 'integer' },
            status: { type: 'string', enum: ['onSale', 'offSale'] },
          },
        },
        Coupon: {
          type: 'object', required: ['code', 'percent', 'minSpend', 'status'],
          properties: {
            code: { type: 'string' }, percent: { type: 'integer' }, minSpend: { type: 'integer' },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
        OrderSummary: {
          type: 'object', required: ['orderId', 'createdAt', 'status', 'netTotal'],
          properties: {
            orderId: { type: 'string', format: 'uuid' }, createdAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'paid', 'cancelled'] }, netTotal: { type: 'integer' },
          },
        },
        Product: {
          type: 'object', required: ['productId', 'name', 'price', 'weightGram', 'availableStock'],
          properties: {
            productId: { type: 'string' }, name: { type: 'string' }, price: { type: 'integer' },
            weightGram: { type: 'integer' }, availableStock: { type: 'integer' },
            status: { type: 'string', enum: ['onSale', 'offSale'], description: 'Returned only for Admin' },
          },
        },
        CartLine: {
          type: 'object', required: ['productId', 'name', 'unitPrice', 'weightGram', 'quantity', 'available'],
          properties: {
            productId: { type: 'string' }, name: { type: 'string' }, unitPrice: { type: 'integer' },
            weightGram: { type: 'integer' }, quantity: { type: 'integer' }, available: { type: 'boolean' },
          },
        },
        Cart: {
          type: 'object', required: ['stage', 'currentOrderId', 'couponCode', 'lineCount', 'checkoutEnabled', 'subtotal', 'lines'],
          properties: {
            stage: { type: 'string', enum: ['cart', 'checkout', 'success'] },
            currentOrderId: { type: 'string', nullable: true }, couponCode: { type: 'string', nullable: true },
            lineCount: { type: 'integer' }, checkoutEnabled: { type: 'boolean' }, subtotal: { type: 'integer' },
            lines: { type: 'array', items: { $ref: '#/components/schemas/CartLine' } },
          },
        },
        Order: {
          type: 'object', required: ['orderId', 'createdAt', 'status', 'subtotal', 'discount',
            'shippingFee', 'netTotal', 'zone', 'speed', 'couponCode', 'discountSource',
            'totalWeightGram', 'lines'],
          properties: {
            orderId: { type: 'string', format: 'uuid' }, createdAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'paid', 'cancelled'] },
            subtotal: { type: 'integer' }, discount: { type: 'integer' },
            shippingFee: { type: 'integer' }, netTotal: { type: 'integer' },
            zone: { type: 'string' }, speed: { type: 'string' },
            couponCode: { type: 'string', nullable: true }, discountSource: { type: 'string' },
            totalWeightGram: { type: 'integer' }, lines: { type: 'array', items: { $ref: '#/components/schemas/OrderLine' } },
          },
        },
        OrderLine: {
          type: 'object', required: ['productId', 'name', 'unitPrice', 'quantity', 'weightGram'],
          properties: {
            productId: { type: 'string' }, name: { type: 'string' }, unitPrice: { type: 'integer' },
            quantity: { type: 'integer' }, weightGram: { type: 'integer' },
          },
        },
        LoginRequest: {
          type: 'object', required: ['password'], additionalProperties: false,
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 254, description: 'Username or email' },
            email: { type: 'string', format: 'email', maxLength: 254, description: 'Optional email fallback' },
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
