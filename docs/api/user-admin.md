# API สำหรับ Customer และ Admin

เอกสารนี้สรุปเส้นทาง API ตาม [สัญญา API ฉบับออกแบบ](../spec/03-api-contract.md) และ [OpenAPI](openapi.json) ของโครงการ โดยแยกสิทธิ์ Customer/Admin เพื่อใช้อ้างอิงระหว่างพัฒนา **เส้นทางในตารางด้านล่างส่วนใหญ่ยังไม่เปิดให้ใช้งานจริง**: backend ปัจจุบันมีเพียง `POST /auth/login` และ Swagger UI ที่ `/docs/` ดูสถานะล่าสุดได้ที่ [Backend implementation](../backend-implementation.md)

## รูปแบบร่วมตามสัญญาออกแบบ

- API origin แยกจาก Web origin; path ไม่มี `/api` นำหน้า และส่ง JSON เมื่อมี request body
- ทุกเส้นทางยกเว้น login ต้องส่ง `Authorization: Bearer <backend-issued JWT>`; ระบบตรวจ role และเจ้าของข้อมูลจาก token ที่ยืนยันแล้ว
- คำตอบสำเร็จมีรูปแบบ `{ "data": ..., "messages": [] }`; ข้อผิดพลาดมีรูปแบบ `{ "error": { "code": "...", "message": "...", "details": ... } }`
- `Customer` จัดการเฉพาะตะกร้าและคำสั่งซื้อของตน; `Admin` จัดการสินค้าและคูปองตามรายการด้านล่าง
- `GET /products` ใช้ร่วมกัน: Customer เห็นสินค้าที่พร้อมขาย ส่วน Admin เห็นสินค้าทั้งหมด

## Authentication และข้อมูลผู้ใช้

