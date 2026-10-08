# SRS-CART-002 : Multi-User Shopping Cart, Checkout & Store Administration

**ข้อกำหนดความต้องการเชิงหน้าที่ (Functional Requirements) — ฉบับสำหรับ Term Project**

| รายการ | รายละเอียด |
|---|---|
| SRS ID | SRS-CART-002 |
| Version | 1.8 (v1.7 + ปิด OI-2: การจองสต็อกคงอยู่จนกว่าออเดอร์จะชำระแล้วหรือถูกยกเลิก — ดูส่วนที่ 10.1) |
| Status | Draft — รอผู้สอนทบทวน |
| Scope | ระบบร้านค้าออนไลน์แบบหลายผู้ใช้ 2 บทบาท (Customer, Admin) ประกอบด้วย Web UI และ api-server |
| Timestamp | 2026-09-28 |

> **หมายเหตุ:** กฎทางธุรกิจทั้งหมดในเอกสารนี้ (ช่วงค่า อัตราค่าจัดส่ง เงื่อนไขส่วนลด) ถูกกำหนดขึ้นใหม่โดย Claude เพื่อให้รองรับเทคนิคการออกแบบ test case ตามที่ผู้สอนกำหนด ไม่ได้คัดลอกมาจากแหล่งอ้างอิงภายนอก รูปแบบเอกสารใช้ตามแบบ SRS ที่วิชาใช้อยู่ (ต้นแบบ SRS-CART-001)
> ส่วนที่ 10 เป็นหมายเหตุสำหรับผู้สอน — **ให้ตัดออกก่อนแจกนิสิต**

---

## 1. Purpose & Scope

### 1.1 Purpose
เอกสารนี้เป็นข้อกำหนดตั้งต้นของ term project ซึ่งนิสิตจะใช้เป็นฐานในการ (1) พัฒนาระบบ และ (2) ออกแบบและทำ automated test ในระดับ unit, contract & service และ end-to-end โดยค่าคาดหวัง (expected value) ของทุก test case ต้องได้มาจากเอกสารนี้ ไม่ใช่จากพฤติกรรมของโปรแกรมที่พัฒนาขึ้น

### 1.2 In-scope
- การ login ด้วยบัญชีที่ลงทะเบียนไว้ล่วงหน้า และการแยกสิทธิ์ตามบทบาท
- **Customer:** ดูรายการสินค้า, จัดการตะกร้า, ใช้คูปอง, เลือกโซนและความเร็วในการจัดส่ง, checkout, ชำระเงินผ่าน payment gateway จำลอง, ยกเลิกการชำระเงิน และดูออเดอร์ของตนเอง
- **Admin:** ดูรายการสินค้าทั้งหมด, แก้ไขราคาและสต็อก, เปิด/ปิดการขายสินค้า, ดูรายการคูปองทั้งหมด และเปิด/ปิดใช้คูปอง

### 1.3 Out-of-scope
- การลงทะเบียนบัญชี การรีเซ็ตรหัสผ่าน และนโยบายรหัสผ่าน
- การประมวลผลคำสั่งพร้อมกัน ณ เวลาเดียวกัน (race condition) — ระบบถือว่าประมวลผลคำสั่งทีละคำสั่งตามลำดับที่มาถึง
- การยืนยันตัวตนของ payment gateway — ในสภาพแวดล้อมทดสอบ ให้จำลอง gateway ด้วยการเรียก OP-10 / OP-11 โดยตรง
- การคืนเงิน และการยกเลิกออเดอร์ที่ชำระเงินแล้ว
- ภาษี และสกุลเงินอื่นนอกจากบาท
- การสร้างสินค้าและคูปองใหม่ — สินค้าและคูปองทั้งหมดถูกนำเข้าระบบล่วงหน้า (FR-1.4)
- การจัดส่งและการติดตามสถานะการจัดส่ง
- การดูออเดอร์โดย Admin

---

## 2. Definitions

| คำศัพท์ | ความหมาย |
|---|---|
| Customer | ผู้ใช้บทบาทลูกค้า แต่ละคนมีตะกร้าของตนเอง |
| Admin | ผู้ใช้บทบาทผู้ดูแลร้าน |
| ระดับสมาชิก (memberTier) | ค่าประจำบัญชี Customer มีค่า `normal` หรือ `prime` — ไม่มี operation ใดในขอบเขตนี้เปลี่ยนค่านี้ได้ |
| สินค้า (Product) | ประกอบด้วย productId, ชื่อ, ราคาต่อชิ้น (บาท, จำนวนเต็ม), น้ำหนักต่อชิ้น (กรัม, จำนวนเต็ม), สต็อกพร้อมขาย (จำนวนเต็ม), สถานะการขาย (`เปิดขาย` / `ปิดขาย`) |
| สต็อกพร้อมขาย | จำนวนชิ้นที่ยังไม่ถูกจองโดยออเดอร์ใด |
| สินค้าพร้อมขาย | สินค้าที่มีสถานะ `เปิดขาย` **และ** สต็อกพร้อมขาย ≥ 1 |
| รายการในตะกร้า (cart line) | คู่ของ productId และจำนวน (quantity) — สินค้าหนึ่งชนิดมีได้ไม่เกินหนึ่งรายการในตะกร้า |
| จำนวนรายการในตะกร้า | จำนวน cart line โดย cart line หนึ่งรายการคือแถวหนึ่งแถวในตะกร้า (สินค้าหนึ่งชนิดพร้อม quantity) — นับจำนวนแถว ไม่ใช่ผลรวมของ quantity เช่น ตะกร้าที่มี P1 × 3 และ P2 × 1 มีจำนวนรายการเท่ากับ 2 |
| ยอดรวมสินค้า (subtotal) | Σ (ราคาต่อชิ้น × quantity) ของทุกรายการ |
| น้ำหนักรวม | Σ (น้ำหนักต่อชิ้น × quantity) ของทุกรายการ |
| คูปอง (Coupon) | ประกอบด้วย code, ส่วนลดเป็นเปอร์เซ็นต์ (percent), ยอดขั้นต่ำ (minSpend), สถานะ (`เปิดใช้` / `ปิดใช้`) |
| โซนจัดส่ง (zone) | `inCity` / `upcountry` / `remote` |
| ความเร็วจัดส่ง (speed) | `standard` / `express` |
| ขั้นตอนของ Customer (stage) | สถานะที่ api-server เก็บไว้ต่อ Customer มีค่า `ตะกร้า` / `ชำระเงิน` / `สำเร็จ` — Web UI ต้องแสดงหน้าที่ตรงกับ stage ปัจจุบัน |
| ออเดอร์ (Order) | ประกอบด้วย orderId, เจ้าของ, สำเนารายการ (snapshot), ยอดเงินแต่ละส่วน, zone, speed, code คูปองที่ใช้ (ถ้ามี) และสถานะ (`รอชำระเงิน` / `ชำระเงินแล้ว` / `ยกเลิก`) |
| การปัดเศษ | ทุกการคำนวณที่ให้ผลไม่เป็นจำนวนเต็ม ให้ปัดลง (floor) เป็นบาทเต็ม |
| Domain error code | รหัสข้อผิดพลาดเชิงโดเมนที่ระบบต้องส่งกลับ (ส่วนที่ 5) — การกำหนด HTTP status ที่คู่กับแต่ละรหัสเป็นส่วนหนึ่งของ API contract ที่นิสิตออกแบบ |

---

## 3. System Operations (รายการของเหตุการณ์ที่เกิดขึ้นได้)

| OP | ผู้เรียก | Operation | คำอธิบาย |
|---|---|---|---|
| OP-1 | ทุกบทบาท | `login(username, password)` | เข้าสู่ระบบ |
| OP-2 | ทุกบทบาท | `listProducts()` | ดูรายการสินค้า |
| OP-3 | Customer | `addItem(productId, quantity)` | เพิ่มสินค้าเข้าตะกร้า |
| OP-4 | Customer | `updateQuantity(productId, quantity)` | แก้ไขจำนวนของรายการในตะกร้า |
| OP-5 | Customer | `removeItem(productId)` | ลบรายการออกจากตะกร้า |
| OP-6 | Customer | `applyCoupon(code)` | ผูกคูปองกับตะกร้า |
| OP-7 | Customer | `viewCart()` | ดูตะกร้า |
| OP-8 | Customer | `pressCheckout(zone, speed)` | เข้าสู่ขั้นตอนชำระเงิน |
| OP-9 | Customer | `cancelCheckout()` | ยกเลิกการชำระเงินและกลับสู่ตะกร้า |
| OP-10 | Payment gateway | `paySuccess(orderId)` | gateway แจ้งชำระเงินสำเร็จ |
| OP-11 | Payment gateway | `payFail(orderId)` | gateway แจ้งชำระเงินล้มเหลว |
| OP-12 | Customer | `continueShopping()` | กลับสู่ตะกร้าหลังสั่งซื้อสำเร็จ |
| OP-13 | Customer | `listOrders()` | ดูรายการออเดอร์ของตนเอง |
| OP-14 | Customer | `viewOrder(orderId)` | ดูรายละเอียดออเดอร์ของตนเอง |
| OP-15 | Admin | `updateProduct(productId, price?, stock?)` | แก้ไขราคาและ/หรือสต็อก |
| OP-16 | Admin | `setProductStatus(productId, status)` | เปิด/ปิดการขาย |
| OP-17 | Admin | `setCouponStatus(code, status)` | เปิด/ปิดใช้คูปอง |
| OP-18 | Admin | `listCoupons()` | ดูรายการคูปองทั้งหมด |

---

## 4. Functional Requirements

> **ข้อตกลงการเขียน (ตั้งแต่ v1.4):** requirement แต่ละข้อมีเงื่อนไขเดียวและข้อผูกพันที่ตรวจสอบได้หนึ่งอย่าง (singular requirement) FR-x.y ที่มีข้อย่อย FR-x.y.z เป็น**หัวข้อกลุ่ม** ส่วน requirement คือข้อที่ไม่มีข้อย่อย การอ้างถึง FR-x.y หมายถึง requirement ทุกข้อในกลุ่มนั้น

### FR-0 : การยืนยันตัวตน สิทธิ์ และข้อกำหนดทั่วไป

**FR-0.1 การ login**

**FR-0.1.1** เมื่อผู้ใช้เรียก `login(username, password)` ด้วย username และ password ที่ตรงกับบัญชีที่ลงทะเบียนไว้ล่วงหน้า ระบบต้องให้ผู้ใช้เข้าสู่ระบบในบทบาทของบัญชีนั้น

**FR-0.1.2** เมื่อผู้ใช้เรียก `login(username, password)` ด้วย username หรือ password ที่ไม่ตรงกับบัญชีใด ระบบต้องปฏิเสธด้วย `AUTH_INVALID_CREDENTIALS`

