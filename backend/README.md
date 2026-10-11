# Supabase Auth API

TypeScript + Fastify backend exposing Supabase Auth, product listing, and customer cart/checkout endpoints with CORS preflights and Swagger documentation.
Credentials are verified by Supabase Auth; username, role and membership come from `app_users`.
No mock sessions, payment, reset or registration is implemented. Checkout creates and cancels pending orders; payment completion is not implemented.

## Structure

```text
src/
├── index.ts                              Server startup
├── config.ts                             Environment validation
├── app.ts                                Fastify setup, CORS and error handling
├── errors.ts                             HTTP validation helpers
├── interfaces/                           Shared TypeScript contracts
│   ├── auth.ts                           Login request, tokens, sessions and response
│   ├── user.ts                           Database profile, Auth user and API user
│   ├── repositories.ts                   Repository interfaces and outcomes
│   ├── config.ts                         Supabase, application and server config
│   ├── http.ts                           HTTP error codes
│   └── index.ts                          Type exports
├── docs/swagger.ts                       Swagger UI and Login OpenAPI specification
└── modules/
    ├── cart/                              Add item controller and Supabase RPC repository
    ├── product/                           Product list controller, service and repository
    └── auth/
        ├── auth-routes.ts                Register auth URLs, preflights and dependencies
        ├── auth-controller.ts            Validate login request and format HTTP response
        ├── auth-service.ts               Handle authentication outcomes
        └── repositories/
            ├── supabase-auth-repository.ts  Call Supabase Auth
            └── app-user-repository.ts       Read the authenticated user's app_users profile
```

```text
Request → Auth route → Controller → Service → Repository → Supabase
```

All layers import shared contracts from `src/interfaces/`. For example:

```ts
import type { LoginRequest, LoginResponse, LoginUser, AuthTokens } from './interfaces/index.js';
```

Add future feature groups under `src/modules/` with their own route, controller and service files.
Register each group's routes in `app.ts`; keep cross-feature configuration and HTTP helpers at the top level.

## Products

`GET /products` requires `Authorization: Bearer <accessToken>` from the current login API.
It verifies the token with Supabase Auth and reads the user's role from `app_users`.
Customers receive only on-sale products with stock and no `status` field. Admins receive
all products including `status`. Success uses `{ "data": { "products": [...] }, "messages": [] }`.
Missing tokens return `401 AUTH_REQUIRED`; invalid tokens return `401 AUTH_INVALID_TOKEN`.

Run [sql/enable-product-read.sql](sql/enable-product-read.sql) in Supabase SQL Editor after
the profile-read SQL. It grants authenticated users read-only product columns and adds
an RLS policy enforcing the same role rules. This SQL has not been applied remotely.

## Add an item to the cart

The API writes structured JSON logs to the terminal in development. Fastify's
`reqId` ties the incoming request, cart steps, and final response together.
For cart mutations, look for `cart_add_failed` or `cart_update_failed`: `reason=timeout` or
`reason=transport` means Supabase could not be reached, `reason=upstream` includes its HTTP status and
error code (and `permissionTarget` for recognizable permission failures),
and `reason=invalid_response` means the RPC returned unexpected
data. Logs omit request bodies, bearer tokens, cookies, and passwords.
Logging is silent in `APP_ENV=test`.

Run [sql/enable-cart-add-item.sql](sql/enable-cart-add-item.sql) in Supabase SQL Editor.
It installs an authenticated Customer-only RPC that validates and writes the cart item
atomically. The RPC uses the Auth user ID and does not grant direct table access. This SQL
has not been applied remotely. It requires the `customer_state` and `cart_lines` tables
from the project schema. It also marks the schema's deferred workflow trigger function
as `SECURITY DEFINER`; otherwise that trigger can fail at commit with PostgreSQL
`42501` on `customer_state` after the cart RPC has finished.

Send `POST /cart/items` with `Authorization: Bearer <accessToken>`,
`Content-Type: application/json`, and `{ "productId": "P1", "quantity": 2 }`.
Use `quantity`; `qty` is not accepted. Adding an existing product increases its cart
quantity. A successful response contains the complete cart as `data`, including `stage`,
`lines`, `lineCount`, and `subtotal`, with `messages: []`. Domain failures return
`{ "error": { "code": "...", "message": "..." } }` and leave the cart unchanged.

For an existing line, run [sql/enable-cart-update-quantity.sql](sql/enable-cart-update-quantity.sql)
in Supabase SQL Editor, then send `PUT /cart/items/P1` with `{ "quantity": 3 }`
and a Customer Bearer token. This replaces the line quantity; it does not add to it.
The RPC returns `ITEM_NOT_IN_CART` for an absent line and preserves the cart on rejection.

Run [sql/enable-cart-workflow.sql](sql/enable-cart-workflow.sql) in the same Supabase project to install
`cart_remove_item`, `cart_apply_coupon`, `cart_view`, `cart_press_checkout`, and
`cart_cancel_checkout`. The script depends on the schema and the two cart SQL files above.
These RPCs use the Customer's bearer token and keep each mutation in one database
transaction. The script has not been applied remotely.

- `DELETE /cart/items/P1` removes a line. Removing the last line returns the empty cart
  with the info message `ตะกร้าว่าง`.
