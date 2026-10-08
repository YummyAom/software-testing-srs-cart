# Decisions, conflicts and specification gap log

## Authority

SRS v1.8 เป็น baseline. Workbook ใช้สำหรับ methods/paths, Bearer header, error envelope และ status mapping. ช่อง `-`/ว่างใน operation rows ไม่ได้ยกเว้น FR-0.2/0.3 หรือ domain errors; อ่านตาราง shared contract ร่วมกัน. DESIGN เป็นข้อเสนอที่ implement ได้ แต่ไม่เป็น expected value ของ SRS tests โดยอัตโนมัติ

## Resolved design choices / workbook conflicts

| ID | เรื่อง | ข้อสรุปและเหตุผล |
|---|---|---|
| D-01 | qty หรือ quantity | ใช้ `quantity` ทั้ง add/update/response ตาม OP และ DC-1; ไม่รับ alias qty เพื่อไม่ให้ ambiguous. เป็น refinement ของ workbook |
| D-02 | cancel path param | `DELETE /cart/checkout` ไม่มี path/body orderId; backend หา current pending order ของ authenticated Customer ตาม OP-9 |
| D-03 | gateway Authorization | SRS ระบุ gateway auth out of scope; OP-10/11 ไม่ใช้ Customer auth/ownership. Workbook Authorization cell ขัดกับ scope จึงยึด SRS; ไม่ deploy simulator endpoints เป็น public production feature |
| D-04 | status mapping cells | ยึด shared mapping ของ workbook: business rejection 400, auth 401/403, missing resources 404, checkout 201, อื่น 200 |
| D-05 | OP-17 response | คืน coupons ทั้งหมดหลัง toggle ตาม workbook ไม่ใช่ coupon เดียว |
| D-06 | HTTP base | Paths เดิม ไม่มี `/api` prefix ใน contract; development proxy แยก API origin กับ UI origin ไม่ให้ GET /products และ GET /orders ชนกัน |
| D-07 | database/auth ownership | Supabase ใช้เฉพาะ PostgreSQL; ผู้ใช้เลือก backend-owned auth เพื่อ software testing: seeded username/password_hash (Argon2id), backend-issued/verified HS256 JWT, own user UUID ไม่ FK auth.users; transaction ผ่าน backend PostgreSQL driver ไม่ทำ REST calls ทีละ table |
| D-08 | stage bootstrap | เพิ่ม `GET /auth/me` read-only technical support ไม่ใช่ business OP; คืน role/tier/stage/currentOrderId เพื่อ direct URL routing |
| D-09 | reset | เพิ่ม `POST /test/reset` เฉพาะ APP_ENV=test + test-only secret. ปิด route นอก test ไม่ใช่แค่ซ่อนปุ่ม |
| D-10 | stock upper bound | 9,999 คือ input bound ของ updateProduct ไม่ใช่ storage invariant: reserve 3, admin set stock 9999, cancel => 10002 ตาม FR-7.1.2 |
| D-11 | paySuccess stock | ไม่ลดซ้ำและไม่คืน stock: checkout ลด availableStock แล้ว; paid ทำ reservation กลายเป็นการขาย |
| D-12 | readCart coupon | ห้าม GET /cart evaluate/remove coupon; FR-5.2.2 ตรวจ coupon หลัง checkout validations เท่านั้น |
| D-13 | output status | API enum: role Customer/Admin; stage cart/checkout/success; product onSale/offSale; coupon active/inactive; order pending/paid/cancelled. UI แปลไทย |
| D-14 | frontend reads | /products, /orders, /orders/:id เป็น read-only pages ทุก stage ตาม FR-8.5.2; stage guard บังคับเฉพาะ /cart,/checkout,/success (ดู SOI-03) |
| D-15 | serialization | หนึ่ง backend instance, FIFO queue สำหรับทุก domain operation ที่อ่าน/เขียน state; ไม่มี browser write, background stock expiry หรือ automation แก้ domain tables |

## Authentication design clarification

