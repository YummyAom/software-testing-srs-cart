# Testing specification and acceptance gates

## Seams / oracle policy

Primary proposed seam: HTTP interface + real disposable local Supabase/PostgreSQL database, no repository mocks. Additional required seams: DC-1 exported pure functions (unit) and browser UI (E2E). User seam confirmation pending. No incumbent test suite exists. Test externally observable behavior; avoid route internals, component state, SQL query count, private method calls or snapshotting entire DOM

All SRS tests expected values must cite FR/AC and independent manual arithmetic/tables. Do not call production calculate* to construct expected output. Contract-design tests for selected unspecified shapes/defaults are tagged DESIGN/SOI, not presented as instructor SRS test coverage. SOI expected behaviors remain unasserted as SRS oracle until clarified

## Test levels

1. Unit: 10 pure functions with exported exact signatures. Inputs explicit, outputs/error precedence per DC/FR. No DB/HTTP/time mocks needed. classifyWeight zero/negative excluded until clarification.
2. Contract/service: actual API factory listening/injection plus real local Supabase PostgreSQL. Auth integration login ผ่าน backend ด้วย seeded username/password และตรวจ backend-issued JWT จริง ไม่มี Supabase Auth dependency หรือ mocked principal. Validate OpenAPI success/error schema, authorization, state transitions, stock, snapshots, isolation. Capture public read views for all Customer/Admin contexts before and after rejection; supplement domain-table state comparison through test fixture when state isn't externally visible, not as replacement for behavioral checks.
3. E2E: Playwright with browser per Customer/Admin identity, real API/local DB, deterministic seed reset. Use roles/labels and specified IDs/attributes. Gateway buttons only test. Read values from data-value/status/available, not parsed localized strings.
4. Security/operational DESIGN checks: anon/authenticated direct Supabase table SELECT/INSERT/UPDATE/DELETE denied; no client keys capable of writes; reset/callback routes absent outside test; transaction rollback on injected database failure. No race-condition campaign required

## Backend-owned authentication test design

SRS-derived cases: valid/invalid seeded credentials (FR-0.1), unauthenticated protected requests (FR-0.2), wrong role (FR-0.3), Customer isolation/ownership (FR-0.4/0.5), rejected operations no domain changes (FR-0.7), repeated login preserves cart/coupon/stage/pending order/reservation (FR-1.2).

DESIGN cases (ไม่อ้างเป็น SRS oracle):
- Login returns same DTO/Bearer header contract, expiresIn3600; unknown username and wrong password same outward error, hashes never exposed. No Supabase Auth calls/provider service dependency.
- Verify Argon2id encoded hashes with fixture password, reject wrong password; salts differ per account. Assert behavior ไม่ compare literal hash bytes; seeding repeated preserves UUID/hash.
- Missing/malformed bearer, forged signature, wrong key, alg=none/non-HS256, wrong/missing iss/aud/sub/iat/exp, unknown user, future iat =>401 AUTH_REQUIRED. Never allow injected role/tier claims to grant access.
- Inject auth clock privately for deterministic exp boundaries: now=exp-1 accepts valid token, now=exp rejects. Do not add test HTTP endpoint or wait one hour in E2E.
- DB unavailable during login/principal lookup =>sanitized infrastructure error, not AUTH_INVALID_CREDENTIALS/AUTH_REQUIRED. Wrong credentials must not mutate app_users/password_hash or any business state.
- Backend restart with same signing secret keeps valid JWT usable; key change invalidates old token without altering cart/order/stock. TTL expiration followed by login resumes same pending order, no reservation release.
- Test reset preserves app_users/hashes and does not promise JWT revocation. Fresh clients/login per test; do not trust claims as Supabase RLS identity.

Auth clock/config seam is internal and limited to token policy tests; main service seam remains real HTTP+PG. Tests must exercise backend verifier, not replace it with fake authorization middleware

## ECT/BVA inventory

| Domain | Partitions and boundary cases | Expected source |
|---|---|---|
| quantity | integer 1..10, integer outside, noninteger: null/string/boolean/fraction; 0,1,2,9,10,11 | FR-2.1/2.5/2.6 |
| add cumulative | old+new 9,10,11; input valid but total exceeds10; stock compare after max bound | FR-2.4 |
| stock interaction | qty<stock,=stock,>stock; stock0/unavailable takes precedence | FR-2.2/2.4/2.5 |
| admin price | 0,1,2,49999,50000,50001 and invalid types | FR-9.1 |
| admin stock input | -1,0,1,9998,9999,10000 and invalid types | FR-9.1 |
| weight classify | 1,999,1000,1001,1002,4999,5000,5001,5002,19999,20000,20001 | FR-4.5/5.2 |
| coupon minSpend | 999,1000,1001; active/inactive; attached/null; normal/prime | FR-4.2–4.4 |
| zone/speed | all defined strings plus undefined values without coercion | FR-5.1 |

Weight boundary unit tests can pass arbitrary valid weight inputs. Service/E2E with seeded product weights cannot reach all exact boundaries (all seeded weights are multiples of100); do not invent endpoint to edit weight or claim impossible seed combinations achieve 1001/5001. Use units for exact boundary proof, service tests for realizable carts. Coupon minimum boundaries similarly unit input independent of seed prices

## Discount Decision Table

