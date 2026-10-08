# Backend specification

## Architecture (DESIGN)

Node.js LTS + TypeScript strict + Fastify. Modules: Authentication adapter, Catalog, Customer Cart/Checkout workflow, Orders, Store Administration, pure Domain Rules, Supabase persistence adapter และ test environment controls. แยก orchestration จาก HTTP parsing แต่ไม่สร้าง repository interface ทุก table โดยไม่มีเหตุผล. Route processing ต้องเรียก DC-1 pure functions ผ่าน application orchestration; ห้าม duplicate formulas ใน handler/frontend/SQL

Interface ภายนอกหลักคือ HTTP ใน API contract. Domain Rules exports ทั้ง 10 functions ตาม SRS section 6.1 **คงชื่อ parameter types return unions และ validation order แบบ verbatim**: isProductAvailable, validateQuantityChange, calculateSubtotal, calculateTotalWeight, calculateDiscount, classifyWeight, calculateShippingFee, calculateNetTotal, validateCheckout, validateProductUpdate. Inputs จาก DB ต้องถูกส่งเข้า functions ไม่ให้ function อ่าน DB/HTTP/time. ห้าม runtime schema reject quantity ชนิดผิดก่อน stage checks หรือรวม quantity invalid ทุกชนิดเป็น QTY_OUT_OF_RANGE

## Authentication / identity

- OP-1 accepts username/password; username lookup จาก seeded app_users เพื่อแปลงเป็น internal auth email แล้วเรียก Supabase Auth signInWithPassword. ไม่สร้างบัญชีขณะ login ไม่แตะ cart/stage/order
- Supabase Auth email signup ปิด, anonymous sign-ins ปิด, ไม่มี register/reset UI; seed email confirmed ด้วย server-only admin API. app_users.id ตรง auth.users.id
- คืน accessToken, tokenType=Bearer, expiresIn และ user summary. ไม่ส่ง Supabase refresh token ใน public contract; token expired ให้ login ใหม่ (persistent state ไม่หาย)
- ทุก protected request ใช้ Supabase getUser(accessToken) ตรวจ token ไม่ decode JWT แล้วเชื่อ role claim. role/tier อ่าน app_users โดย verified UUID; membership immutable ไม่มี endpoint แก้
- Invalid/missing/expired bearer => AUTH_REQUIRED. login bad user/password => AUTH_INVALID_CREDENTIALS ไม่เผย username/email existence. provider outage เป็น sanitized 503 ไม่แกล้งเป็น invalid credentials
- ไม่รับ customerId/role/memberTier/stock totals จาก browser. Orders WHERE owner_id=principal.id ก่อนส่ง output. Admin ไม่มีสิทธิ์ list/view orders
- OP-10/11 ไม่บังคับ auth ตาม SRS test gateway scope; expose เฉพาะ isolated APP_ENV=test demo. นอก test ตอบ 404 route absent; real gateway integration อยู่นอก scope

## State model

| owner stage | order state | allowed transition | effects |
|---|---|---|---|
| cart | no current order | checkout -> checkout/pending | keep cart lines; evaluate coupon; snapshot totals; subtract stock once |
| checkout | current pending | payFail -> checkout/pending | no business state changes; info message |
| checkout | current pending | cancel -> cart/cancelled | add snapshot quantities to CURRENT available stock; keep cart/coupon after checkout evaluation; clear currentOrderId |
| checkout | current pending | paySuccess -> success/paid | clear cart lines/coupon; no extra stock change; keep currentOrderId for success screen |
| success | current paid | continue -> cart | clear currentOrderId; empty cart remains |

No expiry, TTL, login cleanup or browser-unload cancellation. Mutators add/update/remove/apply/checkout allowed only cart. continue only success. cancel/pay callbacks only checkout + current pending. Repeat paid/cancelled callbacks => OPERATION_NOT_ALLOWED, not idempotent success. Read operations work every stage

## Validation ordering

Global DESIGN precedence: auth -> role -> stage -> OP-specific validations. Preserve SRS local ordering:

- add/update: integer -> input 1..10 -> product exists/add or in-cart/update -> available -> combined <=10/add -> resulting qty <=stock. Number strings, null, boolean, decimals are not integers. add updates by addition; PUT replaces. Product availability requires onSale AND availableStock>=1
- remove: empty cart => CART_EMPTY `ไม่มีสินค้าให้ลบ`; nonempty but missing line => ITEM_NOT_IN_CART `ไม่พบสินค้าในตะกร้า`; existing line removed regardless availability. If last line removed info `ตะกร้าว่าง`; do not unbind coupon automatically
- applyCoupon: exact case-sensitive code exists and active else COUPON_INVALID. Bind/replace even if empty or below minSpend; do not calculate eligibility here
- checkout: zone/speed valid -> nonempty -> ALL unavailable product IDs -> weight<=20000 -> coupon evaluation. Fail earlier checks without removing coupon
- updateProduct: product exists first -> at least one field + all specified fields integer/in-range; gather all invalid fields, never partial write
- product/coupon status: missing resource first, then DESIGN status enum validation (SOI-02); setting existing status succeeds

## Atomic processing

All domain reads/mutations join a single-process FIFO queue in request dispatch order (not network timing guarantee). Auth/network prerequisites are outside database transactions; enqueue verified domain command before state read. No asynchronous Supabase Auth calls or HTTP inside DB transaction. All table reads and writes for a mutation use one checked-out pg client: BEGIN -> read state -> domain validation/calculation -> writes -> COMMIT. Rollback and release in finally on any rejection/unexpected failure. Pool.query per statement is forbidden because it may use different connections

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

Domain errors use workbook envelope, no writes in any tracked domain table (FR-0.7). Sanitized unexpected errors 500 separate from domain codes, transaction rollback; request ID logs redact tokens/passwords/connection strings. Errors lists use details.fields/details.productIds. No response leaks internal email, SQL, Supabase key or foreign-order existence

## Operational contract

Configure APP_ENV=development|test|production, API_PORT, UI_ORIGIN, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or legacy anon key), SUPABASE_SECRET_KEY (or legacy service_role key, server-only seeding), SUPABASE_DB_URL, TEST_RESET_TOKEN only test, SEED_PASSWORD_* for account provisioning. Do not commit actual values. HTTPS outside local, CORS allow configured UI origin only, no wildcard credentialed access. Backend DB role/migrations credentials never shipped to Vite. SPA origin uses proxy rules that distinguish API fetch vs browser HTML navigation; simpler run API on separate origin

Health routes read-only `/health/live` and `/health/ready` optional DESIGN support; readiness DB SELECT 1 only, never seed on every request. Start one backend instance. No Supabase Realtime subscription is required. Token invalid means return to login, not resetting customer state. Disable auth rate limits only in isolated local test if necessary; never disable production controls for test convenience