| Method | Path | ผู้ใช้ | Request | Response `data` | สถานะ |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/login` | ไม่ต้อง login | **ปัจจุบัน:** `{email,password}`; **สัญญาออกแบบ:** `{username,password}` | ข้อมูล token และ user | เปิดใช้จริง แต่รูปแบบต่างจากสัญญาออกแบบ |
| `GET` | `/auth/me` | Customer, Admin | Bearer token | `UserState` พร้อม stage และ currentOrderId | ยังไม่พัฒนา |

**Login ที่ใช้งานได้ตอนนี้:** ใช้ Supabase Auth ด้วยอีเมล/รหัสผ่าน และคืน `accessToken`, `refreshToken`, `tokenType`, `expiresIn` และ `user` (`userId`, `username`, `email`, `role: admin|customer`, `memberTier: free|prime`) ภายใน `data` โดย role/tier อ่านจาก `app_users` ไม่ใช่ข้อมูลที่ client ส่งมา ผู้ใช้ต้องมีแถว `app_users` ที่ `id` ตรงกับ Auth user ID และตั้งค่า SQL สำหรับอ่านโปรไฟล์ตาม [คู่มือ backend](../../backend/README.md) API นี้จำกัด `APP_ENV` เป็น `development` หรือ `test`

**สัญญาออกแบบในอนาคต:** login ด้วย username/password ที่ backend ตรวจเองและออก JWT; `UserState` ใช้ `role: Customer|Admin`, `memberTier: normal|prime|null` และมี `stage`/`currentOrderId` ไม่มี refresh token ความแตกต่างนี้ยังไม่ได้ปรับในโค้ดปัจจุบัน จึงไม่ควรใช้ OpenAPI ใน `docs/api/openapi.json` เป็นคำอธิบาย endpoint ที่ deploy แล้ว

## API สำหรับ Customer (ตามสัญญาออกแบบ; ยังไม่พัฒนา)

| Method | Path | Request body / จุดประสงค์ | Response `data` |
| --- | --- | --- | --- |
| `GET` | `/products` | ดูสินค้าที่พร้อมขาย | `{products: Product[]}` |
| `POST` | `/cart/items` | `{productId,quantity}` เพิ่มสินค้า | `Cart` |
| `PUT` | `/cart/items/{productId}` | `{quantity}` เปลี่ยนจำนวน | `Cart` |
| `DELETE` | `/cart/items/{productId}` | ลบสินค้า | `Cart` |
| `PUT` | `/cart/coupon` | `{code}` ใส่คูปอง | `Cart` |
| `GET` | `/cart` | ดูตะกร้าและสถานะ | `Cart` |
| `POST` | `/cart/checkout` | `{zone,speed}` สร้างคำสั่งซื้อ | `{customer,order}`; HTTP `201` |
| `DELETE` | `/cart/checkout` | ยกเลิก checkout ปัจจุบัน | `{cart,order}` |
| `POST` | `/cart/continue` | กลับไปเลือกสินค้าหลังสำเร็จ | `Cart` |
| `GET` | `/orders` | ดูคำสั่งซื้อของตน เรียงใหม่ก่อน | `{orders: OrderSummary[]}` |
| `GET` | `/orders/{orderId}` | ดูคำสั่งซื้อของตน | `Order` |

การดูคำสั่งซื้อของคนอื่นและการอ้าง ID ที่ไม่มีอยู่ให้ `404 ORDER_NOT_FOUND` เหมือนกัน การแก้ตะกร้าต้องเป็นไปตาม stage ของ workflow; รายละเอียด validation, สถานะ และข้อความอยู่ใน [HTTP API contract](../spec/03-api-contract.md)

## API สำหรับ Admin (ตามสัญญาออกแบบ; ยังไม่พัฒนา)

| Method | Path | Request body / จุดประสงค์ | Response `data` |
| --- | --- | --- | --- |
| `GET` | `/products` | ดูสินค้าทั้งหมด รวมที่ปิดขาย | `{products: AdminProduct[]}` |
| `PUT` | `/admin/products/{productId}` | `{price?,stock?}` ปรับราคา/สต็อก | `AdminProduct` |
| `POST` | `/admin/products/{productId}/status` | `{status:"onSale"|"offSale"}` | `AdminProduct` |
| `POST` | `/admin/coupons/{code}/status` | `{status:"active"|"inactive"}` | `{coupons: Coupon[]}` |
| `GET` | `/admin/coupons` | ดูคูปองทั้งหมด | `{coupons: Coupon[]}` |

Admin ไม่มี endpoint สำหรับสร้างสินค้า/คูปองหรือดูคำสั่งซื้อของลูกค้าในสัญญานี้

## เส้นทางสำหรับระบบทดสอบเท่านั้น (ยังไม่พัฒนา)

| Method | Path | Request | Response `data` |
| --- | --- | --- | --- |
| `POST` | `/orders/{orderId}/pay-success` | `{result:"success"}` จำลองผลชำระเงินสำเร็จ | `{customer,order}` |
| `POST` | `/orders/{orderId}/pay-fail` | `{result:"fail"}` จำลองผลชำระเงินล้มเหลว | `{customer,order}` |
| `POST` | `/test/reset` | `X-Test-Reset-Token` | `{reset:true}` |

สามเส้นทางนี้มีเฉพาะ `APP_ENV=test` ตามสัญญาออกแบบ โดย payment simulator ไม่บังคับ Customer token และ reset ต้องใช้ test secret แยกต่างหาก

## เอกสารอ้างอิง

- [HTTP API contract](../spec/03-api-contract.md) — operation, DTO, error code และกฎ workflow
- [OpenAPI 3.1 ฉบับออกแบบ](openapi.json) — machine-readable contract; ยังไม่ใช่ API ที่ใช้งานจริง
- [Backend implementation](../backend-implementation.md) — สถานะโค้ดปัจจุบัน
- [Backend README](../../backend/README.md) — วิธีเรียก login ที่ใช้งานได้จริงและ Swagger UI
