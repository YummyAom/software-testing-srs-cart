# AI implementation handoff and delivery plan

## Non-negotiable instructions

Read baseline SRS (including DC), original API workbook, master spec, decisions/SOI, domain glossary, Supabase schema/security and API/UI specs before editing. These documents are DESIGN, not approved replacement SRS. User required Supabase. Do not substitute SQLite, use frontend Supabase direct writes, invent registration/address/refund/expiry features, or derive test expected values from implementation. Seam confirmation pending must remain visible. No existing app/test prior art; create minimal working monolith

## Proposed workspace (DESIGN, paths here are navigation suggestions not immutable decisions)

- apps/api: HTTP interface, auth adapter, workflow orchestration, Supabase pg persistence
- apps/web: React pages, role/stage router, shared messages, API client
- packages/domain: exact SRS DC-1 functions and types; no I/O dependencies
- packages/contracts: generated/shared DTO types consistent with OpenAPI
- supabase/migrations: ordered PostgreSQL schema migrations; never rewrite applied migration
- scripts: backend app_users/password_hash seed (no Supabase Auth APIs), controlled domain seed, isolated test reset helpers
- tests/service and tests/e2e: observable interface tests and fixture ownership

Use npm workspaces initially, lockfile and pinned major dependency choices, Node LTS documented. No microservices, event bus, separate per-table repositories or generated abstractions unless implementation actually needs them

## Vertical implementation steps

| Step | Deliverable / dependencies | Acceptance / stop conditions |
|---|---|---|
| 1 | scaffold TS strict, API/web shells, local Supabase CLI stack, env.example, CI entry points | local stack ready, typecheck, no committed secrets |
| 2 | timestamped schema migration from proposal, RLS, backend account/hash seeder and domain seeds | seed exact FR-7 values, browser table access denied, reset guarded; test migration/constraints on local Postgres |
| 3 | pure functions preserving all10 exact signatures | unit ECT/BVA/DT/shipping tests with independent oracles green |
| 4 | backend-owned Argon2id credential verification + HS256 JWT, OP-1/2, GET /auth/me, role/ownership auth | seeded app_users login without Supabase Auth, token-design cases and SRS auth tests, no state resets on login |
| 5 | OP-3..7 with real persistence, response envelope/messages | ordered errors, row count, live cart pricing, coupon binding on empty, rollback |
| 6 | OP-8/9/10/11/12 transactional workflow | AC4..13,17,18 + fail/retry/relogin/stock restoration; no expiry/double stock |
| 7 | OP-13..18 | owned order snapshots/newest-first, Admin validation/all fields/status/coupons; no Admin orders |
| 8 | UI all9 DC URLs, routing and exact DC IDs/attributes | full user journey and direct URL refresh; invalid stage workflows route correctly; SOI-03 remains explicit |
| 9 | service, contract, E2E, CI and runbook | all23 AC IDs traced, domain error rollback matrix, non-test controls absent; report actual tests |

Prefer test-first vertical slices but do not create all failing suites in advance. Each slice implement one observable behavior, run focused tests, expand to full regression. Steps 2/3 can be authored independently but DB workflow integration follows both. Frontend depends on stable DTOs, not guessed response shapes

## Definition of Done

- Source docs retained unchanged and conflict decisions respected.
- All18 operations implemented with original paths/methods, declared response/error shapes; support endpoints clearly separated.
- All10 DC functions exported as exact TypeScript signatures and invoked from route execution; no duplicated business formulas.
- Persistent per-user cart/coupon/stage/current pending order across login; immutable order snapshots.
- Atomic business writes using one transaction client; any domain rejection no state change.
- Supabase PostgreSQL migrations and backend account/hash seed/reset reproducible locally; no auth.users FK/Auth API calls; RLS enabled, client roles denied credential/domain tables.
- Semantic, labeled, keyboard-usable pages with all mandatory IDs/data attributes/URLs and explicit status/message rendering.
- CI executes unit/service/E2E against local isolated Supabase, not shared cloud DB; tests not skipped on missing infra.
- README commands for start/migrate/seed/reset/test and troubleshooting; env.example placeholders only.
- Open issues documented; unclarified SOIs not falsely counted as SRS expected assertions.

## Proposed commands to provide in implementation

`npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:service`, `npm run test:e2e`, `npm run seed:test`; `supabase start`, `supabase db reset` (local-only), migrations linked project apply under explicit target. These commands are **not available yet** in this documentation-only repo. Future implementer must add and verify them, not report them as executed now

## Supabase deployment handoff checklist

Human supplies intended PostgreSQL connection credentials and random backend JWT signing secret outside GitHub files. Implementer can provision local stack without cloud credentials. Confirm linked cloud project before migrations; seed own app_users UUIDs/Argon2id hashes, configure AUTH_JWT_SECRET_BASE64/ISSUER/AUDIENCE via secret store, allow API UI origin, run one API instance. No Supabase Auth signup/email provisioning or service-role dependency. No UI signing secret/DB URL. Do not run test reset or local test passwords on cloud demo. Verify OP-10/11 test scope before making any public demo; real payment integration requires a new spec

## Agent final report format

List changed areas, implemented FR/DC/AC, actual commands/results, Supabase migration/seed target (without secrets), known SOIs/limitations and next work. Never claim deployed/secure/tested if only design produced. Link PR/issues and preserve origin requirement citations
