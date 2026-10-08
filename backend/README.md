# Supabase Login API

TypeScript + Fastify backend exposing only `POST /auth/login` and its CORS preflight.
Credentials are verified by Supabase Auth. No mock sessions, cart, product, order, payment,
reset, registration, token-verification middleware or `app_users` role lookup is implemented.

## Structure

```text
src/
├── index.ts                              Server startup
├── config.ts                             Environment validation
├── app.ts                                Fastify setup, CORS and error handling
├── errors.ts                             HTTP validation helpers
├── controllers/auth-controller.ts        Validate login request and format HTTP response
├── services/auth-service.ts              Handle authentication outcomes
└── repositories/supabase-auth-repository.ts  Call Supabase Auth
```

```text
Request → Controller → Service → Repository → Supabase Auth → managed Auth database
```

## Run

Use Node 22/npm 11. Configure the shared repository-root `.env`, not `backend/.env` or `node_modules/.env`. Copy root `.env.example` only if `.env` does not already exist; it contains placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
API_PORT=3000
UI_ORIGIN=http://localhost:5173
```

From the repository root:

```sh
npm ci
npm --prefix backend ci
npm run dev:auth
```

Or run `npm run dev` from `backend/`. Both load only repository-root `.env`.
Root `npm run dev` runs the separate mock cart API. Both APIs default to port 3000;
run one at a time or override `API_PORT`. Use `npm run build:auth` and
`npm run start:auth` for the compiled login API.
Exported process variables take precedence. No server secret key or seed passwords are required.
The API binds to `127.0.0.1`; `APP_ENV` defaults to `development` and accepts `test` as well.
The existing production startup restriction remains in place.

## Login

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
    "user": { "userId": "AUTH_USER_UUID", "email": "user@email.com" }
  },
  "messages": []
}
```

`expiresIn` is returned by Supabase. No role is inferred from Auth metadata.

| Result | HTTP | Error code |
| --- | --- | --- |
| Invalid input | 400 | `VALIDATION_ERROR` |
| Invalid email/password | 401 | `AUTH_INVALID_CREDENTIALS` |
| Email not confirmed | 403 | `AUTH_EMAIL_NOT_CONFIRMED` |
| Provider rate limit | 429 | `AUTH_RATE_LIMITED` |
| Provider/network/configuration failure | 503 | `AUTH_UNAVAILABLE` |

The repository uses Node `fetch` and the Supabase Auth password grant, with a per-request timeout
and no shared session. Responses are `no-store`, and upstream error details are not exposed.

## Verify

From the repository root:

```sh
npm run typecheck
npm run build
npm run test:service
npm test
```

Service tests cover Login; the transport test uses a local simulated Auth HTTP server.
Tests never load real Supabase credentials. Other reusable domain packages in the repository
are independent of this API and retain their own unit tests.