**FR-0.2** ระบบต้องปฏิเสธ OP-2 ถึง OP-9 และ OP-12 ถึง OP-18 ที่ไม่ได้มาจากผู้ใช้ที่ login แล้ว ด้วย `AUTH_REQUIRED`

**FR-0.3 สิทธิ์ตามบทบาท**

**FR-0.3.1** ระบบต้องปฏิเสธ OP-3 ถึง OP-9 และ OP-12 ถึง OP-14 ที่เรียกโดยผู้ใช้ที่ไม่ใช่ Customer ด้วย `AUTH_FORBIDDEN`

**FR-0.3.2** ระบบต้องปฏิเสธ OP-15 ถึง OP-18 ที่เรียกโดยผู้ใช้ที่ไม่ใช่ Admin ด้วย `AUTH_FORBIDDEN`

**FR-0.4** operation ของ Customer คนหนึ่งต้องไม่เปลี่ยนแปลงตะกร้า stage หรือออเดอร์ของ Customer คนอื่น

**FR-0.5 การมองเห็นออเดอร์**

**FR-0.5.1** `listOrders` ต้องแสดงเฉพาะออเดอร์ที่ Customer ผู้เรียกเป็นเจ้าของ

**FR-0.5.2** เมื่อ Customer เรียก `viewOrder(orderId)` ด้วย orderId ของผู้อื่นหรือ orderId ที่ไม่มีอยู่ ระบบต้องปฏิเสธด้วย `ORDER_NOT_FOUND` เหมือนกันทั้งสองกรณี

**FR-0.6** `listOrders` ต้องเรียงออเดอร์ตามเวลาที่สร้าง จากใหม่ไปเก่า

**FR-0.7** เมื่อระบบปฏิเสธ operation ใดด้วย domain error code ในส่วนที่ 5 ระบบต้องไม่เปลี่ยนแปลงข้อมูลใดๆ ได้แก่ ตะกร้า คูปองที่ผูกกับตะกร้า stage ออเดอร์ ข้อมูลสินค้า สต็อก และข้อมูลคูปอง

### FR-1 : สถานะเริ่มต้นและการดูสินค้า

**FR-1.1** สำหรับบัญชี Customer ที่ยังไม่เคยใช้งาน ระบบต้องเริ่มที่ stage `ตะกร้า` จำนวนรายการในตะกร้าเป็นศูนย์ ไม่มีคูปองผูก ปุ่มชำระเงินถูกปิดใช้งาน และยังไม่มีออเดอร์

**FR-1.2 การคงอยู่ของข้อมูลข้ามการ login**

**FR-1.2.1** รายการในตะกร้าต้องคงอยู่ข้ามการ login ครั้งถัดไปของบัญชีเดียวกัน

**FR-1.2.2** คูปองที่ผูกกับตะกร้าต้องคงอยู่ข้ามการ login ครั้งถัดไปของบัญชีเดียวกัน

**FR-1.2.3** stage ของ Customer ต้องคงอยู่ข้ามการ login ครั้งถัดไปของบัญชีเดียวกัน (เช่น Customer ที่อยู่ stage `ชำระเงิน` เมื่อ login ใหม่ต้องยังอยู่ stage `ชำระเงิน`)

**FR-1.2.4** ออเดอร์สถานะ `รอชำระเงิน` ของ Customer ต้องคงอยู่ข้ามการ login ครั้งถัดไปของบัญชีเดียวกัน โดยสถานะออเดอร์และการจองสต็อกต้องไม่เปลี่ยนเพราะการ login

**FR-1.3 การดูรายการสินค้า**

**FR-1.3.1** `listProducts` ที่เรียกโดย Customer ต้องแสดงเฉพาะสินค้าพร้อมขาย พร้อม productId ชื่อ ราคา น้ำหนักต่อชิ้น และสต็อกพร้อมขาย

**FR-1.3.2** `listProducts` ที่เรียกโดย Admin ต้องแสดงสินค้าทั้งหมด พร้อม productId ชื่อ ราคา น้ำหนักต่อชิ้น สต็อกพร้อมขาย และสถานะการขาย

**FR-1.4** สินค้า คูปอง และบัญชีผู้ใช้ทั้งหมดถูกนำเข้าระบบล่วงหน้า (seed) ตามข้อมูลในส่วนที่ 7 ไม่มี operation ใดในขอบเขตนี้สร้างสินค้าหรือคูปองใหม่

### FR-2 : การจัดการตะกร้า

FR-2.1 ถึง FR-2.7 ใช้เมื่อ Customer อยู่ stage `ตะกร้า` (stage อื่นดู FR-8)

**FR-2.1 รูปแบบและช่วงของ quantity ใน `addItem`**

**FR-2.1.1** เมื่อ Customer เรียก `addItem(productId, quantity)` ด้วย quantity ที่ไม่ใช่จำนวนเต็ม ระบบต้องปฏิเสธด้วย `VALIDATION_ERROR`

**FR-2.1.2** เมื่อ Customer เรียก `addItem(productId, quantity)` ด้วย quantity ที่เป็นจำนวนเต็มแต่อยู่นอกช่วง 1 ถึง 10 ระบบต้องปฏิเสธด้วย `QTY_OUT_OF_RANGE`

**FR-2.2 สินค้าใน `addItem`**

**FR-2.2.1** เมื่อ Customer เรียก `addItem` ด้วย productId ที่ไม่มีในระบบ ระบบต้องปฏิเสธด้วย `PRODUCT_NOT_FOUND`

**FR-2.2.2** เมื่อ Customer เรียก `addItem` ด้วย productId ของสินค้าที่ไม่ใช่สินค้าพร้อมขาย ระบบต้องปฏิเสธด้วย `PRODUCT_UNAVAILABLE`

**FR-2.3 ผลของ `addItem` ที่ผ่านการตรวจสอบ**

**FR-2.3.1** เมื่อ `addItem` ผ่านการตรวจสอบและสินค้ายังไม่อยู่ในตะกร้า ระบบต้องเพิ่มรายการใหม่ที่มี quantity ตามที่ระบุ

**FR-2.3.2** เมื่อ `addItem` ผ่านการตรวจสอบและสินค้าอยู่ในตะกร้าแล้ว ระบบต้องปรับ quantity ของรายการนั้นเป็น quantity เดิมบวก quantity ที่ระบุ

**FR-2.4 quantity รวมหลัง `addItem`**

**FR-2.4.1** เมื่อ quantity ของรายการหลังการเพิ่มตาม FR-2.3.2 เกิน 10 ระบบต้องปฏิเสธด้วย `QTY_OUT_OF_RANGE`

**FR-2.4.2** เมื่อ quantity ของรายการหลังการเพิ่มตาม FR-2.3 ไม่เกิน 10 แต่เกินสต็อกพร้อมขายของสินค้านั้น ระบบต้องปฏิเสธด้วย `INSUFFICIENT_STOCK`

**FR-2.5 `updateQuantity`**

**FR-2.5.1** เมื่อ Customer เรียก `updateQuantity(productId, quantity)` ด้วย quantity ที่ไม่ใช่จำนวนเต็ม ระบบต้องปฏิเสธด้วย `VALIDATION_ERROR`

**FR-2.5.2** เมื่อ Customer เรียก `updateQuantity` ด้วย quantity ที่เป็นจำนวนเต็มแต่อยู่นอกช่วง 1 ถึง 10 (รวม 0) ระบบต้องปฏิเสธด้วย `QTY_OUT_OF_RANGE`

**FR-2.5.3** เมื่อ Customer เรียก `updateQuantity` กับสินค้าที่ไม่อยู่ในตะกร้า ระบบต้องปฏิเสธด้วย `ITEM_NOT_IN_CART`

**FR-2.5.4** เมื่อ Customer เรียก `updateQuantity` กับสินค้าในตะกร้าที่ไม่ใช่สินค้าพร้อมขาย ระบบต้องปฏิเสธด้วย `PRODUCT_UNAVAILABLE`

**FR-2.5.5** เมื่อ Customer เรียก `updateQuantity` ด้วย quantity ใหม่ที่เกินสต็อกพร้อมขาย ระบบต้องปฏิเสธด้วย `INSUFFICIENT_STOCK`

**FR-2.5.6** เมื่อ `updateQuantity` ผ่านการตรวจสอบ ระบบต้องแทนที่ quantity ของรายการด้วยค่าใหม่

**FR-2.6** ลำดับการตรวจสอบของ `addItem` และ `updateQuantity` ต้องเป็นดังนี้ และระบบต้องส่งกลับเฉพาะข้อผิดพลาดของขั้นแรกที่ไม่ผ่าน:
1. quantity เป็นจำนวนเต็ม (`VALIDATION_ERROR`)
2. quantity ที่ระบุอยู่ในช่วง 1–10 (`QTY_OUT_OF_RANGE`)
3. `addItem`: productId มีอยู่ในระบบ (`PRODUCT_NOT_FOUND`) / `updateQuantity`: สินค้าอยู่ในตะกร้า (`ITEM_NOT_IN_CART`)
4. สินค้าเป็นสินค้าพร้อมขาย (`PRODUCT_UNAVAILABLE`)
5. เฉพาะ `addItem`: quantity รวมหลังเพิ่มไม่เกิน 10 (`QTY_OUT_OF_RANGE`)
6. quantity ของรายการหลังดำเนินการไม่เกินสต็อกพร้อมขาย (`INSUFFICIENT_STOCK`)

**FR-2.7 `removeItem`**

**FR-2.7.1** เมื่อ Customer เรียก `removeItem(productId)` ขณะตะกร้าไม่มีรายการ ระบบต้องปฏิเสธด้วย `CART_EMPTY` พร้อมข้อความ "ไม่มีสินค้าให้ลบ"

**FR-2.7.2** เมื่อ Customer เรียก `removeItem(productId)` ขณะตะกร้ามีรายการแต่ไม่มีสินค้านั้น ระบบต้องปฏิเสธด้วย `ITEM_NOT_IN_CART` พร้อมข้อความ "ไม่พบสินค้าในตะกร้า"

**FR-2.7.3** เมื่อ Customer เรียก `removeItem(productId)` กับสินค้าที่อยู่ในตะกร้า ระบบต้องลบรายการนั้นทั้งรายการ ไม่ว่าสินค้าจะเป็นสินค้าพร้อมขายหรือไม่

**FR-2.7.4** เมื่อจำนวนรายการในตะกร้าเป็นศูนย์หลังการลบตาม FR-2.7.3 ระบบต้องแสดงข้อความ "ตะกร้าว่าง"

**FR-2.8** ปุ่ม "ชำระเงิน" ต้องอยู่ในสถานะเปิดใช้งานเมื่อและเฉพาะเมื่อจำนวนรายการในตะกร้ามีตั้งแต่หนึ่งขึ้นไปและ Customer อยู่ stage `ตะกร้า`