- `PUT /cart/coupon` accepts `{ "code": "SAVE10" }` and attaches an active coupon,
  including when the cart is empty. Eligibility is checked at checkout.
- `GET /cart` reads live cart state and product values.
- `POST /cart/checkout` accepts `{ "zone": "inCity", "speed": "standard" }` and
  returns HTTP 201 with a pending order snapshot. It reserves stock and may return a
  `COUPON_NOT_APPLICABLE` notice when the attached coupon cannot be used.
- `DELETE /cart/checkout` cancels the current pending order, restores its reserved
  stock, and returns the cart and cancelled order. It has no order ID path parameter.

## Run

Use Node 22/npm 11. Configure `backend/.env` with the names below; the example file has placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
API_PORT=3000
UI_ORIGIN=http://localhost:5173
```

From the repository root:

```sh
npm ci
npm run dev
```

Or run `npm run dev` from `backend/`. Both use its `.env`; optional root `.env` is loaded first.
Exported process variables take precedence. Only the two Supabase settings above are needed;
no secret or service-role key is used. Profile queries send the publishable key in `apikey`
and the freshly authenticated user's access token in `Authorization: Bearer ...`.

Run [sql/enable-own-profile-read.sql](sql/enable-own-profile-read.sql) once in Supabase SQL Editor.
It adds SELECT access only to `id`, `username`, `role`, `member_tier` and an own-row RLS policy.
It does not grant writes or password-hash access. This deliberately changes the initial
deny-all authenticated read setup, following [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
The SQL has not been applied remotely. Until grants/policy are installed, profile reads may
return `503 AUTH_PROFILE_UNAVAILABLE`; rows hidden by RLS return `403 AUTH_PROFILE_NOT_FOUND`.

For this Supabase Auth flow, `app_users.id` must match `auth.users.id`. The separate design
with independently generated account IDs and backend-owned `password_hash` authentication
is not compatible with this flow without further changes; it is not activated here.
The API binds to `127.0.0.1`; `APP_ENV` defaults to `development` and accepts `test` as well.
The existing production startup restriction remains in place.

## Login

Swagger UI: **http://127.0.0.1:3000/docs/** (use your configured API port).
Expand `POST /auth/login`, click **Try it out**, enter an existing Auth account's
email/password, then click **Execute**. The request goes to the API serving the docs,
so it also works with `localhost` or a custom port. Use your own password in place of the example.

- OpenAPI JSON: `/docs/json`
- OpenAPI YAML: `/docs/yaml`

The spec documents success and all current error responses. It contains no env keys or real tokens.
The implementation uses the [Fastify Swagger plugins](https://github.com/fastify/fastify-swagger-ui).

Use an existing account created in Supabase Authentication:

```http
POST http://127.0.0.1:3000/auth/login
Content-Type: application/json

{"email":"user@email.com","password":"YOUR_AUTH_PASSWORD"}
```

Success (`200`):

```json
{
  "data": {
    "accessToken": "SUPABASE_JWT",
    "refreshToken": "SUPABASE_REFRESH_TOKEN",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "userId": "851cb40a-3d75-44bd-874a-9951ff57bbca",
      "username": "admin_johndoe",
      "email": "admin@email.com",
      "role": "admin",
      "memberTier": "free"
    }
  },
  "messages": []
}
```

`expiresIn` is returned by Supabase. The profile is selected by the authenticated Auth user ID,
never by a client-supplied ID. Username, role and tier come from `app_users`, not user-editable
Auth metadata. Email comes from Auth. Database `Admin`/`Customer` map to `admin`/`customer`;
`normal` and Admin `NULL` tier map to `free`, while `prime` stays `prime`.
Examples do not create or rename database accounts; returned usernames reflect actual rows.

| Result | HTTP | Error code |
| --- | --- | --- |
| Invalid input | 400 | `VALIDATION_ERROR` |
| Invalid email/password | 401 | `AUTH_INVALID_CREDENTIALS` |
| Email not confirmed | 403 | `AUTH_EMAIL_NOT_CONFIRMED` |
| No matching app_users profile | 403 | `AUTH_PROFILE_NOT_FOUND` |
| Provider rate limit | 429 | `AUTH_RATE_LIMITED` |
| Provider/network/configuration failure | 503 | `AUTH_UNAVAILABLE` |
| Profile lookup/configuration failure | 503 | `AUTH_PROFILE_UNAVAILABLE` |

The repository uses Node `fetch` and the Supabase Auth password grant, with a per-request timeout
and no shared session. Responses are `no-store`, and upstream error details are not exposed.

## Logout

Send the access token returned by Login in the `Authorization` header:

```http
POST http://127.0.0.1:3000/auth/logout
Authorization: Bearer SUPABASE_JWT
```

Success returns `204` with an empty body. The API asks Supabase Auth to revoke only the current
session (`scope=local`); the client must then discard its stored access and refresh tokens.
Missing or malformed Bearer headers return `401 AUTH_REQUIRED`, an invalid or expired token
returns `401 AUTH_INVALID_TOKEN`, and provider failure returns `503 AUTH_UNAVAILABLE`.
Supabase access tokens remain valid until their expiry even after logout, so clients must not
keep using the old access token.

## Verify

From the repository root:

```sh
npm run typecheck
npm run build
```