R1 no coupon+prime => member floor5%; R2 no coupon+normal =>0; R3 attached inactive+prime =>remove+notice+member; R4 attached inactive+normal =>remove+notice+0; R5 attached active below minimum+prime =>remove+notice+member; R6 active below minimum+normal =>remove+notice+0; R7 attached active at/above minimum (either tier) =>coupon only. Test seven reduced rules and expansion coverage of sixteen truth assignments where applicable. Verify coupon not removed when earlier checkout validation fails. Applying coupon below minimum succeeds even empty

## Shipping combination table

36 total combinations = 3 weight tiers ×3 zones ×2 speeds ×2 member tiers. Base table light=[30,50,80], medium=[50,80,120], heavy=[80,120,180]. normal standard=base; normal express=floor(base*3/2); prime standard=0; prime express=floor(base/2). Expected numbers independently encoded from FR-4.6/4.7. Pairwise suite must include generated matrix and pair-coverage verification, seed/tool/version logged; at least9 rows needed to cover tier×zone, but do not claim9 always sufficient without verify. Run all36 unit cases as cheap exhaustive supplement, not replacement for required pairwise design artifact

## FSM / precedence / rollback cases

- cart empty/nonempty and checkoutEnabled equivalence; row count vs quantity sum
- cart->checkout pending->fail stays->success paid->continue cart; cart->checkout->cancel cart->new checkout new ID
- add/update/remove/apply/checkout in checkout/success =>OPERATION_NOT_ALLOWED; continue in cart/checkout rejected
- callbacks missing order=>ORDER_NOT_FOUND; paid/cancelled=>OPERATION_NOT_ALLOWED; cancel outside checkout rejected; no double stock effect
- repeated fail, relogin and browser refresh keep same order/reservation indefinitely
- two Customer carts isolated; Admin changes affect live carts only, not snapshots
- full unavailable productIds list; checkout priority invalid zone >empty >unavailable >overweight; quantity priority per FR-2.6; update missing product before bad fields
- every domain code's rejection tested for no data mutation, including coupon, stage and other Customers; use known valid setup per error instead of accidentally failing earlier check
- cancel after Admin stock change adds to current value; cancel keeps used coupon, never restores removed coupon
- callback snapshots unaffected by Admin price/status/coupon edits; order history includes cancelled orders, owner scoped, newest first

## SRS AC verification inventory

| AC | Independent expected result |
|---|---|
| 1 | add P1,0 =>QTY_OUT_OF_RANGE, empty unchanged |
| 2 | P1 qty8 +3 =>QTY_OUT_OF_RANGE, qty8 |
| 3 | P2 qty2 +2 =>INSUFFICIENT_STOCK, qty2 |
| 4 | prime P1+P2 SAVE10 =>subtotal1650 discount165 shipping0 net1485 |
| 5 | prime P1+P2 no coupon =>discount82 shipping0 net1568 |
| 6 | prime P1×2 SAVE10 upcountry/express =>removed+notice discount45 shipping25 net880 |
| 7 | normal P2 SAVE10 disabled by Admin =>removed+notice discount0 shipping30 net1230 |
| 8 | normal P3 remote/express =>discount0 shipping270 net15270 |
| 9 | P3×3 =>WEIGHT_LIMIT_EXCEEDED, cart state unchanged |
| 10 | Admin closes P1 in cart =>ITEMS_UNAVAILABLE [P1], unchanged |
| 11a | normal P2×3 checkout =>pending,checkout,stock0 |
| 11b | prime already has P2 before normal reserves3 =>checkout ITEMS_UNAVAILABLE [P2] |
| 11c | prime empty after stock reserved =>add PRODUCT_UNAVAILABLE |
| 12 | cancel pending P2×3 =>cancelled,stock3,cart qty3 |
| 13 | Admin price P1 500 =>existing order450,live cart500 |
| 14 | Customer admin update =>AUTH_FORBIDDEN,price450 |
| 15 | other Customer view order=>ORDER_NOT_FOUND |
| 16 | Admin price0 stock10000 =>VALIDATION_ERROR fields price,stock; no write |
| 17 | add in checkout=>OPERATION_NOT_ALLOWED; cart/stage/stock same |
| 18a | paySuccess=>paid,empty/no coupon,success |
| 18b | continue=>cart empty |
| 19a | disable SAVE10=>inactive |
| 19b | listCoupons=>SAVE10 percent10 minSpend1000 inactive |

Each AC starts reset seed unless Given says otherwise, independent of neighboring AC. Require service coverage of all23 AC IDs. E2E minimum: login roles, initial cart, add/update/remove/coupon, monetary AC4/6/8, fail/retry/success/continue, cancellation, relogin persistence, cross-Customer stock/ownership, Admin update/status/coupon, all page roots/direct URLs and required attributes. Do not rely on tests running alphabetically

## Isolation / CI / release gates

Use one test worker for any suite sharing a resettable domain DB; otherwise separate whole Supabase stacks/projects per worker. Serial project settings alone must also prevent service/E2E suites resetting each other. Backend app_users with Argon2id hashes seeded once, beforeEach reset domain state and new browser context; no Supabase Auth provisioning. No live credentials in CI output. Use local Supabase CLI pinned version, Docker readiness checks and migrations before tests. Never silently skip integration tests because DB is missing

Implementation acceptance: lint+typecheck, 10-function unit suite, service suite/all AC, contract validation, E2E/DC attributes, local RLS deny tests, non-test reset/callback absence, migration+seed from empty local stack, documented commands and screenshots/reports. Upload test artifacts on failure with secrets redacted. Requirement traceability checked independently from line coverage. Final handoff reports actual command outcomes, not unexecuted plan as passing tests
