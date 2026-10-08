# Backend specification

## Architecture (DESIGN)

Node.js LTS + TypeScript strict + Fastify. Modules: Authentication adapter, Catalog, Customer Cart/Checkout workflow, Orders, Store Administration, pure Domain Rules, Supabase persistence adapter และ test environment controls. แยก orchestration จาก HTTP parsing แต่ไม่สร้าง repository interface ทุก table โดยไม่มีเหตุผล. Route processing ต้องเรียก DC-1 pure functions ผ่าน application orchestration; ห้าม duplicate formulas ใน handler/frontend/SQL

Interface ภายนอกหลักคือ HTTP ใน API contract. Domain Rules exports ทั้ง 10 functions ตาม SRS section 6.1 **คงชื่อ parameter types return unions และ validation order แบบ verbatim**: isProductAvailable, validateQuantityChange, calculateSubtotal, calculateTotalWeight, calculateDiscount, classifyWeight, calculateShippingFee, calculateNetTotal, validateCheckout, validateProductUpdate. Inputs จาก DB ต้องถูกส่งเข้า functions ไม่ให้ function อ่าน DB/HTTP/time. ห้าม runtime schema reject quantity ชนิดผิดก่อน stage checks หรือรวม quantity invalid ทุกชนิดเป็น QTY_OUT_OF_RANGE

## Authentication / identity — backend-owned (DESIGN)

**ไม่ใช้ Supabase Auth**: Supabase เป็น PostgreSQL เท่านั้น. Backend รับผิดชอบ credential verification, token issuance/verification, role และ ownership เพื่อให้ออกแบบ software tests ของระบบเองได้. ใช้ cryptographic libraries มาตรฐาน ไม่เขียน hash/signature algorithm เอง. ข้อกำหนด JWT/hash/TTL ด้านล่างเป็น DESIGN ไม่ใช่ข้อกำหนดเพิ่มเติมของ SRS

### Seeded accounts and password verification

- `app_users.id` เป็น UUID ที่ระบบสร้างเอง ไม่อ้าง `auth.users`; เก็บ username, password_hash, role, member_tier. ไม่มี internal email, Supabase user mapping หรือ provider API calls
- OP-1 accepts username/password strings. DESIGN: username เปรียบเทียบตรงตัวแบบ case-sensitive ไม่ trim/lowercase; password ตรวจตาม bytes ของค่าที่รับ ไม่ normalize. Missing/non-string fields => 400 VALIDATION_ERROR; malformed login inputs เป็น contract-design tests ไม่ใช่ SRS oracle
- Lookup seeded account ด้วย parameterized SQL แล้ว verify `password_hash` ด้วย Argon2id library. Encoded hash ต้องเก็บ salt/parameters ในตัว; library สร้าง salt แบบสุ่มแยกแต่ละบัญชี. ไม่เก็บ plaintext/encrypted password และไม่ส่ง hash กลับใน DTO/logs
- DESIGN hash baseline: Argon2id memoryCost=19456 KiB, timeCost=2, parallelism=1; hash parameters ไม่ใช่ password policy. Seed passwords มาจาก env; ไม่มี registration, reset password, password-change หรือ role/memberTier-change operation
- Unknown username ใช้ valid dummy Argon2id hash เพื่อ verify ก่อนคืน error เช่นเดียวกับ wrong password; status/code/message เหมือนกัน ไม่อ้างว่าป้องกัน timing side channel ได้สมบูรณ์
- Login ผิด => 401 AUTH_INVALID_CREDENTIALS; DB outage/hash processing failure => sanitized 500/503 ไม่รายงาน credentials ผิดโดยไม่มีหลักฐาน. Login ไม่สร้าง account, ไม่ rehash/reset seed และไม่แตะ cart/coupon/stage/order/stock

### Bearer JWT contract

