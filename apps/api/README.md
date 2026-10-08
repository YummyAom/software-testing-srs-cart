# Local mock-backed TypeScript API

## Authorized scope override

This implementation follows the user's revised **backend-only + spec-derived in-memory database** scope. Canonical design documents retain their future Supabase/Argon2id/JWT proposal; that is **not implemented or verified here**. No SQL, migrations, DB provisioning, Docker, frontend, registration, refunds or new CRUD. SRS v1.8 sections 1–9 are the behavioral authority; section 10 is instructor commentary.

The app implements all 18 business operations and `GET /auth/me`. `POST /test/reset` and unauthenticated payment simulator callbacks exist **only with APP_ENV=test**. No `/api` prefix. DTOs/messages follow `@cart/contracts` and the OpenAPI paths/shapes. **Tokens are opaque local mock sessions, not the future design's JWTs.** They expire after 3600 seconds; restart loses sessions and all in-memory business data. Relogin within the same running process retains cart/coupon/stage/order/reservations. No real persistence, production authentication, Supabase or RLS acceptance claim.

## Run locally (repository root)

Node 22/npm 11. Copy root `.env.example` to ignored `.env` and configure:

- `APP_ENV=development` or `test` (explicit; no default mock mode)
- `API_PORT=3000` (optional default), `UI_ORIGIN=http://localhost:5173` (exact origin)
- `SEED_PASSWORD_CUSTOMER_NORMAL`, `SEED_PASSWORD_CUSTOMER_PRIME`, `SEED_PASSWORD_ADMIN`: caller-chosen **local-only** passwords; no built-in password
- `TEST_RESET_TOKEN`: required only for `test`; isolated local-only secret

Example values in `.env.example` and HTTP test fixtures are local mock choices (SOI-01), not SRS seed passwords or production credentials. Never reuse them remotely.

```sh
npm ci
npm run dev
# or:
npm run build
npm run start
```

CLI binds **127.0.0.1 only**. `APP_ENV=production` or `NODE_ENV=production` is refused; this app is not deployable production scaffolding. Development mode cannot simulate payment, deliberately: use isolated test mode to exercise checkout → pay/fail/success. CORS allows only configured UI origin, Authorization/Content-Type, and GET/POST/PUT/DELETE. No cookies or wildcard origin. Logging is silent with explicit secret redaction; startup/error messages do not print configuration or private errors. JSON body limit is 16 KiB; responses are `no-store`/`nosniff`.

In test mode only:

```sh
curl -X POST http://127.0.0.1:3000/test/reset -H 'X-Test-Reset-Token: YOUR_LOCAL_TEST_SECRET'
```

Reset is serialized with all domain operations, restores products/coupons/cart/stages/orders to SRS §7 seed, and preserves account IDs/roles/tiers and mock credentials/sessions. It does not promise token revocation. Do not expose the test server/reset/simulator to untrusted users.

## Integration contract for the database owner

Imports are public via `@cart/api` (built ESM) or the source index for development tooling:

```ts
import { createApp, createMemoryPersistence, createSeedState } from '@cart/api';
import type { AppConfig, PersistenceAdapter, StoreState, IdentityAdapter } from '@cart/api';

const app = createApp(config, { persistence: adapter, clock: Date.now });
// synchronous Fastify factory: await app.ready(), app.inject(...), or app.listen(...)
```

`AppConfig` = `{appEnv:'development'|'test', seedPasswords:{customerNormal,customerPrime,admin}, uiOrigin, testResetToken?}`. Dependencies = `{persistence?, clock?:()=>number, identity?}`; clock returns epoch **milliseconds**. Default adapter is a fresh `createMemoryPersistence(createSeedState())` per app. Imports never start the server; executing the compiled/source index does.

The persistence seam is intentionally one unit of work, not per-table repositories:

```ts
interface PersistenceAdapter {
  read<T>(work: (state: DeepReadonly<StoreState>) => T | Promise<T>): Promise<T>;
  transaction<T>(work: (state: StoreState) => T | Promise<T>): Promise<T>;
}
```

Definitions in `src/persistence.ts` are authoritative. StoreState contains users (server-owned identity, tier, stage, currentOrderId, cart lines, attached coupon), products, coupons, owned order snapshots with internal ordering sequence, and orderSequence. No credentials live in this domain store. The fixed local seed UUIDs are DESIGN, not SRS identifiers. Keep those IDs when using default mock identity, or supply an IdentityAdapter for different account IDs.

Required adapter guarantees:

1. **One shared single-process FIFO for reads AND writes**, in adapter-call dispatch order, not a network arrival guarantee. All domain state is loaded through this seam; handlers have no second copy. Auth/body admission checks also read through the adapter, and role/stage are rechecked in the actual operation's unit of work.
2. Each callback sees one consistent detached unit of work; reads cannot mutate stored state. Return values and retained callback references cannot mutate stored records afterward. No nested adapter calls inside a callback.
3. A transaction commits every change together only after successful callback completion. Any domain error, unexpected failure or commit failure must roll back all changes. A failing command must not poison the FIFO for later work.
4. A future DB implementation should load the unit of work and persist its delta using one transaction connection, retaining these guarantees. Implement actual persistence/auth/security separately; no SQL adapter exists here. The production guard is intentional and must not be removed as an incidental integration change.
5. Products/accounts/coupons are preseeded, no deletes or new CRUD. Stock is available stock: checkout subtracts once, pay-success does not subtract again, cancel adds snapshot quantities to **current** stock. Storage may exceed 9999 on restoration (9999 is Admin input bound only).
6. Order snapshot fields/totals are immutable after checkout; only status transitions. Account tier/role are authoritative stored facts, never request fields. Persist sequence for timestamp-tie ordering (DESIGN/SOI-07).

`IdentityAdapter` verifies configured credentials, issues sessions and resolves a bearer to userId only. Default mock adapter uses salted Node scrypt digests and cryptographically random opaque sessions in memory. It is **not** the canonical production Argon2id/JWT design and offers no restart survival/production identity guarantee. A future provider may replace this boundary without moving ownership checks into client claims or changing business formulas.

## Validation and tests

Approved behavioral seam: HTTP injection with actual seeded memory adapter; independent literal SRS oracles, no mocks of private route/domain collaborators. Boundary clock/identity/persistence fault/latency fixtures are labelled DESIGN. All ten DC-1 functions are used through route orchestration, never reimplemented in handlers. The domain package has its own pure-function unit seam.

```sh
npm run test:service -- apps/api/src/app.test.ts
npm run typecheck
npm run build
npm test
```

`src/app.test.ts` covers all 23 AC IDs, exact messages/DTO examples, every domain rejection's observable no-change, isolation/ownership, immutable snapshots, reservation double-effect guards, FIFO blocking/contention, commit-failure rollback, mock token expiration/relogin, test-only route absence, CORS, bounded/sanitized errors and body validation precedence. Tests do not query internal storage for assertions. SOI-02/04/05/07/08 defaults remain **DESIGN**, not new SRS requirements; classifyWeight zero/negative is not exercised by checkout. No browser/E2E, real DB restart, migrations, RLS or production auth/security validation is implied. Independent reviewer/integration acceptance remains required.