**FR-2.9** `viewCart` ต้องแสดงแต่ละรายการด้วยชื่อ ราคาต่อชิ้น **ปัจจุบัน** quantity และสถานะว่าเป็นสินค้าพร้อมขายหรือไม่ พร้อมทั้งยอดรวมสินค้าและ code คูปองที่ผูกอยู่ (ถ้ามี)

### FR-3 : คูปอง (ฝั่ง Customer)

FR-3.1 และ FR-3.2 ใช้เมื่อ Customer อยู่ stage `ตะกร้า`

**FR-3.1 การตรวจ code ใน `applyCoupon`**

**FR-3.1.1** ระบบต้องเปรียบเทียบ code ใน `applyCoupon(code)` กับ code ของคูปองแบบตรงตัวอักษร (case-sensitive)

**FR-3.1.2** เมื่อ Customer เรียก `applyCoupon(code)` ด้วย code ที่ไม่มีอยู่ หรือของคูปองที่มีสถานะ `ปิดใช้` ระบบต้องปฏิเสธด้วย `COUPON_INVALID`

**FR-3.2 การผูกคูปอง**

**FR-3.2.1** เมื่อ Customer เรียก `applyCoupon(code)` ด้วย code ของคูปองที่มีสถานะ `เปิดใช้` ระบบต้องผูกคูปองนั้นกับตะกร้าแทนคูปองเดิม (ผูกได้ครั้งละหนึ่งใบ)

**FR-3.2.2** ระบบต้องไม่ตรวจยอดขั้นต่ำของคูปองขณะผูกตาม FR-3.2.1

**FR-3.2.3** ระบบต้องอนุญาตให้ผูกคูปองตาม FR-3.2.1 ได้แม้ตะกร้าไม่มีรายการ

**FR-3.3** ระบบต้องไม่จำกัดจำนวนครั้งที่คูปองหนึ่งใบถูกใช้

### FR-4 : การคำนวณราคา

**FR-4.1** ยอดรวมสินค้าต้องคำนวณตามนิยามในส่วนที่ 2 โดยใช้ราคาต่อชิ้นปัจจุบัน ณ เวลาที่คำนวณ

**FR-4.2 ส่วนลดจากคูปอง**

**FR-4.2.1** เมื่อมีคูปองผูกอยู่ และคูปองยังมีสถานะ `เปิดใช้` และยอดรวมสินค้ามากกว่าหรือเท่ากับยอดขั้นต่ำของคูปอง ระบบต้องให้ส่วนลดเท่ากับ floor(ยอดรวมสินค้า × percent / 100)

**FR-4.2.2** เมื่อให้ส่วนลดจากคูปองตาม FR-4.2.1 ระบบต้องไม่ให้ส่วนลดสมาชิกตาม FR-4.4 เพิ่ม (ส่วนลดไม่ทบกัน)

**FR-4.3 คูปองที่ใช้ไม่ได้**

**FR-4.3.1** เมื่อมีคูปองผูกอยู่ แต่คูปองมีสถานะ `ปิดใช้` หรือยอดรวมสินค้าน้อยกว่ายอดขั้นต่ำของคูปอง ระบบต้องถอดคูปองออกจากตะกร้า

**FR-4.3.2** เมื่อถอดคูปองตาม FR-4.3.1 ระบบต้องแจ้ง notice `COUPON_NOT_APPLICABLE` พร้อมข้อความ "คูปองไม่สามารถใช้กับคำสั่งซื้อนี้"

**FR-4.4 ส่วนลดสมาชิก** (ใช้เมื่อไม่มีคูปองผูกอยู่ หรือคูปองถูกถอดตาม FR-4.3.1)

**FR-4.4.1** ระบบต้องให้ส่วนลดสมาชิกเท่ากับ floor(ยอดรวมสินค้า × 5 / 100) แก่ Customer ระดับ `prime`

**FR-4.4.2** ระบบต้องให้ส่วนลดเป็นศูนย์แก่ Customer ระดับ `normal`

**FR-4.5** ระบบต้องจัดระดับน้ำหนัก (weightTier) จากน้ำหนักรวมดังนี้:

| weightTier | น้ำหนักรวม (กรัม) |
|---|---|
| `light` | 1 – 1,000 |
| `medium` | 1,001 – 5,000 |
| `heavy` | 5,001 – 20,000 |

(น้ำหนักรวมที่เกิน 20,000 กรัมไม่สามารถจัดส่งได้ — ดู FR-5.2.1)

**FR-4.6** อัตราค่าจัดส่งพื้นฐาน (base rate, บาท) ต้องเป็นไปตามตารางต่อไปนี้:

| weightTier \ zone | `inCity` | `upcountry` | `remote` |
|---|---|---|---|
| `light` | 30 | 50 | 80 |
| `medium` | 50 | 80 | 120 |
| `heavy` | 80 | 120 | 180 |

**FR-4.7** ค่าจัดส่งต้องคำนวณจาก base rate ตามระดับสมาชิกและความเร็วจัดส่งดังนี้:

| memberTier | `standard` | `express` |
|---|---|---|
| `normal` | base rate | base rate × 3 / 2 |
| `prime` | 0 | base rate × 1 / 2 |

**FR-4.8** ยอดชำระสุทธิต้องเท่ากับ ยอดรวมสินค้า − ส่วนลด + ค่าจัดส่ง

### FR-5 : การเข้าสู่ขั้นตอนชำระเงิน

FR-5.1 ถึง FR-5.3 ใช้เมื่อ Customer อยู่ stage `ตะกร้า`

**FR-5.1** เมื่อ Customer เรียก `pressCheckout(zone, speed)` ด้วย zone หรือ speed ที่ไม่ใช่ค่าที่นิยามไว้ในส่วนที่ 2 ระบบต้องปฏิเสธด้วย `VALIDATION_ERROR`

**FR-5.2 การตรวจสอบของ `pressCheckout`**

**FR-5.2.1** ลำดับการตรวจสอบของ `pressCheckout` ต้องเป็นดังนี้ และระบบต้องส่งกลับเฉพาะข้อผิดพลาดของขั้นแรกที่ไม่ผ่าน:
1. zone และ speed ถูกต้องตาม FR-5.1 (`VALIDATION_ERROR`)
2. ตะกร้ามีอย่างน้อยหนึ่งรายการ (`CART_EMPTY` พร้อมข้อความ "ไม่สามารถชำระเงินได้ ตะกร้าว่าง")
3. ทุกรายการเป็นสินค้าพร้อมขาย และ quantity ไม่เกินสต็อกพร้อมขาย (`ITEMS_UNAVAILABLE` พร้อมรายการ productId ทั้งหมดที่ไม่ผ่าน)
4. น้ำหนักรวมไม่เกิน 20,000 กรัม (`WEIGHT_LIMIT_EXCEEDED`)

**FR-5.2.2** ระบบต้องประเมินคูปองตาม FR-4.2–4.4 หลังจากผ่านการตรวจสอบทั้งสี่ขั้นใน FR-5.2.1 แล้วเท่านั้น

**FR-5.3 ผลของ `pressCheckout` ที่ผ่านการตรวจสอบ**

**FR-5.3.1** ระบบต้องคำนวณยอดรวมสินค้า ส่วนลด ค่าจัดส่ง และยอดชำระสุทธิตาม FR-4

**FR-5.3.2** ระบบต้องสร้างออเดอร์สถานะ `รอชำระเงิน`

**FR-5.3.3** ระบบต้องกำหนด orderId ของออเดอร์ใหม่ให้ไม่ซ้ำกับออเดอร์อื่น

**FR-5.3.4** orderId ต้องไม่เปลี่ยนแปลงตลอดอายุของออเดอร์

**FR-5.3.5** ระบบต้องบันทึกในออเดอร์ ได้แก่ สำเนารายการ (ชื่อ ราคาต่อชิ้น ณ ขณะนั้น quantity) ยอดรวมสินค้า ส่วนลด ค่าจัดส่ง ยอดชำระสุทธิ zone speed และ code คูปองที่ใช้ (ถ้ามี)

**FR-5.3.6** ข้อมูลที่บันทึกตาม FR-5.3.5 ต้องไม่เปลี่ยนตามการแก้ไขตะกร้า สินค้า หรือคูปองที่เกิดขึ้นภายหลัง

**FR-5.3.7** ระบบต้องลดสต็อกพร้อมขายของสินค้าแต่ละรายการลงตาม quantity (การจองสต็อก)

**FR-5.3.8** ระบบต้องเปลี่ยน Customer ไปสู่ stage `ชำระเงิน`

**FR-5.3.9** รายการในตะกร้าต้องคงอยู่ครบถ้วนหลังเข้าสู่ stage `ชำระเงิน`

**FR-5.3.10** การจองสต็อกตาม FR-5.3.7 ต้องคงอยู่จนกว่าออเดอร์จะเปลี่ยนเป็น `ชำระเงินแล้ว` (FR-6.1.1) หรือ `ยกเลิก` (FR-7.1.1) เท่านั้น

### FR-6 : การชำระเงิน

**FR-6.1 `paySuccess`** (ใช้เมื่อออเดอร์มีสถานะ `รอชำระเงิน` และเจ้าของอยู่ stage `ชำระเงิน`)

**FR-6.1.1** เมื่อระบบได้รับ `paySuccess(orderId)` ระบบต้องเปลี่ยนสถานะออเดอร์จาก `รอชำระเงิน` เป็น `ชำระเงินแล้ว`

**FR-6.1.2** เมื่อระบบได้รับ `paySuccess(orderId)` ระบบต้องล้างตะกร้าของเจ้าของให้จำนวนรายการเป็นศูนย์และไม่มีคูปองผูก

**FR-6.1.3** เมื่อระบบได้รับ `paySuccess(orderId)` ระบบต้องเปลี่ยนเจ้าของไปสู่ stage `สำเร็จ`

**FR-6.1.4** stage `สำเร็จ` ต้องแสดง orderId รายการสินค้า และยอดเงินทุกส่วนของออเดอร์ที่ชำระเงิน

**FR-6.2 `payFail`** (ใช้เมื่อออเดอร์มีสถานะ `รอชำระเงิน` และเจ้าของอยู่ stage `ชำระเงิน`)

**FR-6.2.1** เมื่อระบบได้รับ `payFail(orderId)` ระบบต้องแสดงข้อความ "การชำระเงินล้มเหลว กรุณาลองใหม่"

**FR-6.2.2** เมื่อระบบได้รับ `payFail(orderId)` stage ของเจ้าของ สถานะออเดอร์ และการจองสต็อกต้องคงเดิม

**FR-6.3** ระบบต้องอนุญาตให้พยายามชำระเงินซ้ำได้ไม่จำกัดจำนวนครั้งหลังจาก `payFail`

