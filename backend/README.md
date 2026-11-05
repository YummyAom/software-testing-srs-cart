# Cart API

Fastify and TypeScript backend. Supabase Auth verifies login and bearer tokens. The backend connects directly to Supabase PostgreSQL for products, profiles, cart, checkout, coupons and orders. Business validation and price calculations run in TypeScript using `@cart/domain`; PostgreSQL stores rows and enforces constraints.

## Configuration

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Supabase Auth. Set `SUPABASE_DB_URL` to a **server-only** PostgreSQL connection string with access to the business tables. Never put the database URL in the frontend or commit it to git. `API_PORT`, `APP_ENV` and `UI_ORIGIN` retain their existing meanings. The service-role API key is no longer used by the backend.

The existing `app_users.id` must match the user's Supabase Auth UUID. The database role in `SUPABASE_DB_URL` must be allowed to read/write the business tables and use their sequences. Use the same database schema as before, including the order snapshot and deferred workflow constraints.

## Migration from RPC checkout

After deploying the new API, remove the old cart and order RPCs and revoke Data API access to the business tables from `anon` and `authenticated`. The cleanup script is kept locally in `sql/disable-legacy-rpcs.sql` and is not tracked in Git; review and apply it separately in Supabase SQL Editor. Do not run the legacy `enable-cart-*.sql`, `enable-product-read.sql`, or `enable-order-view.sql` scripts afterward; those scripts re-enable Data API behavior. The cleanup migration has not been applied remotely from this workspace.

`POST /cart/checkout` still accepts `{ "zone": "inCity", "speed": "standard" }`. One checked-out PostgreSQL connection and transaction reads/locks cart, product and coupon rows, calls the TypeScript domain functions, creates the order and lines, reserves stock, and updates customer state. Any error rolls the transaction back. `DELETE /cart/checkout` restores stock in its own transaction.

Run `npm run build` from the repository root, then `npm run start --workspace @cart/api` after setting the environment variables.

## Local Supabase for tests

Runs the API against a throwaway Supabase stack on your machine instead of the shared team project. It needs Docker and Node 22, on Windows, Linux or macOS. The stack uses ports 55320-55329 (set in `supabase/config.toml`).

`supabase/migrations/*_team_schema.sql` is a schema-only dump of the team database `public` schema.

From the repo root, `npm run e2e:setup` starts the stack, creates `backend/.env.test` (git-ignored) and creates the seed accounts. `npm run e2e` then runs the E2E suite. See `e2e/README.md`.

`npm run test:api` starts the API on a free port, runs the API tests and stops it. To run the API by itself against the same stack: `npm run dev:test`.

`npm run db:local:reset` rebuilds the local database from the migration. It also wipes local Auth users, so run `npm run db:local:seed` or `npm run e2e` afterwards. `npm run e2e:stop` stops the stack.
