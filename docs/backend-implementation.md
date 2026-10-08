# Backend implementation — mock database scope

## Scope and authority

The user approved **TypeScript backend only**, then explicitly assigned the real database to a friend and authorized spec-seeded mock storage. This changes the implementation/testing scope, not the canonical SRS or database proposal. No frontend, migrations, database provisioning, Supabase integration, or Docker setup was implemented.

All 18 business operations and `GET /auth/me` are implemented. Payment simulator callbacks and secret-guarded reset exist only in test mode. Paths, envelopes and the six exact Thai messages follow the source contracts. The ten DC-1 functions are exported with the canonical signatures and used by HTTP orchestration.

**Local use only:** state and sessions disappear on restart. Production startup is refused. The current identity adapter uses configured local passwords and opaque expiring sessions, not Supabase Auth or the concurrent Argon2id/JWT design amendments. Real persistence, JWT authentication, RLS, deployment and browser acceptance remain unimplemented/unverified. The newer auth direction needs separate owner confirmation; no claim of full production spec completion.

## Folders and commands

| Path | Responsibility |
|---|---|
| `apps/api/src` | Fastify HTTP, authorization, workflow, mock identity and persistence adapter |
| `packages/domain/src` | Ten pure SRS rules and independent unit oracles |
| `packages/contracts/src` | Shared request/response types, error mapping and required messages |
| `tests/service` | Real loopback HTTP transport smoke with mock storage |
| `.github/workflows/backend.yml` | Node 22/npm 11 build, typecheck and full test suite |

Use Node 22/npm 11. From repository root:

```sh
npm ci
cp .env.example .env
# Edit ignored .env: choose local-only passwords and exact UI_ORIGIN.
npm run dev
```

CLI binds `127.0.0.1:3000` by default. `APP_ENV=development` disables payment simulator/reset; use explicit `APP_ENV=test` plus `TEST_RESET_TOKEN` for the complete local checkout demonstration. Do not expose test controls remotely. Seed usernames are `cus_normal`, `cus_prime`, `admin01`; passwords come from the three `SEED_PASSWORD_*` settings. Example passwords are synthetic fixtures, not SRS-defined credentials.

```sh
npm run typecheck
npm run build
npm run test:unit
npm run test:service -- apps/api/src/app.test.ts
npm run test:service -- tests/service/listening.test.ts
npm test
# Compiled local server after build:
npm run start
```

## Database-owner handoff

See [API runbook](../apps/api/README.md) and authoritative exported interfaces in `apps/api/src/persistence.ts` and `mock-identity.ts`.

Supply a `PersistenceAdapter` to `createApp(config, { persistence: adapter, identity })`. It exposes asynchronous `read(callback)` and `transaction(callback)` over a consistent `StoreState`. Store state contains users/cart lines/coupons/stages/current order, products, coupons and owned immutable order snapshots. Credentials are separate, behind `IdentityAdapter`; it resolves only user IDs, never client-authoritative roles.

Suggested future schema mapping (not a migration):

- `users`: identity, username, role, memberTier; per-user workflow record: stage/currentOrderId/couponCode.
- `cart_lines`: productId/quantity per Customer.
- `products` and `coupons`: current catalog values/status.
- `orders` and `order_lines`: owned snapshots/totals/status plus persisted ordering sequence.

The adapter must serialize reads and writes through one shared FIFO, detach callback inputs/results, commit every mutation atomically, roll back on all rejected/failed work, and recover after failure. No nested adapter calls. Use one database transaction connection for the unit of work; do not commit table changes independently. Preserve ownership and current-stock cancellation semantics (restoration can exceed the Admin input bound of 9999). A paid order does not deduct stock again. Never recalculate order snapshots from current catalog values. Keep account IDs aligned with the identity adapter.

The in-memory adapter is not a production-scale database abstraction; real storage/auth integration and its tests require separate work. Do not remove the production guard incidentally.

## Acceptance evidence and limitations

`apps/api/src/app.test.ts` covers all 23 backend AC IDs from `docs/spec/06-testing.md`, including independent literal AC-4/5/6/7/8 totals, every domain error's publicly observable no-change, ownership, relogin, stages, coupon removal timing, snapshots, reservations, cancellation and payment retries. It also covers DESIGN fault/latency fixtures, FIFO behavior, CORS and test-control absence. Domain tests cover all ten functions, quantity/Admin boundaries, discount decisions and all 36 shipping combinations. `tests/service/listening.test.ts` verifies a real loopback socket, login, protected reads and disabled simulator routes.

These are **mock-backed HTTP and pure-function tests**, not real database integration. SOI design defaults remain labelled; missing SRS expectations were not silently promoted into requirements. Browser/DC-2, real Auth/DB restart survival, migrations/RLS and hosted security are excluded. CI configuration is provided, but hosted execution is not claimed from local results.

Existing uncommitted root README/spec/OpenAPI/database edits from another owner are preserved and excluded from backend commits. Delivery is on `feat/typescript-backend`; push/PR is authorized, merge is not.