**FR-6.4** เมื่อ Customer เรียก `continueShopping()` ขณะอยู่ stage `สำเร็จ` ระบบต้องเปลี่ยน Customer ไปสู่ stage `ตะกร้า`

**FR-6.5** เมื่อระบบได้รับ `paySuccess(orderId)` หรือ `payFail(orderId)` ด้วย orderId ที่ไม่มีอยู่ในระบบ ระบบต้องปฏิเสธด้วย `ORDER_NOT_FOUND`

### FR-7 : การยกเลิกการชำระเงิน

**FR-7.1 `cancelCheckout`** (ใช้เมื่อ Customer อยู่ stage `ชำระเงิน`)

**FR-7.1.1** เมื่อ Customer เรียก `cancelCheckout()` ระบบต้องเปลี่ยนสถานะออเดอร์เป็น `ยกเลิก`

**FR-7.1.2** เมื่อ Customer เรียก `cancelCheckout()` ระบบต้องเพิ่ม quantity ตามสำเนารายการของออเดอร์กลับเข้าสู่สต็อกพร้อมขาย ณ ขณะนั้นของสินค้าแต่ละรายการ

**FR-7.1.3** เมื่อ Customer เรียก `cancelCheckout()` ระบบต้องเปลี่ยน Customer กลับสู่ stage `ตะกร้า` โดยรายการในตะกร้ามีชนิดและ quantity เท่ากับก่อนเข้าสู่ stage `ชำระเงิน`

**FR-7.2 คูปองหลัง `cancelCheckout`**

**FR-7.2.1** คูปองที่ใช้ในออเดอร์ที่ถูกยกเลิกต้องยังคงผูกกับตะกร้า

**FR-7.2.2** คูปองที่ถูกถอดตาม FR-4.3.1 ต้องไม่ถูกผูกกลับ

**FR-7.3 การดำเนินการต่อหลัง `cancelCheckout`**

**FR-7.3.1** หลัง `cancelCheckout` Customer ต้องสามารถแก้ไขตะกร้าได้ตาม FR-2

**FR-7.3.2** หลัง `cancelCheckout` การเรียก `pressCheckout` ที่ผ่านการตรวจสอบต้องสร้างออเดอร์ใหม่ที่มี orderId ใหม่

### FR-8 : ข้อจำกัดของ operation ตามบริบท

**FR-8.1** ระบบต้องไม่ประมวลผล `addItem`, `updateQuantity`, `removeItem`, `applyCoupon` หรือ `pressCheckout` ขณะ Customer อยู่ stage `ชำระเงิน` หรือ `สำเร็จ`

**FR-8.2** ระบบต้องไม่ประมวลผล `paySuccess`, `payFail` หรือ `cancelCheckout` เมื่อเจ้าของออเดอร์อยู่ stage `ตะกร้า` หรือ `สำเร็จ`

**FR-8.3** เมื่อออเดอร์มีสถานะ `ชำระเงินแล้ว` หรือ `ยกเลิก` ระบบต้องไม่ประมวลผล `paySuccess`, `payFail` หรือ `cancelCheckout` กับออเดอร์นั้น

**FR-8.4** ระบบต้องไม่ประมวลผล `continueShopping` ขณะ Customer อยู่ stage `ตะกร้า` หรือ `ชำระเงิน`

**FR-8.5 ผลของการไม่ประมวลผล**

**FR-8.5.1** เมื่อระบบไม่ประมวลผล operation ตาม FR-8.1 ถึง FR-8.4 ระบบต้องปฏิเสธด้วย `OPERATION_NOT_ALLOWED`

**FR-8.5.2** ระบบต้องประมวลผล `viewCart`, `listProducts`, `listOrders` และ `viewOrder` ได้ในทุก stage

### FR-9 : การจัดการสินค้า (Admin)

**FR-9.1 `updateProduct`**

**FR-9.1.1** เมื่อ Admin เรียก `updateProduct(productId, price?, stock?)` ระบบต้องตรวจสอบตามลำดับต่อไปนี้ และส่งกลับเฉพาะข้อผิดพลาดของขั้นแรกที่ไม่ผ่าน:
1. มีสินค้านั้นในระบบ (`PRODUCT_NOT_FOUND`)
2. ระบุ price หรือ stock อย่างน้อยหนึ่งค่า และค่าที่ระบุผ่านเงื่อนไขต่อไปนี้ (`VALIDATION_ERROR` พร้อมรายชื่อฟิลด์**ทั้งหมด**ที่ไม่ผ่าน):
   - price เป็นจำนวนเต็ม 1 ถึง 50,000
   - stock เป็นจำนวนเต็ม 0 ถึง 9,999

**FR-9.1.2** เมื่อ `updateProduct` ผ่านการตรวจสอบ ระบบต้องเปลี่ยนค่าที่ระบุ โดยค่า stock ที่ระบุคือสต็อกพร้อมขายใหม่

**FR-9.2 ผลของราคาใหม่**

**FR-9.2.1** ราคาใหม่ต้องมีผลกับตะกร้าทุกใบทันที (FR-2.9, FR-4.1)

**FR-9.2.2** ราคาใหม่ต้องไม่มีผลกับออเดอร์ที่สร้างแล้ว (FR-5.3.6)

**FR-9.3 `setProductStatus`**

**FR-9.3.1** เมื่อ Admin เรียก `setProductStatus(productId, status)` ด้วย productId ที่ไม่มีในระบบ ระบบต้องปฏิเสธด้วย `PRODUCT_NOT_FOUND`

**FR-9.3.2** เมื่อ Admin เรียก `setProductStatus(productId, status)` กับสินค้าที่มีอยู่ ระบบต้องเปลี่ยนสถานะการขายตามที่ระบุ

**FR-9.3.3** การตั้งสถานะการขายเป็นสถานะเดียวกับปัจจุบันต้องสำเร็จโดยไม่มีการเปลี่ยนแปลง

**FR-9.3.4** สินค้าที่ถูกตั้งเป็น `ปิดขาย` ซึ่งอยู่ในตะกร้าของ Customer ต้องยังคงอยู่ในตะกร้า (แสดงว่าไม่ใช่สินค้าพร้อมขายตาม FR-2.9)

**FR-9.3.5** การเปลี่ยนสถานะการขายต้องไม่มีผลกับออเดอร์ที่สร้างแล้ว

### FR-10 : การจัดการคูปอง (Admin)

**FR-10.1 `setCouponStatus`**

**FR-10.1.1** เมื่อ Admin เรียก `setCouponStatus(code, status)` ด้วย code ที่ไม่มีอยู่ ระบบต้องปฏิเสธด้วย `COUPON_NOT_FOUND`

**FR-10.1.2** เมื่อ Admin เรียก `setCouponStatus(code, status)` ด้วย code ที่มีอยู่ ระบบต้องเปลี่ยนสถานะของคูปองตามที่ระบุ

**FR-10.1.3** การเปลี่ยนสถานะคูปองต้องมีผลต่อการคำนวณ ณ `pressCheckout` ครั้งถัดไป (FR-4.2.1, FR-4.3.1)

**FR-10.1.4** การเปลี่ยนสถานะคูปองต้องไม่มีผลกับออเดอร์ที่สร้างแล้ว

**FR-10.2** เมื่อ Admin เรียก `listCoupons()` ระบบต้องแสดงคูปองทั้งหมดในระบบ พร้อม code, percent, minSpend และสถานะ (`เปิดใช้` / `ปิดใช้`) ณ ขณะนั้น

---

## 5. Domain Error Codes

| Code | ความหมาย | FR ที่เกี่ยวข้อง |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | username/password ไม่ถูกต้อง | FR-0.1.2 |
| `AUTH_REQUIRED` | ยังไม่ได้ login | FR-0.2 |
| `AUTH_FORBIDDEN` | บทบาทไม่มีสิทธิ์ | FR-0.3.1, 0.3.2 |
| `VALIDATION_ERROR` | รูปแบบหรือช่วงของข้อมูลไม่ถูกต้อง | FR-2.1.1, 2.5.1, 5.1, 9.1.1 |
| `QTY_OUT_OF_RANGE` | quantity อยู่นอกช่วง 1–10 | FR-2.1.2, 2.4.1, 2.5.2 |
| `PRODUCT_NOT_FOUND` | ไม่มีสินค้า | FR-2.2.1, 9.1.1, 9.3.1 |
| `PRODUCT_UNAVAILABLE` | ไม่ใช่สินค้าพร้อมขาย | FR-2.2.2, 2.5.4 |
| `INSUFFICIENT_STOCK` | quantity เกินสต็อกพร้อมขาย | FR-2.4.2, 2.5.5 |
| `ITEM_NOT_IN_CART` | สินค้าไม่อยู่ในตะกร้า | FR-2.5.3, 2.7.2 |
| `CART_EMPTY` | ตะกร้าว่าง | FR-2.7.1, 5.2.1 |
| `COUPON_INVALID` | คูปองไม่มีหรือปิดใช้ ณ ขณะผูก | FR-3.1.2 |
| `ITEMS_UNAVAILABLE` | มีรายการที่ไม่พร้อมขาย ณ checkout | FR-5.2.1 |
| `WEIGHT_LIMIT_EXCEEDED` | น้ำหนักรวมเกิน 20,000 กรัม | FR-5.2.1 |
| `OPERATION_NOT_ALLOWED` | operation ไม่อนุญาตใน stage/สถานะปัจจุบัน | FR-8.5.1 |
| `ORDER_NOT_FOUND` | ไม่พบออเดอร์ (หรือไม่ใช่ของ Customer ผู้เรียก) | FR-0.5.2, 6.5 |
| `COUPON_NOT_FOUND` | ไม่พบคูปอง | FR-10.1.1 |

ทุกการปฏิเสธด้วย code ในตารางนี้ต้องไม่เปลี่ยนแปลงข้อมูลใดๆ (FR-0.7)

**Notice (ไม่ใช่การปฏิเสธ):** `COUPON_NOT_APPLICABLE` — FR-4.3.2

---

## 6. Design Constraints

ข้อกำหนดในส่วนนี้จำกัดวิธีออกแบบระบบ (ไม่ใช่พฤติกรรมที่ผู้ใช้เห็น) เพื่อให้ระบบทดสอบได้ในทุกระดับ และให้ test ของทุกกลุ่มเทียบกันได้ ข้อกำหนดแต่ละข้อใช้รหัส DC-x.y

### 6.1 การแยก business logic เป็น pure function (DC-1)

> ส่วนนี้มีไว้เพื่อให้ business logic ทดสอบในระดับ unit ได้ และให้ test ของทุกกลุ่มเทียบกันได้ (Claude เสนอ ผู้สอนยืนยันใช้ 2026-09-28)

