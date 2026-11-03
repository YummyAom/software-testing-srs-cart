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

Runs the API against a throwaway Supabase stack on your machine instead of the shared team project. Needs `colima`, `docker` and the Supabase CLI. The local stack uses ports 55320-55329 (set in `supabase/config.toml`) so it can run next to other Supabase projects on the default 543xx ports.

`supabase/migrations/*_team_schema.sql` is a schema-only dump of the team database `public` schema (including `app_users.auth_email` and the `app_users.id` to `auth.users(id)` foreign key). `backend/sql/schema.sql` is an older design and does not match it. Local email confirmation is off, so seeded users can log in immediately.

1. From the repo root, start Docker and the stack (the first run pulls images): `npm run db:local:start`. If colima has never been started, create the VM once with `colima start --cpu 4 --memory 6`.
2. Run `supabase status` and copy the anon/publishable key and the service_role key.
3. Create `backend/.env.test` from `backend/.env.test.example` and fill in the keys and the three `SEED_PASSWORD_*` values. `backend/.env.test` is git-ignored and filled in by you. Do not commit it.
4. Create the seed accounts in local Auth and `public.app_users`: `npm run db:local:seed`. It refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_DB_URL` both point at `127.0.0.1` or `localhost`, and it is safe to run again.
5. Start the API with `APP_ENV=test`: `npm run dev:test`.
6. Seed products, coupons and customer state: `curl -X POST http://localhost:3001/test/reset -H "x-test-reset-token: <TEST_RESET_TOKEN>"`. Call it again whenever you want the SRS section 7 data back.

Other commands: `npm run db:local:reset` rebuilds the local database from the migration (this wipes local Auth users, so run `npm run db:local:seed` again afterwards), and `npm run db:local:stop` stops the stack. Neither command touches the shared project. Use `supabase stop --no-backup` to also drop the local data volume.