Backend-owned auth แทน Supabase Auth โดยไม่เปลี่ยน OP-1 หรือ error mapping เดิม. DESIGN: HS256 JWT TTL3600 seconds, required sub/iss/aud/iat/exp, clock tolerance0, role/tier อ่าน DB, no refresh/logout/revocation endpoints. Argon2id parameters/username case-sensitivity/JWT negative cases เป็น contract-design tests ไม่ใช่ expected behavior ที่ SRS กำหนด. Token expiry ไม่ใช่ reservation expiry

## SOI — ไม่สร้าง SRS expected value จนกว่าจะมี clarification

| SOI | Gap | simplest implementation / disposition | Test policy |
|---|---|---|---|
| SOI-01 | SRS ไม่ระบุ passwords ของ seed | Seed passwords จาก env; test fixture กำหนด `cart-test-only-password` เฉพาะ local test. Backend accounts ใช้ own UUID และ Argon2id hashes ไม่มี email/provider mapping | Test auth ด้วย configured fixtures; ไม่อ้างว่า password นี้มาจาก SRS |
| SOI-02 | status input ผิด enum ใน OP-16/17 ไม่ได้ระบุ error/precedence | สำหรับ existing resource ใช้ VALIDATION_ERROR details.fields=[status]; missing resource ตรวจก่อน. valid enum cases ตาม FR เท่านั้น | Contract-design tests ได้; ไม่มี SRS expected oracle สำหรับ invalid status |
| SOI-03 | DC-2.13 กล่าวกว้างว่าหน้า Customer ต้องตรง stage แต่ FR-8.5.2 ให้อ่าน products/orders/cart ทุก stage | DESIGN: guard workflow pages เท่านั้น; API read ได้ทุก stage. Products ยังดูได้แต่ add disabled เมื่อไม่ใช่ cart. orders/detail ยังเข้าได้ | ให้ผู้สอนยืนยัน UI guard scope; ห้ามอ้างว่าข้อนี้ปิดแล้ว |
| SOI-04 | auth/role/stage error precedence ข้ามกลุ่มไม่ได้ระบุ | DESIGN: auth -> role -> stage -> operation-specific ordering; callback: order exists -> stage/status. Preserve FR-2.6/5.2.1/9.1.1 strictly | SRS tests ใช้ preconditions isolate; cross-group precedence เป็น design tests |
| SOI-05 | admin update {} ต้องส่ง fields อะไร | DESIGN: VALIDATION_ERROR details.fields=[price,stock]; specified invalid fields เรียง price,stock; null/strings invalid ไม่ coerce | ไม่อ้าง exact fields ของ empty object เป็น SRS oracle |
| SOI-06 | classifyWeight(0)/negative และ shipping invalid tier ไม่มี SRS behavior | ไม่เรียก shipping ใน cart ว่าง; production functions ใช้ precondition valid positive weights. ห้าม map 0 เป็น light เพื่อสร้าง unit expectation | ทดสอบเฉพาะ domain specified 1..20000 และ overLimit >20000 |
| SOI-07 | createdAt เท่ากัน การเรียง order ไม่ระบุ tie-breaker | ใช้ createdAt desc, internal sequence desc เพื่อ deterministic response | SRS tests ไม่ expect particular tie order |
| SOI-08 | malformed JSON/missing identifiers/extra keys ไม่ระบุทั่วระบบ | DESIGN: malformed JSON 400 VALIDATION_ERROR; whitelist fields; reject extra keys; ordinary numeric domain inputs ส่ง unknown เข้า pure validator | แยก contract-design tests จาก SRS acceptance |
| SOI-09 | pay-fail persistence/message timing | ไม่เพิ่ม payment-attempt table; response info message และ UI refetch ตรวจผลเมื่อ simulated button เป็นผู้เรียก. External callback fail ไม่เพิ่ม realtime feature | SRS test เรียกผ่าน simulator workflow; clarification ก่อน expect unrelated browser auto notification |

## Seam confirmation

เสนอ seam หลัก HTTP interface + real local Supabase database; unit pure functions และ browser UI ตาม DC. แจ้งข้อเสนอผู้ใช้แล้ว แต่ยังไม่มีคำยืนยันแยก. กำหนดให้ issue/handoff เปิดเผยสถานะนี้ ไม่ปลอมเป็น approved decision. ไม่มี application tests เดิมให้เลียนแบบ