**DC-1** api-server ต้องแยก business logic ต่อไปนี้เป็น **pure function** (ไม่อ่าน/เขียนฐานข้อมูล ไม่เรียก HTTP ไม่อ่านเวลาปัจจุบัน) ใน TypeScript ตาม signature ที่กำหนด และ route handler ต้องเรียกใช้ฟังก์ชันเหล่านี้:

```ts
type Zone = 'inCity' | 'upcountry' | 'remote';
type Speed = 'standard' | 'express';
type MemberTier = 'normal' | 'prime';
type WeightTier = 'light' | 'medium' | 'heavy' | 'overLimit';

// ---------- กลุ่มที่ 1: สินค้าและตะกร้า ----------

// นิยาม "สินค้าพร้อมขาย" (ส่วนที่ 2) — ใช้ใน FR-1.3.1, 2.2.2, 2.5.4, 2.9, 5.2.1
function isProductAvailable(isOnSale: boolean, availableStock: number): boolean;

// FR-2.1, 2.2, 2.4, 2.5.1–2.5.5 ตามลำดับการตรวจของ FR-2.6
// คืนค่า error code ของขั้นแรกที่ไม่ผ่าน หรือ 'OK'
function validateQuantityChange(input: {
  operation: 'add' | 'update';
  quantity: unknown;          // ค่าที่ได้รับจาก request (อาจไม่ใช่จำนวนเต็ม)
  productExists: boolean;     // ใช้เมื่อ operation = 'add' (ขั้น 3)
  inCart: boolean;            // ใช้เมื่อ operation = 'update' (ขั้น 3)
  available: boolean;         // ผลของ isProductAvailable (ขั้น 4)
  currentQtyInCart: number;   // 0 เมื่อสินค้ายังไม่อยู่ในตะกร้า (ขั้น 5–6)
  availableStock: number;     // ขั้น 6
}): 'OK' | 'VALIDATION_ERROR' | 'QTY_OUT_OF_RANGE' | 'PRODUCT_NOT_FOUND'
   | 'ITEM_NOT_IN_CART' | 'PRODUCT_UNAVAILABLE' | 'INSUFFICIENT_STOCK';

// ---------- กลุ่มที่ 2: การคำนวณราคา ----------

// FR-4.1
function calculateSubtotal(lines: { price: number; quantity: number }[]): number;

// นิยาม "น้ำหนักรวม" (ส่วนที่ 2) — อินพุตของ FR-4.5 และ FR-5.2.1 ขั้น 4
function calculateTotalWeight(lines: { weightGram: number; quantity: number }[]): number;

// FR-4.2 – FR-4.4
function calculateDiscount(
  subtotal: number,
  memberTier: MemberTier,
  coupon: { percent: number; minSpend: number; active: boolean } | null
): { discount: number; source: 'coupon' | 'member' | 'none'; couponRemoved: boolean };

// FR-4.5
function classifyWeight(totalWeightGram: number): WeightTier;

// FR-4.6, FR-4.7
function calculateShippingFee(
  weightTier: Exclude<WeightTier, 'overLimit'>, zone: Zone, speed: Speed, memberTier: MemberTier
): number;

// FR-4.8
function calculateNetTotal(subtotal: number, discount: number, shippingFee: number): number;

// ---------- กลุ่มที่ 3: การตรวจสอบก่อน checkout ----------

// FR-5.1, FR-5.2.1 — ตรวจ 4 ขั้นตามลำดับ และคืนผลของขั้นแรกที่ไม่ผ่าน
function validateCheckout(input: {
  zone: unknown;
  speed: unknown;
  lines: { productId: string; quantity: number; available: boolean; availableStock: number }[];
  totalWeightGram: number;    // ผลของ calculateTotalWeight
}):
  | { result: 'OK' }
  | { result: 'VALIDATION_ERROR' | 'CART_EMPTY' | 'WEIGHT_LIMIT_EXCEEDED' }
  | { result: 'ITEMS_UNAVAILABLE'; productIds: string[] };  // productId ทุกตัวที่ไม่ผ่านขั้น 3

// ---------- กลุ่มที่ 4: การจัดการสินค้า (Admin) ----------

// FR-9.1.1 ขั้น 2 (ขั้น 1 PRODUCT_NOT_FOUND ให้ route handler ตรวจก่อนเรียกฟังก์ชันนี้)
// คืนรายชื่อฟิลด์ที่ไม่ผ่านทั้งหมด — array ว่าง หมายถึงผ่าน
function validateProductUpdate(input: { price?: unknown; stock?: unknown }): ('price' | 'stock')[];
```

ข้อมูลที่ต้องอ่านจากฐานข้อมูล (เช่น สินค้ามีอยู่หรือไม่ สต็อกพร้อมขาย quantity ในตะกร้า) route handler ต้องอ่านก่อน แล้วส่งให้ฟังก์ชันเป็นพารามิเตอร์ ฟังก์ชันเหล่านี้ต้องไม่อ่านข้อมูลเอง

### 6.2 ความสามารถในการทดสอบของ Web UI สำหรับ E2E automation

> **ที่มา:** Full Stack Testing บทที่ 3 ระบุว่า id เป็น locator ที่ควรใช้เพื่อให้ test เสถียร เพราะ "CSS selectors and XPath locators tend to break when the application undergoes frequent changes" และเอกสาร Playwright แนะนำให้ใช้ locator ที่อิงสิ่งที่ผู้ใช้เห็น (`getByRole`, `getByLabel`) ก่อน และใช้ `getByTestId` (attribute `data-testid`) เมื่อหา element ด้วย role หรือข้อความไม่ได้ ส่วนการกำหนดให้ผลลัพธ์ต้องสังเกตได้บนหน้าจอ อิงหลัก observability ของ Aniche หัวข้อ 7.2
> **ส่วนที่ Claude กำหนดเอง:** รายชื่อ test ID ในตาราง 6.2.1, รูปแบบการตั้งชื่อ, attribute `data-value` / `data-kind` / `data-code` / `data-status` / `data-available` และ URL ของแต่ละหน้า

**DC-2.1** element ที่ผู้ใช้โต้ตอบได้ต้องใช้ HTML element ตามหน้าที่ (`button`, `a`, `input`, `select`) หรือกำหนด ARIA role ที่ตรงกับหน้าที่ เพื่อให้หา element ด้วย `getByRole` ได้

**DC-2.2** element ที่ผู้ใช้โต้ตอบได้ต้องมี accessible name (ข้อความที่มองเห็น หรือ `aria-label`) ที่ไม่ซ้ำกับ element อื่นที่มี role เดียวกันภายใน container เดียวกัน

**DC-2.3** ช่องกรอกข้อมูลทุกช่องต้องมี `<label>` ที่ผูกกับช่องนั้น

**DC-2.4** element ทุกตัวในตาราง 6.2.1 ต้องมี attribute `data-testid` ที่มีค่าตรงตามตาราง ค่า `data-testid` ต้องไม่ซ้ำกันภายใน container เดียวกัน และต้องไม่สร้างแบบสุ่มหรือเปลี่ยนตามเวอร์ชันของระบบ

**DC-2.5** element ที่แสดงข้อมูลซึ่งมีหลายแถว (สินค้า รายการในตะกร้า ออเดอร์ คูปอง) ต้องใส่ตัวระบุของข้อมูลนั้นใน `data-testid` ของแถว ตามรูปแบบ `{ชื่อแถว}-{ตัวระบุ}` เช่น `cart-line-P1` และ element ย่อยภายในแถวใช้ชื่อตามตาราง 6.2.1 โดยไม่มีตัวระบุ

**DC-2.6** element หลักของแต่ละหน้าต้องมี `data-testid` ตามชื่อหน้าในตาราง 6.2.1 เพื่อให้ E2E ตรวจได้ว่าผู้ใช้อยู่ที่หน้าใด (หน้าของ Customer ตรงกับ stage ในส่วนที่ 2)

**DC-2.7** element ที่แสดงจำนวนเงินหรือจำนวนชิ้นต้องมี attribute `data-value` เป็นจำนวนเต็มที่ไม่มีการจัดรูปแบบ (เช่น ข้อความ "฿1,485" ต้องมี `data-value="1485"`)

**DC-2.8** ผลลัพธ์ของ operation ที่ต้องแสดงข้อความ (การปฏิเสธด้วย domain error code, notice `COUPON_NOT_APPLICABLE` และข้อความที่ FR กำหนด เช่น "ตะกร้าว่าง") ต้องแสดงใน element `app-message` ที่มี attribute:
- `data-kind` = `error` (การปฏิเสธ) / `notice` (notice) / `info` (ข้อความอื่นที่ FR กำหนด)
- `data-code` = domain error code หรือ notice code (เว้นว่างเมื่อ `data-kind="info"`)

**DC-2.9** element ที่แสดงสถานะ (สถานะออเดอร์ สถานะการขาย สถานะคูปอง) ต้องมี attribute `data-status` ที่มีค่าตรงกับค่า enum ของสถานะนั้นใน API contract

**DC-2.10** element ที่แสดงว่ารายการในตะกร้าเป็นสินค้าพร้อมขายหรือไม่ (FR-2.9) ต้องมี attribute `data-available` = `true` / `false`

**DC-2.11** สถานะปิดใช้งานของปุ่ม "ชำระเงิน" (FR-2.8) ต้องแสดงด้วย HTML attribute `disabled`

**DC-2.12** แต่ละหน้าต้องเข้าถึงได้ด้วย URL ในตาราง 6.2.2 โดยตรง

**DC-2.13** เมื่อ Customer เปิด URL ของหน้าที่ไม่ตรงกับ stage ปัจจุบัน Web UI ต้องแสดงหน้าที่ตรงกับ stage ปัจจุบัน (สอดคล้องกับนิยาม stage ในส่วนที่ 2)

#### 6.2.1 รายชื่อ test ID ขั้นต่ำ