- Login สำเร็จคืน accessToken, tokenType=Bearer, expiresIn=3600 และ user summary รูปเดิม. Backend ออก JWT ด้วยมาตรฐาน library เช่น jose, algorithm **HS256 เท่านั้น**, secret เป็น random อย่างน้อย32 bytes จาก AUTH_JWT_SECRET_BASE64 (decode แล้วตรวจความยาวตอน startup)
- Required claims: sub=app_users UUID, iss=AUTH_JWT_ISSUER, aud=AUTH_JWT_AUDIENCE, iat และ exp=iat+3600. ค่า issuer/audience ต้องตั้งชัดเจนและตรวจ exact match. ไม่มี password/hash หรือ role/memberTier authoritative claims ใน token
- Verification ต้องตรวจ signature, algorithm allowlist, required claim types, issuer, audience และ expiration. DESIGN: clock tolerance=0; expired เมื่อ now>=exp, reject iat ในอนาคต. Claims/sub malformed, signature altered, wrong secret/alg/iss/aud, missing/invalid/expired bearer =>401 AUTH_REQUIRED; ไม่เชื่อ decode-only payload หรือ alg=none
- หลัง verify token ให้อ่าน app_users โดย sub; ไม่พบ user =>AUTH_REQUIRED; DB lookup unavailable =>sanitized 503 ไม่แกล้งเป็น invalid token. role/tier ใช้ข้อมูล DB ไม่ใช้ค่าที่ client ยื่นหรือ JWT claims เสริม. ก่อน process command ใช้ verified principal เพื่อตรวจ role/ownership
- ไม่มี refresh token, logout endpoint, session table หรือ revocation blacklistใน scope; token expired ให้ login ใหม่. Browser อาจล้าง token ได้ แต่ไม่เรียก cleanup ของธุรกิจ. Server restart ที่ secret เดิมต้องไม่ทำ token invalid เพราะไม่มี in-memory session dependency
- Token TTL ใช้กับ authentication **ไม่ใช่ stock reservation**: token expiry/relogin/ปิดหน้าไม่ยกเลิก pending order หรือคืน stock. Key rotation ทำให้ token เก่า invalid ได้ แต่ยังไม่เพิ่ม multi-key rotation feature
- Token ของแอปไม่ได้ใช้ login Supabase Data API หรือ auth.uid(); browser ไม่มีสิทธิ์ domain tables และเรียก backend เท่านั้น

### Authorization and testability

- ไม่รับ customerId/role/memberTier/stock totals จาก browser. Orders WHERE owner_id=principal.id ก่อนส่ง output. Admin ไม่มีสิทธิ์ list/view orders
- GET /auth/me ใช้ verifier เดียวกันและคืน persisted stage/currentOrderId; frontend contract เดิมไม่เปลี่ยน
- Inject clock และ signing configuration ใน auth module สำหรับ deterministic token-design tests; production clock อ่านเวลาจริง. ห้ามเพิ่ม time-travel/token-issuance HTTP endpoint เพื่อทดสอบ; service tests login จริง ไม่ mock authenticated principal
- OP-10/11 ไม่บังคับ auth ตาม SRS test gateway scope; expose เฉพาะ isolated APP_ENV=test demo. นอก test ตอบ 404 route absent; real gateway integration อยู่นอก scope

## State model

| owner stage | order state | allowed transition | effects |
|---|---|---|---|
| cart | no current order | checkout -> checkout/pending | keep cart lines; evaluate coupon; snapshot totals; subtract stock once |
| checkout | current pending | payFail -> checkout/pending | no business state changes; info message |
| checkout | current pending | cancel -> cart/cancelled | add snapshot quantities to CURRENT available stock; keep cart/coupon after checkout evaluation; clear currentOrderId |
| checkout | current pending | paySuccess -> success/paid | clear cart lines/coupon; no extra stock change; keep currentOrderId for success screen |
| success | current paid | continue -> cart | clear currentOrderId; empty cart remains |

No order/reservation expiry, TTL, login cleanup or browser-unload cancellation; authentication JWT TTL เป็นคนละเรื่องและต้องไม่เปลี่ยน business state. Mutators add/update/remove/apply/checkout allowed only cart. continue only success. cancel/pay callbacks only checkout + current pending. Repeat paid/cancelled callbacks => OPERATION_NOT_ALLOWED, not idempotent success. Read operations work every stage

## Validation ordering

Global DESIGN precedence: auth -> role -> stage -> OP-specific validations. Preserve SRS local ordering:

- add/update: integer -> input 1..10 -> product exists/add or in-cart/update -> available -> combined <=10/add -> resulting qty <=stock. Number strings, null, boolean, decimals are not integers. add updates by addition; PUT replaces. Product availability requires onSale AND availableStock>=1
- remove: empty cart => CART_EMPTY `ไม่มีสินค้าให้ลบ`; nonempty but missing line => ITEM_NOT_IN_CART `ไม่พบสินค้าในตะกร้า`; existing line removed regardless availability. If last line removed info `ตะกร้าว่าง`; do not unbind coupon automatically
- applyCoupon: exact case-sensitive code exists and active else COUPON_INVALID. Bind/replace even if empty or below minSpend; do not calculate eligibility here
- checkout: zone/speed valid -> nonempty -> ALL unavailable product IDs -> weight<=20000 -> coupon evaluation. Fail earlier checks without removing coupon
- updateProduct: product exists first -> at least one field + all specified fields integer/in-range; gather all invalid fields, never partial write
- product/coupon status: missing resource first, then DESIGN status enum validation (SOI-02); setting existing status succeeds

## Atomic processing

All domain reads/mutations join a single-process FIFO queue in request dispatch order (not network timing guarantee). Auth/network prerequisites are outside database transactions; enqueue verified domain command before state read. No password hashing, token signing or HTTP inside a business-write DB transaction. All table reads and writes for a mutation use one checked-out pg client: BEGIN -> read state -> domain validation/calculation -> writes -> COMMIT. Rollback and release in finally on any rejection/unexpected failure. Pool.query per statement is forbidden because it may use different connections

Checkout transaction:
1. Read Customer, cart lines, current products and optional coupon.
2. Run validateCheckout with calculated weight; on error rollback before any write.
3. Run calculateDiscount; if removed, set cart coupon NULL and include notice; member discount fallback, never stack.
4. Determine weight tier/shipping/net using DC-1.
5. Insert immutable order and lines with server-generated UUID and timestamp.
6. Subtract every quantity from products.available_stock; order lines represent reservation.
7. Set stage checkout + current order UUID; leave cart lines untouched.
8. Commit and return order snapshot + customer state + notices.

Cancel transaction validates current pending state, adds each order-line quantity to current stock (not restoring old stock), marks cancelled and sets cart stage/current reference. paySuccess marks paid, deletes cart lines, unbinds coupon and sets success. payFail reads valid context and returns info without domain writes. Admin mutations are atomic and serialized against checkout; no later alteration of snapshots

ReadCart joins live product name/price/availability, returns live subtotal and attached coupon without discount/shipping side effects. checkoutEnabled = lineCount>0 && stage=cart even if items unavailable (FR-2.8). Count is rows, not quantity sum. Order reads never get unit price/name from live products

## Errors and logging

Domain errors use workbook envelope, no writes in any tracked domain table (FR-0.7). Sanitized unexpected errors 500 separate from domain codes, transaction rollback; request ID logs redact tokens/passwords/connection strings. Errors lists use details.fields/details.productIds. No response leaks password_hash, signing secret, SQL, Supabase DB credential or foreign-order existence

## Operational contract

Configure APP_ENV=development|test|production, API_PORT, UI_ORIGIN, SUPABASE_DB_URL, AUTH_JWT_SECRET_BASE64, AUTH_JWT_ISSUER, AUTH_JWT_AUDIENCE, TEST_RESET_TOKEN only test, SEED_PASSWORD_* for account provisioning. Backend login/seed ไม่ต้องใช้ SUPABASE_URL, publishable/anon key หรือ secret/service_role key; ต่อ PostgreSQL โดย server-only DB credentials เท่านั้น. Do not commit actual values. HTTPS outside local, CORS allow configured UI origin only, no wildcard credentialed access. Backend DB role/migrations credentials never shipped to Vite. SPA origin uses proxy rules that distinguish API fetch vs browser HTML navigation; simpler run API on separate origin

Health routes read-only `/health/live` and `/health/ready` optional DESIGN support; readiness DB SELECT 1 only, never seed on every request. Start one backend instance. No Supabase Realtime subscription is required. Token invalid means return to login, not resetting customer state. Disable auth rate limits only in isolated local test if necessary; never disable production controls for test convenience
