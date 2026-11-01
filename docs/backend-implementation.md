# Backend implementation — Supabase Auth & Store Operations

This document describes the active `backend/` implementation under branch `feat/backend-payment`.

## Implemented Backend Modules

| Path | Responsibility |
| --- | --- |
| `backend/src/modules/auth/auth-routes.ts` | Register Login (`/auth/login`), Logout (`/auth/logout`), and User State (`/auth/me`) routes |
| `backend/src/modules/auth/auth-controller.ts` | Validate authentication requests, translate outcomes to HTTP DTOs |
| `backend/src/modules/auth/services/auth-service.ts` | Login/Logout authentication logic |
| `backend/src/modules/auth/services/auth-principal.ts` | Verify JWT and retrieve authoritative role/tier from `app_users` |
| `backend/src/modules/product/product-routes.ts` | Product listing (`GET /products`) with role-based filtering |
| `backend/src/modules/cart/cart-routes.ts` | Cart mutation endpoints, checkout (`POST /cart/checkout`), cancellation, and continue shopping (`POST /cart/continue`) |
| `backend/src/modules/cart/repositories/cart-repository.ts` | Atomic cart workflow, coupon binding, stock reservation, and continue shopping logic |
| `backend/src/modules/order/order-routes.ts` | Order snapshot view (`GET /orders/:orderId`), payment success (`POST /orders/:orderId/pay-success`), and payment failure (`POST /orders/:orderId/pay-fail`) |
| `backend/src/modules/order/repositories/order-repository.ts` | Atomic payment simulation transaction, snapshot integrity, and order retrieval |
| `backend/src/app.ts` | Fastify instance, CORS, bounded request bodies, and global HTTP error handling |
| `backend/src/database.ts` | PostgreSQL client pool and single-connection transaction helper |
| `backend/src/docs/swagger.ts` | Swagger UI at `/docs/` and OpenAPI specifications |

---

## Backend Payment Simulator (OP-10 & OP-11)

The payment system is implemented entirely on the **backend** as an atomic state-transition simulator according to SRS-CART-002 v1.8 (§6 / §6.3 / DC-3.3):

1. **`POST /orders/:orderId/pay-success` (OP-10)**
   - Request Body: `{ "result": "success" }`
   - Validates that the order exists, has status `pending`, and is owned by a customer currently in stage `checkout`.
   - Executes inside a single database transaction:
     - Transitions order status to `paid`.
     - Clears all items in `cart_lines` for that customer.
     - Sets customer `stage` to `success` and unbinds coupon (`coupon_code = null`).
     - **Preserves available stock** (no extra stock modification since stock was already reserved during checkout).
   - Rejects duplicate calls or already-settled orders with `400 OPERATION_NOT_ALLOWED`.

2. **`POST /orders/:orderId/pay-fail` (OP-11)**
   - Request Body: `{ "result": "fail" }`
   - Validates that the order exists, has status `pending`, and is owned by a customer currently in stage `checkout`.
   - Leaves all database state unchanged (order remains `pending`, stage remains `checkout`, stock reservation remains).
   - Returns informative response message: `"การชำระเงินล้มเหลว กรุณาลองใหม่"`.
   - Customers can retry payment repeatedly without side-effects.

3. **`POST /cart/continue` (OP-12)**
   - Requires Customer Bearer token.
   - Validates that the customer is in stage `success`.
   - Resets customer `stage` to `cart` and `current_order_id` to `null`.
   - Returns an empty cart ready for new shopping.

4. **`GET /auth/me` (Support Endpoint)**
   - Requires Bearer token.
   - For Customer: returns `UserState` with `userId`, `username`, `role: 'Customer'`, `memberTier`, `stage`, and `currentOrderId`.
   - For Admin: returns `UserState` with `role: 'Admin'`, and `null` for `memberTier`, `stage`, and `currentOrderId`.

---

## Test Accounts & Credentials

| Role | Username | Email | Password | Supabase UID | Member Tier |
| --- | --- | --- | --- | --- | --- |
| **Admin** | `admin` | `admin@email.com` | `Admin@123456` | `851cb40a-3d75-44bd-874a-9951ff57bbca` | `null` (`free`) |
| **Normal Customer** | `cus_normal` | `cusnormal@gmail.com` | `Normal@123456` | `762e53a6-0e5c-4ddc-8400-e56551826e9e` | `normal` (`free`) |
| **Prime Customer** | `cus_prime` | `cusprime@gmail.com` | `Prime@123456` | `b740a578-b99b-467c-a67d-d02c687994c2` | `prime` |