| หน้า (`data-testid` ของ element หลัก) | element (`data-testid`) | attribute เพิ่มเติม | FR ที่เกี่ยวข้อง |
|---|---|---|---|
| ทุกหน้า | `app-message` | `data-kind`, `data-code` | FR-0.7, 2.7, 4.3.2, 6.2.1 และทุก error code |
| ทุกหน้าหลัง login | `nav-products`, `nav-cart`, `nav-orders` (Customer), `nav-admin-products`, `nav-admin-coupons` (Admin) | — | FR-0.3 |
| `page-login` | `login-username`, `login-password`, `login-submit` | — | FR-0.1 |
| `page-products` | แถว `product-row-{productId}` ภายในมี `product-name`, `product-price`, `product-stock`, `product-add-qty`, `product-add-button` | `data-value` ที่ price, stock | FR-1.3.1, 2.1–2.4 |
| `page-cart` | แถว `cart-line-{productId}` ภายในมี `cart-line-name`, `cart-line-unit-price`, `cart-line-qty`, `cart-line-availability`, `cart-line-qty-input`, `cart-line-update`, `cart-line-remove` | `data-value` ที่ unit-price, qty; `data-available` ที่ availability | FR-2.5, 2.7, 2.9 |
| | `cart-subtotal`, `cart-coupon-code`, `coupon-input`, `coupon-apply`, `zone-select`, `speed-select`, `checkout-button` | `data-value` ที่ subtotal; `disabled` ที่ checkout-button | FR-2.8, 2.9, 3, 5 |
| `page-checkout` | `checkout-order-id`, `checkout-subtotal`, `checkout-discount`, `checkout-shipping`, `checkout-total`, `cancel-checkout-button` | `data-value` ที่จำนวนเงิน | FR-5.3, 7.1 |
| `page-success` | `success-order-id`, แถว `success-line-{productId}`, `success-subtotal`, `success-discount`, `success-shipping`, `success-total`, `continue-shopping-button` | `data-value` ที่จำนวนเงิน | FR-6.1.4, 6.4 |
| `page-orders` | แถว `order-row-{orderId}` ภายในมี `order-status`, `order-total`, `order-view` | `data-status`, `data-value` | FR-0.5.1, 0.6 |
| `page-order-detail` | `order-detail-id`, `order-detail-status`, แถว `order-line-{productId}` ภายในมี `order-line-unit-price`, `order-line-qty`; `order-detail-subtotal`, `order-detail-discount`, `order-detail-shipping`, `order-detail-total` | `data-status`, `data-value` | FR-5.3.5, 5.3.6 |
| `page-admin-products` | แถว `admin-product-row-{productId}` ภายในมี `admin-product-price`, `admin-product-stock`, `admin-product-status`, `admin-product-price-input`, `admin-product-stock-input`, `admin-product-save`, `admin-product-toggle-status` | `data-value`, `data-status` | FR-1.3.2, 9.1–9.3 |
| `page-admin-coupons` | แถว `admin-coupon-row-{code}` ภายในมี `admin-coupon-percent`, `admin-coupon-min-spend`, `admin-coupon-status`, `admin-coupon-toggle-status` | `data-value`, `data-status` | FR-10.1, 10.2 |

#### 6.2.2 URL ของแต่ละหน้า

| หน้า | URL |
|---|---|
| `page-login` | `/login` |
| `page-products` | `/products` |
| `page-cart` | `/cart` |
| `page-checkout` | `/checkout` |
| `page-success` | `/success` |
| `page-orders` | `/orders` |
| `page-order-detail` | `/orders/{orderId}` |
| `page-admin-products` | `/admin/products` |
| `page-admin-coupons` | `/admin/coupons` |

### 6.3 สภาพแวดล้อมทดสอบ

> **ที่มา:** เอกสาร Playwright แนะนำว่า "Each test should be completely isolated from another test and should run independently with its own local storage, session storage, data, cookies etc." ส่วนการจำลอง payment gateway ต่อยอดจากส่วนที่ 1.3 ของ spec นี้
> **ส่วนที่ Claude กำหนดเอง:** รูปแบบของกลไก reset และหน้าจำลอง gateway

**DC-3.1** ในสภาพแวดล้อมทดสอบ api-server ต้องมีกลไกให้ test คืนข้อมูลทั้งหมดกลับเป็น seed data ตามส่วนที่ 7 (ตะกร้า คูปองที่ผูก stage ออเดอร์ สินค้า สต็อก และคูปอง) รายละเอียดของกลไกนี้กำหนดใน API contract

**DC-3.2** กลไกตาม DC-3.1 ต้องใช้ไม่ได้ในสภาพแวดล้อมอื่นนอกจากสภาพแวดล้อมทดสอบ

**DC-3.3** ในสภาพแวดล้อมทดสอบ หน้า `page-checkout` ต้องมีปุ่มจำลอง payment gateway ได้แก่ `gateway-pay-success` (เรียก OP-10 กับออเดอร์ปัจจุบัน) และ `gateway-pay-fail` (เรียก OP-11 กับออเดอร์ปัจจุบัน)


---

## 7. ข้อมูลตั้งต้น (Seed Data)

| productId | ชื่อ | ราคา (บาท) | น้ำหนัก (กรัม) | สต็อกพร้อมขาย | สถานะ |
|---|---|---|---|---|---|
| P1 | Coffee Beans 250g | 450 | 300 | 20 | เปิดขาย |
| P2 | Drip Kettle | 1,200 | 900 | 3 | เปิดขาย |
| P3 | Espresso Machine | 15,000 | 8,000 | 5 | เปิดขาย |

| code | percent | minSpend | สถานะ |
|---|---|---|---|
| SAVE10 | 10 | 1,000 | เปิดใช้ |

| บัญชี | บทบาท | memberTier |
|---|---|---|
| cus_normal | Customer | normal |
| cus_prime | Customer | prime |
| admin01 | Admin | — |

ระบบต้องมีข้อมูลชุดนี้เมื่อเริ่มต้น (FR-1.4) และทุก AC เริ่มจากข้อมูลชุดนี้ เว้นแต่ระบุไว้เป็นอย่างอื่นใน Given

---

## 8. Acceptance Criteria

**AC-1 (FR-2.1.2, FR-2.6, FR-0.7)**
Given cus_normal อยู่ stage `ตะกร้า` และตะกร้าว่าง
When เรียก `addItem(P1, 0)`
Then ระบบปฏิเสธด้วย `QTY_OUT_OF_RANGE` และตะกร้ายังว่าง

**AC-2 (FR-2.3.2, FR-2.4.1, FR-0.7)**
Given ตะกร้าของ cus_normal มี P1 quantity 8
When เรียก `addItem(P1, 3)`
Then ระบบปฏิเสธด้วย `QTY_OUT_OF_RANGE` และ P1 ยังมี quantity 8

**AC-3 (FR-2.4.2, FR-0.7)**
Given ตะกร้าของ cus_normal มี P2 quantity 2 (สต็อกพร้อมขาย P2 = 3)
When เรียก `addItem(P2, 2)`
Then ระบบปฏิเสธด้วย `INSUFFICIENT_STOCK` และ P2 ยังมี quantity 2

**AC-4 (FR-4.2.1, FR-4.2.2, FR-4.7, FR-4.8)**
Given ตะกร้าของ cus_prime มี P1 × 1 และ P2 × 1 (ยอดรวมสินค้า 1,650, น้ำหนักรวม 1,200 กรัม) และผูกคูปอง SAVE10
When เรียก `pressCheckout(inCity, standard)`
Then ออเดอร์มีส่วนลด 165 (จากคูปอง ไม่มีส่วนลดสมาชิก), ค่าจัดส่ง 0, ยอดชำระสุทธิ 1,485

**AC-5 (FR-4.4.1, การปัดเศษ)**
Given ตะกร้าของ cus_prime มี P1 × 1 และ P2 × 1 (ยอดรวมสินค้า 1,650) และไม่มีคูปองผูก
When เรียก `pressCheckout(inCity, standard)`
Then ส่วนลดสมาชิก = floor(82.5) = 82, ค่าจัดส่ง 0, ยอดชำระสุทธิ 1,568

**AC-6 (FR-4.3.1, FR-4.3.2, FR-4.4.1, FR-4.7)**
Given ตะกร้าของ cus_prime มี P1 × 2 (ยอดรวมสินค้า 900, น้ำหนักรวม 600 กรัม) และผูกคูปอง SAVE10
When เรียก `pressCheckout(upcountry, express)`
Then ระบบถอดคูปองพร้อม notice `COUPON_NOT_APPLICABLE`, ส่วนลดสมาชิก 45, ค่าจัดส่ง 25, ยอดชำระสุทธิ 880

**AC-7 (FR-4.3.1, FR-4.3.2, FR-4.4.2, FR-10.1.3 — ข้าม actor)**
Given ตะกร้าของ cus_normal มี P2 × 1 (ยอดรวมสินค้า 1,200, น้ำหนักรวม 900 กรัม) และผูกคูปอง SAVE10
And admin01 เรียก `setCouponStatus(SAVE10, ปิดใช้)`
When cus_normal เรียก `pressCheckout(inCity, standard)`
Then ระบบถอดคูปองพร้อม notice `COUPON_NOT_APPLICABLE`, ส่วนลด 0, ค่าจัดส่ง 30, ยอดชำระสุทธิ 1,230

**AC-8 (FR-4.5, FR-4.7)**
Given ตะกร้าของ cus_normal มี P3 × 1 (ยอดรวมสินค้า 15,000, น้ำหนักรวม 8,000 กรัม) และไม่มีคูปองผูก
When เรียก `pressCheckout(remote, express)`
Then ส่วนลด 0, ค่าจัดส่ง 270, ยอดชำระสุทธิ 15,270

**AC-9 (FR-5.2.1, FR-0.7)**
Given ตะกร้าของ cus_normal มี P3 × 3 (น้ำหนักรวม 24,000 กรัม)
When เรียก `pressCheckout(inCity, standard)`
Then ระบบปฏิเสธด้วย `WEIGHT_LIMIT_EXCEEDED`, cus_normal ยังอยู่ stage `ตะกร้า` และตะกร้าคงเดิม

**AC-10 (FR-5.2.1, FR-9.3.4, FR-0.7 — ข้าม actor)**
Given ตะกร้าของ cus_normal มี P1 × 1
And admin01 เรียก `setProductStatus(P1, ปิดขาย)`
When cus_normal เรียก `pressCheckout(inCity, standard)`
Then ระบบปฏิเสธด้วย `ITEMS_UNAVAILABLE` ระบุ [P1] และตะกร้าคงเดิม

**AC-11a (FR-5.3.2, FR-5.3.7, FR-5.3.8 — การจองสต็อก)**
Given cus_normal อยู่ stage `ตะกร้า` และตะกร้ามี P2 × 3 (สต็อกพร้อมขายของ P2 = 3)
When cus_normal เรียก `pressCheckout(inCity, standard)`
Then ระบบสร้างออเดอร์สถานะ `รอชำระเงิน`, cus_normal อยู่ stage `ชำระเงิน` และสต็อกพร้อมขายของ P2 = 0

**AC-11b (FR-5.2.1, FR-5.3.7, FR-0.7 — การจองสต็อกข้าม Customer)**
Given ตะกร้าของ cus_prime มี P2 × 1 (เพิ่มไว้ก่อนที่ cus_normal จะ checkout)
And cus_normal มีออเดอร์สถานะ `รอชำระเงิน` ที่จอง P2 × 3 ไว้ (สต็อกพร้อมขายของ P2 = 0)
When cus_prime เรียก `pressCheckout(inCity, standard)`
Then ระบบปฏิเสธด้วย `ITEMS_UNAVAILABLE` ระบุ [P2], cus_prime ยังอยู่ stage `ตะกร้า` และตะกร้าคงเดิม

**AC-11c (FR-2.2.2, FR-0.7 — สินค้าที่สต็อกถูกจองหมด)**
Given ตะกร้าของ cus_prime ว่าง
And cus_normal มีออเดอร์สถานะ `รอชำระเงิน` ที่จอง P2 × 3 ไว้ (สต็อกพร้อมขายของ P2 = 0)
When cus_prime เรียก `addItem(P2, 1)`
Then ระบบปฏิเสธด้วย `PRODUCT_UNAVAILABLE` และตะกร้าของ cus_prime ยังว่าง

**AC-12 (FR-7.1.1, FR-7.1.2, FR-7.1.3)**
Given cus_normal อยู่ stage `ชำระเงิน` กับออเดอร์สถานะ `รอชำระเงิน` ที่มี P2 × 3
And ตะกร้าของ cus_normal มี P2 × 3 และสต็อกพร้อมขายของ P2 = 0
When cus_normal เรียก `cancelCheckout()`
Then ออเดอร์มีสถานะ `ยกเลิก`, สต็อกพร้อมขายของ P2 = 3, cus_normal อยู่ stage `ตะกร้า` และตะกร้ามี P2 × 3

**AC-13 (FR-5.3.6, FR-9.2.1, FR-9.2.2)**
Given cus_normal มีออเดอร์สถานะ `รอชำระเงิน` ที่มี P1 ราคา 450
When admin01 เรียก `updateProduct(P1, price = 500)`
Then `viewOrder` ของออเดอร์นั้นยังแสดงราคา P1 = 450 และ `viewCart` ของ Customer ที่มี P1 ในตะกร้าแสดงราคา 500

**AC-14 (FR-0.3.2, FR-0.7)**
Given cus_normal login แล้ว
When เรียก `updateProduct(P1, price = 500)`
Then ระบบปฏิเสธด้วย `AUTH_FORBIDDEN` และราคาของ P1 ยังเป็น 450

**AC-15 (FR-0.5.2)**
Given cus_normal มีออเดอร์ที่มี orderId = X
When cus_prime เรียก `viewOrder(X)`
Then ระบบปฏิเสธด้วย `ORDER_NOT_FOUND`

**AC-16 (FR-9.1.1, FR-0.7)**
Given admin01 login แล้ว
When เรียก `updateProduct(P1, price = 0, stock = 10000)`
Then ระบบปฏิเสธด้วย `VALIDATION_ERROR` ระบุฟิลด์ [price, stock] และ P1 ยังมีราคา 450 สต็อกพร้อมขาย 20

**AC-17 (FR-8.1, FR-8.5.1, FR-0.7)**
Given cus_normal อยู่ stage `ชำระเงิน`
When เรียก `addItem(P1, 1)`
Then ระบบส่งกลับ `OPERATION_NOT_ALLOWED` และตะกร้า stage และสต็อกคงเดิม

**AC-18a (FR-6.1.1, FR-6.1.2, FR-6.1.3)**
Given cus_normal อยู่ stage `ชำระเงิน` กับออเดอร์ Z สถานะ `รอชำระเงิน`
When gateway เรียก `paySuccess(Z)`
Then ออเดอร์ Z มีสถานะ `ชำระเงินแล้ว`, ตะกร้าของ cus_normal มีจำนวนรายการเป็นศูนย์และไม่มีคูปองผูก และ cus_normal อยู่ stage `สำเร็จ`

**AC-18b (FR-6.4)**
Given cus_normal อยู่ stage `สำเร็จ`
When cus_normal เรียก `continueShopping()`
Then cus_normal อยู่ stage `ตะกร้า` ที่มีจำนวนรายการเป็นศูนย์

**AC-19a (FR-10.1.2)**
Given admin01 login แล้ว และ SAVE10 มีสถานะ `เปิดใช้`
When admin01 เรียก `setCouponStatus(SAVE10, ปิดใช้)`
Then ระบบเปลี่ยนสถานะของ SAVE10 เป็น `ปิดใช้`

**AC-19b (FR-10.2)**
Given admin01 login แล้ว และ SAVE10 มีสถานะ `ปิดใช้`
When admin01 เรียก `listCoupons()`
Then รายการแสดง SAVE10 ที่มี percent 10, minSpend 1,000 และสถานะ `ปิดใช้`

---

## 9. Open Issues / Specification Gaps

ตั้งแต่ v1.8 ไม่มี Open Issue ที่ spec ตั้งใจเว้นไว้ (OI-1 และ OI-2 ปิดแล้ว) แต่ spec อาจยังมีจุดที่ไม่ได้กำหนดโดยไม่ตั้งใจ เมื่อนิสิตพบจุดดังกล่าว ให้ปฏิบัติดังนี้:
1. บันทึกลง Open Issue Log ของเอกสารการออกแบบ test (รหัส SOI-n)
2. ไม่เขียน test case ที่มีค่าคาดหวังสำหรับจุดนั้น และห้ามใช้พฤติกรรมของโปรแกรมที่พัฒนาขึ้นเป็นค่าคาดหวัง
3. ตอน implement ให้เลือกพฤติกรรมที่ง่ายที่สุด และไม่เพิ่มความสามารถที่ spec ไม่ได้กำหนด

Open Issue เดิม (ปิดแล้ว):

~~**OI-1**~~ ปิดแล้วใน v1.7 — กำหนดเป็น FR-1.2.3 และ FR-1.2.4

~~**OI-2**~~ ปิดแล้วใน v1.8 — กำหนดเป็น FR-5.3.10

---

## 10. หมายเหตุสำหรับผู้สอน (ตัดออกก่อนแจกนิสิต)

### 10.1 การเปลี่ยนแปลงจาก SRS-CART-001

| ประเด็น | SRS-CART-001 | SRS-CART-002 | เหตุผล |
|---|---|---|---|
| ขอบเขตผู้ใช้ | single-user | Customer + Admin | ตามโจทย์ term project |
| การเพิ่มสินค้า | `addItem(product)` เพิ่มทีละ 1 | `addItem(productId, quantity)` | สร้างโดเมนตัวเลขให้ ECT/BVA |
| ตัวแปรที่นับ | จำนวนสินค้าในตะกร้า | จำนวนรายการ (line) | quantity แยกเป็นอีกตัวแปร |
| หน้าจอ | หน้าจอของ UI | stage เก็บที่ api-server | ให้ FSM ทดสอบได้ทั้งระดับ service และ E2E |
| หน้าสำเร็จ | สถานะสิ้นสุด (FR-4.5 เดิม) | ออกได้ด้วย `continueShopping` | บัญชีหนึ่งสั่งซื้อได้หลายครั้ง |
| operation ที่ไม่ประมวลผล | ไม่แสดงข้อความ (FR-6.4 เดิม) | ส่งกลับ `OPERATION_NOT_ALLOWED` | api-server ต้องตอบ request ทุกครั้ง ต้องมีผลลัพธ์ที่ทดสอบได้ |

**การเปลี่ยนแปลงจาก SRS-CART-002 v1.0 → v1.1 (ลดขอบเขต Admin)**

| ฟีเจอร์ | v1.0 | v1.1 | เหตุผลที่ตัด / คง |
|---|---|---|---|
| `createProduct` (FR-9.1–9.2 เดิม) | มี | ตัด → seed data | ตัด: เป็นงาน validation ฟอร์มที่เพิ่ม test case จำนวนมาก แต่ไม่เพิ่มเทคนิคใหม่ (ECT/BVA มีจาก quantity น้ำหนัก และ updateProduct แล้ว) |
| `createCoupon` (FR-10.1 เดิม) | มี | ตัด → seed data | ตัด: เหตุผลเดียวกับ createProduct |
| `markShipped` (FR-11.1 เดิม) และสถานะ `จัดส่งแล้ว` | มี | ตัด | ตัด: ไม่มีผลต่อฝั่ง Customer; FSM ของออเดอร์เล็กลง |
| Admin ดูออเดอร์ (FR-0.5 เดิม) | มี | ตัด | ตัด: เหลือจุดประสงค์น้อยเมื่อไม่มี markShipped |
| `updateProduct` | มี | คง (FR-9.1) | คง: เปลี่ยนสต็อกพร้อมขาย (ตัวแปรสถานะ) และราคา (AC-13 snapshot) |
| `setProductStatus` | มี | คง (FR-9.3) | คง: AC-10 ข้าม actor |
| `setCouponStatus` | มี | คง (FR-10.1) | คง: เป็นทางเดียวที่ทำให้ C2 = F ของ Decision Table เกิดได้ (คูปองถูกปิดหลังผูก เพราะ FR-3.1 ปฏิเสธการผูกคูปองที่ปิดอยู่แล้ว) |

**การเปลี่ยนแปลงจาก v1.7 → v1.8:** ปิด OI-2 ตามการตัดสินใจของผู้สอน โดยเพิ่ม FR-5.3.10 (การจองคงอยู่จนกว่าออเดอร์จะชำระแล้วหรือถูกยกเลิก ไม่มีการหมดอายุ) เหตุผล: ทางเลือกอื่น (หมดอายุเมื่อปิดหน้าจอ, ปล่อยการจองเมื่อผู้อื่นต้องการ) ตรวจสอบไม่ได้หรือต้องแก้ FR หลายข้อ และการเว้น OI ไว้ทำให้ระบบที่ AI สร้างมีพฤติกรรมต่างกันในแต่ละกลุ่ม ส่วนที่ 9 เปลี่ยนเป็นกติกาการจัดการจุดที่ spec ไม่ได้กำหนดซึ่งนิสิตพบเอง ข้อจำกัดที่ยอมรับ: ออเดอร์ที่ลูกค้าทิ้งไว้จะกันสต็อกไว้ตลอด

**การเปลี่ยนแปลงจาก v1.6 → v1.7:** ปิด OI-1 ตามการตัดสินใจของผู้สอน โดยเพิ่ม FR-1.2.3 (stage คงอยู่ข้ามการ login) และ FR-1.2.4 (ออเดอร์ที่รอชำระและการจองสต็อกคงอยู่ข้ามการ login) ซึ่งสอดคล้องกับนิยาม stage ในส่วนที่ 2 ที่ระบุว่า api-server เก็บ stage ไว้ต่อ Customer คงเลข OI-2 ไว้เพื่อไม่ให้การอ้างอิงเดิมเปลี่ยน

**การเปลี่ยนแปลงจาก v1.5 → v1.6:** ตรวจ FR ทุกข้อแล้วพบ business logic ที่เป็น pure function ได้แต่ยังไม่มีฟังก์ชันรองรับ จึงเพิ่ม `isProductAvailable`, `calculateTotalWeight`, `calculateNetTotal`, `validateCheckout`, `validateProductUpdate` และเปลี่ยน `checkLineQuantity` เป็น `validateQuantityChange` ที่ครอบคลุมลำดับการตรวจของ FR-2.6 ทั้ง 6 ขั้น (เดิมครอบคลุมเฉพาะขั้น 5–6) ส่วน logic ของ stage (FR-8) ไม่ได้ทำเป็น pure function โดยตั้งใจ เพื่อให้ FSM ยังเป็นงานระดับ service และ E2E ไม่เปลี่ยน FR

**การเปลี่ยนแปลงจาก v1.4 → v1.5:** เปลี่ยนชื่อส่วนที่ 6 เป็น Design Constraints โดยเนื้อหาเดิมเป็น 6.1 (DC-1) และเพิ่ม 6.2 ความสามารถในการทดสอบของ Web UI (DC-2.1–2.13, ตาราง test ID และ URL) กับ 6.3 สภาพแวดล้อมทดสอบ (DC-3.1–3.3) ตามที่ผู้สอนต้องการให้ UI รองรับ E2E automation ไม่เปลี่ยน FR

**การเปลี่ยนแปลงจาก v1.3 → v1.4 (singular requirement):** แยก FR ที่มีหลายเงื่อนไขหรือหลายข้อผูกพันให้เหลือหนึ่งต่อข้อ โดยใช้เลขลำดับชั้น FR-x.y.z และคง FR-x.y เดิมไว้เป็นหัวข้อกลุ่ม เอกสารที่อ้าง FR-x.y จึงยังใช้ได้ (หมายถึงทั้งกลุ่ม) หลักที่ใช้แยก (Claude กำหนด):
1. หนึ่ง requirement = หนึ่งเงื่อนไข → หนึ่งข้อผูกพันที่ตรวจสอบได้
2. error code กับข้อความที่มากับ code นั้นนับเป็นผลลัพธ์เดียว
3. "ข้อมูลไม่เปลี่ยนเมื่อถูกปฏิเสธ" ซึ่งเดิมเขียนซ้ำในหลาย FR ถูกรวมเป็น requirement ทั่วไปข้อเดียว (**FR-0.7 ใหม่**)
4. กฎลำดับการตรวจสอบ ตารางอัตรา สูตรคำนวณ และการแสดงผลของ operation เดียว นับเป็น requirement เดียว
5. ค่าเริ่มต้นของสถานะ (FR-1.1) นับเป็น requirement เดียว

ไม่มีการเปลี่ยนพฤติกรรมของระบบ ยกเว้น FR-0.7 ทำให้ "ข้อมูลไม่เปลี่ยนเมื่อถูกปฏิเสธ" ครอบคลุมทุก error code อย่างชัดเจน (เดิม `ITEM_NOT_IN_CART`/`CART_EMPTY` ของ removeItem, `AUTH_*`, `ORDER_NOT_FOUND` และ `COUPON_NOT_FOUND` ไม่ได้ระบุไว้) และ FR-8.5.1 เปลี่ยนคำจาก "ส่งกลับ" เป็น "ปฏิเสธด้วย" `OPERATION_NOT_ALLOWED` เพื่อให้อยู่ใต้ FR-0.7

**การเปลี่ยนแปลงจาก v1.2 → v1.3:** แยก AC ที่มีการกระทำมากกว่าหนึ่งอย่างให้เหลือ When เดียว — AC-11 → AC-11a/b/c, AC-18 → AC-18a/b, AC-19 → AC-19a/b และเขียน AC-12 ใหม่ให้ไม่ขึ้นกับ AC-11 ไม่มีการเปลี่ยนพฤติกรรมของระบบ (FR คงเดิมทั้งหมด) เลข AC เดิมคงไว้โดยใช้ตัวอักษรกำกับ เพื่อให้เอกสารที่อ้างถึง AC เดิมยังใช้ได้

**การเปลี่ยนแปลงจาก v1.1 → v1.2:** เพิ่ม OP-18 `listCoupons()` (FR-10.2, AC-19) ตามการตัดสินใจของผู้สอน เพื่อให้หน้า Admin มีรายการคูปองให้เปิด/ปิด และให้ตรวจผลของ `setCouponStatus` ได้โดยตรงจากฝั่ง Admin (observability — Aniche หัวข้อ 7.2)

**ข้อเพิ่มเติมใน v1.1:** FR-9.1 กำหนดลำดับการตรวจสอบ (`PRODUCT_NOT_FOUND` ก่อน `VALIDATION_ERROR`) ซึ่ง v1.0 ไม่ได้ระบุ และ FR-9.3 เพิ่มกรณี `PRODUCT_NOT_FOUND` ของ setProductStatus ซึ่ง v1.0 ไม่ได้ระบุ

### 10.2 FR ที่ออกแบบให้รองรับแต่ละเทคนิค

| เทคนิค | FR หลัก | ประเด็นการสอนที่ spec ตั้งใจเปิดให้เห็น | อ้างอิง |
|---|---|---|---|
| ECT | FR-2.1 (quantity: จำนวนเต็มในช่วง / นอกช่วง / ไม่ใช่จำนวนเต็ม), FR-5.1 (zone, speed), FR-9.1 (price, stock ของ updateProduct) | spec กำหนด error code ของ invalid class ไว้ชัด จึงใช้รูปแบบ Robust ได้โดยไม่ติดปัญหาที่ spec ไม่ระบุผลของ invalid input | Jorgensen บท 6 (บทนำ และ 6.3) |
| BVA | FR-2.1/2.4 (1, 10), FR-4.5 (1,000/1,001, 5,000/5,001, 20,000/20,001), FR-4.2 (ยอดรวม = minSpend), FR-9.1 (ราคา 1/50,000, สต็อก 0/9,999) | FR-2.4 มีขอบเขตแบบพึ่งพาตัวแปรอื่น (quantity เดิม + ที่เพิ่ม ≤ min(10, สต็อก)) — เปิดข้อจำกัดของ BVA ที่สมมติให้ตัวแปรอิสระต่อกัน ซึ่งเป็นจุดเชื่อมไปสู่ Decision Table ตามกรอบที่วิชาใช้ | Jorgensen บท 5; Aniche บท 2 |
| Decision Table | FR-4.2–4.4 | 4 เงื่อนไขแบบ limited-entry: 2⁴ = 16 rule ย่อเหลือ 7 rule (ดู 10.3) | Jorgensen บท 7 |
| Pairwise | FR-4.5–4.7 | 4 factor (3 × 3 × 2 × 2 = 36 combination) โดย weightTier × zone เป็นตาราง 2 มิติ และ speed × memberTier ก็มีปฏิสัมพันธ์กัน (prime + express = base × 1/2) ขอบล่างของจำนวน test = 9 (3 × 3) | covertable ตามที่วิชาใช้ |
| FSM | FR-1, 2.7, 2.8, 5–8 (stage × จำนวนรายการ × สถานะออเดอร์), FR-5.3/7.1/9.1/9.3 (สถานะการขาย × สต็อก 0 / ≥1 ของสินค้า), FR-5.3/6/7 (สถานะออเดอร์) | ผลการใช้ feedback loop: สต็อกพร้อมขายเป็นเงื่อนไขใน FR-2.2/5.2 และเป็นผลลัพธ์ของ FR-5.3/7.1/9.1 จึงเป็นตัวแปรสถานะ; คูปองที่ผูกเป็นเงื่อนไขใน FR-4.2 และเป็นผลลัพธ์ของ FR-3.2/4.3/6.1 จึงเป็นตัวแปรสถานะเช่นกัน; memberTier ไม่มี operation ใดเปลี่ยนได้ จึง**ไม่ใช่**ตัวแปรสถานะ | Jorgensen (FSM); หลักการ feedback loop ของวิชา |

**ข้อสังเกตที่ผู้สอนควรตัดสินใจ:** โครงสร้างค่าจัดส่งใน FR-4.5–4.7 ระบุไว้ครบ ตามกรอบของวิชาที่ว่า pairwise เหมาะเมื่อไม่รู้โครงสร้างของ fault ขณะที่ Decision Table + each-used เพียงพอเมื่อรู้โครงสร้างครบแล้ว กรณีนี้จึงเป็นสถานการณ์เดียวกับตัวอย่างค่าจัดส่งในบทที่ 6 คือใช้ pairwise เป็นแบบฝึก ไม่ใช่เพราะจำเป็นต้องใช้ อัตราค่าจัดส่งในตาราง FR-4.6 ถูกกำหนดใหม่ ไม่ได้คัดลอกจาก SRS-SHIPFEE-001

**ความเสี่ยงในการคัดลอก:** FSM ของ Customer ต่อยอดจาก FSM ใน SRS-CART-001 ที่เฉลยในห้องแล้ว แต่ตัวแปรสถานะเปลี่ยนไป (มีคูปองที่ผูก มี `continueShopping` เป็นวงวน) จึงคัดลอกโมเดลเดิมมาใช้ตรงๆ ไม่ได้

### 10.3 เฉลย Decision Table ของ FR-4.2–4.4 (หลังย่อ)

C1 = มีคูปองผูก, C2 = คูปอง `เปิดใช้`, C3 = ยอดรวมสินค้า ≥ minSpend, C4 = memberTier เป็น `prime`

| | R1 | R2 | R3 | R4 | R5 | R6 | R7 |
|---|---|---|---|---|---|---|---|
| C1 | F | F | T | T | T | T | T |
| C2 | — | — | F | F | T | T | T |
| C3 | — | — | — | — | F | F | T |
| C4 | T | F | T | F | T | F | — |
| A1: ส่วนลดคูปอง | | | | | | | X |
| A2: ถอดคูปอง + notice | | | X | X | X | X | |
| A3: ส่วนลดสมาชิก 5% | X | | X | | X | | |
| A4: ไม่มีส่วนลด | | X | | X | | X | |
| จำนวน rule ย่อยที่ครอบคลุม | 4 | 4 | 2 | 2 | 1 | 1 | 2 |

ผลรวม 4 + 4 + 2 + 2 + 1 + 1 + 2 = 16 = 2⁴ ✓ — R3 กับ R5 (และ R4 กับ R6) มี action เหมือนกัน แต่รวมเป็น column เดียวไม่ได้ เพราะเงื่อนไขที่ต่างกันเป็นแบบ "C2 = F **หรือ** C3 = F" ซึ่ง limited-entry หนึ่ง column แสดงไม่ได้

### 10.4 ขอบเขตที่ตัดออก
การประมวลผลพร้อมกันถูกตัดออก (ส่วนที่ 1.3) เพราะกรณีเช่นผู้ใช้สองคนซื้อสินค้าชิ้นเดียวกัน ณ เวลาเดียวกันจนเกิด lost update เป็นประเด็น race condition (Full Stack Testing บท 5 หัวข้อ databases) ซึ่งต้องใช้การทดสอบเฉพาะทาง และเกินขอบเขตของเทคนิคที่ term project ต้องการวัด
