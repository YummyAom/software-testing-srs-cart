# E2E Test Case Design: Checkout และ Order detail

| รายการ | รายละเอียด |
| :--- | :--- |
| **อ้างอิงข้อกำหนด** | `SRS-CART-002_v1.8_pubs.md` §8 Acceptance Criteria, FR-1, FR-2, FR-5, FR-6, FR-7, FR-9, §6.2 DC-2 |
| **ไฟล์เทสต์** | `e2e/checkout.spec.ts`, `e2e/order-detail.spec.ts` |
| **ข้อมูลตั้งต้น** | SRS §7: P1 ราคา 450 สต็อก 20, P2 ราคา 1,200 สต็อก 3 และทุกเทสต์เรียก `/test/reset` ก่อนเริ่ม |

วิธีออกแบบ: 1 เทสต์ทดสอบ 1 AC โดยไล่ตาม Given, When, Then ใน SRS และทุกข้อใน Then ต้องมีการเช็คอย่างน้อย 1 จุด

## สรุปการครอบคลุม

| AC | E2E | ไฟล์ | Then ใน SRS | สถานะ |
| :--- | :--- | :--- | :--- | :--- |
| AC-11a | E2E-1 | `checkout.spec.ts` | 3 ข้อ | ครบ |
| AC-12 | E2E-2 | `checkout.spec.ts` | 4 ข้อ | ครบ |
| AC-13 | E2E-3 | `order-detail.spec.ts` | 2 ข้อ | ครบ |
| AC-15 | E2E-4 | `order-detail.spec.ts` | 1 ข้อ | ครบ |
| AC-18a | E2E-5 | `checkout.spec.ts` | 3 ข้อ | บางส่วน: เช็คแค่ stage ส่วนที่เหลือเป็นงานของเพื่อนใน `E2E-SUCCESS-1` |

## E2E เดิมถูกแตกอย่างไร

| เดิม | ใหม่ |
| :--- | :--- |
| E2E-1 (AC-11a, FR-6.2, AC-12, AC-18a) | E2E-1 (AC-11a), E2E-2 (AC-12), E2E-5 (AC-18a) |
| E2E-2 (AC-15, AC-13) | E2E-3 (AC-13), E2E-4 (AC-15) |
| E2E-3 (DC-2.13) | ตัดออก เพราะไม่ได้ครอบ AC |

ส่วนที่ตัดออกจาก E2E เดิม:

- **จ่ายไม่สำเร็จ (FR-6.2):** ไม่ได้ครอบ AC และ API `OP11-A1` เช็ค stage, ออเดอร์, การจองสต็อก และข้อความใน response แล้ว
- **เปิด `/checkout` ตอนอยู่ stage ตะกร้า (DC-2.13):** ไม่ได้ครอบ AC และ `E2E-SUCCESS-2`, `E2E-GUARD-1` ยังทดสอบ DC-2.13 ในกรณีอื่น
- **ยกเลิกแล้ว checkout ใหม่:** เดิมเป็นหลักฐานทางอ้อมว่าสต็อกคืนแล้ว ตอนนี้ E2E-2 เช็คสต็อกโดยตรง

---

## **E2E-1: checkout สร้างออเดอร์และจองสต็อก (AC-11a)**

`e2e/checkout.spec.ts`

**อ้างอิง:** AC-11a (FR-5.3.2, FR-5.3.7, FR-5.3.8), FR-1.3.1

- **Given:** `cus_normal` อยู่ stage `ตะกร้า` และตะกร้ามี P2 × 3 (สต็อกพร้อมขายของ P2 = 3)
- **When:** `pressCheckout(inCity, standard)`
- **Then:** ออเดอร์สถานะ `รอชำระเงิน`, อยู่ stage `ชำระเงิน`, สต็อกพร้อมขายของ P2 = 0

**ขั้นตอน**

- login `cus_normal` แล้วรอให้หน้าสินค้าโหลดเสร็จ
    - เช็คว่า `product-stock` ของ P2 = 3
- เพิ่ม P2 × 3 แล้วไปหน้าตะกร้า
    - เช็คว่า `cart-line-qty` ของ P2 = 3
    - เช็คว่า `zone-select` = `inCity` และ `speed-select` = `standard`
- กดชำระเงิน (`checkout-button`)
    - เช็คว่าเห็น `page-checkout` และ `checkout-order-id` (stage `ชำระเงิน`)
    - เช็คว่า `checkout-order-status` มี `data-status` = `pending` (ออเดอร์ `รอชำระเงิน`)
- ไปหน้าสินค้า
    - รอให้เห็น P1 ก่อน แล้วเช็คว่า `product-row-P2` มี 0 แถว (สต็อก P2 = 0)

หน้าลูกค้าแสดงเฉพาะสินค้าพร้อมขาย (FR-1.3.1) จึงเห็นเลข 0 ตรง ๆ ไม่ได้ ต้องเช็คจากการที่ P2 หายไปจากรายการ

## **E2E-2: ยกเลิกการชำระเงิน (AC-12)**

`e2e/checkout.spec.ts`

**อ้างอิง:** AC-12 (FR-7.1.1, FR-7.1.2, FR-7.1.3), DC-2.9

- **Given:** `cus_normal` อยู่ stage `ชำระเงิน` กับออเดอร์ `รอชำระเงิน` ที่มี P2 × 3, ตะกร้ามี P2 × 3 และสต็อก P2 = 0
- **When:** `cancelCheckout()`
- **Then:** ออเดอร์สถานะ `ยกเลิก`, สต็อก P2 = 3, อยู่ stage `ตะกร้า` และตะกร้ามี P2 × 3

**ขั้นตอน**

- login `cus_normal` เพิ่ม P2 × 3 แล้วกดชำระเงิน แล้วเก็บ `orderId` ไว้
    - เช็คว่า `checkout-order-status` มี `data-status` = `pending`
- ไปหน้าสินค้า
    - เช็คว่า `product-row-P2` มี 0 แถว (ยืนยันว่าสต็อกเริ่มจาก 0)
- กลับหน้า checkout แล้วกดยกเลิก (`cancel-checkout-button`)
    - เช็คว่าเห็น `page-cart` และ `cart-line-qty` ของ P2 = 3
- ไปหน้าสินค้า
    - เช็คว่า `product-stock` ของ P2 = 3
- ไปหน้าคำสั่งซื้อ
    - เช็คว่า `order-status` ของ `orderId` มี `data-status` = `cancelled`

## **E2E-3: แก้ราคาแล้วมีผลกับตะกร้าแต่ไม่มีผลกับออเดอร์ (AC-13)**

`e2e/order-detail.spec.ts`

**อ้างอิง:** AC-13 (FR-5.3.6, FR-9.2.1, FR-9.2.2), FR-2.9

- **Given:** `cus_normal` มีออเดอร์ `รอชำระเงิน` ที่มี P1 ราคา 450
- **When:** `admin01` เรียก `updateProduct(P1, price = 500)`
- **Then:** `viewOrder` ยังแสดง P1 = 450 และ `viewCart` ของ Customer ที่มี P1 ในตะกร้าแสดง 500

**ขั้นตอน**

- login `cus_prime` เพิ่ม P1 แล้วไปหน้าตะกร้า
    - เช็คว่า `cart-line-unit-price` ของ P1 = 450
- logout แล้ว login `cus_normal` เพิ่ม P1 แล้วกดชำระเงิน แล้วเก็บ `orderId` ไว้
    - เช็คว่า `checkout-order-status` มี `data-status` = `pending`
- logout แล้ว login `admin01` รอให้หน้าโหลดเสร็จ แก้ราคา P1 เป็น 500 แล้วกดบันทึก
    - เช็คว่าบันทึกได้ 200 และ `admin-product-price` ของ P1 = 500
- logout แล้ว login `cus_prime` ไปหน้าตะกร้า
    - เช็คว่า `cart-line-unit-price` ของ P1 = 500
- logout แล้ว login `cus_normal` เปิด `/orders/{orderId}`
    - เช็คว่าเห็น `page-order-detail` และ `order-line-unit-price` ของ P1 = 450

`cus_prime` ต้องเพิ่ม P1 **ก่อน** แอดมินแก้ราคา ถ้าเพิ่มทีหลัง ระบบที่จำราคาตอนเพิ่มลงตะกร้าผิดก็ยังแสดง 500 และเคสนี้จะจับบั๊กไม่ได้

## **E2E-4: คนอื่นดูออเดอร์ไม่ได้ (AC-15)**

`e2e/order-detail.spec.ts`

**อ้างอิง:** AC-15 (FR-0.5.2)

- **Given:** `cus_normal` มีออเดอร์ที่มี orderId = X
- **When:** `cus_prime` เรียก `viewOrder(X)`
- **Then:** ปฏิเสธด้วย `ORDER_NOT_FOUND`

**ขั้นตอน**

- login `cus_normal` เพิ่ม P1 แล้วกดชำระเงิน แล้วเก็บ `orderId` ไว้
- logout แล้ว login `cus_prime` รอให้ login เสร็จ แล้วเปิด `/orders/{orderId}`
    - เช็คว่า `app-message` มี `data-code` = `ORDER_NOT_FOUND`
    - เช็คว่า `order-detail-id` มี 0 แถว (ไม่แสดงข้อมูลออเดอร์)

## **E2E-5: จ่ายสำเร็จ (AC-18a บางส่วน)**

`e2e/checkout.spec.ts`

**อ้างอิง:** AC-18a (FR-6.1.3)

- login `cus_normal` เพิ่ม P2 × 3 แล้วกดชำระเงิน
- กดจ่ายสำเร็จ (`gateway-pay-success`)
    - เช็คว่าเห็น `page-success` (stage `สำเร็จ`)

เก็บการเช็คเดิมไว้เท่านั้น สถานะ `ชำระเงินแล้ว`, ตะกร้าว่าง และการล้างคูปองไม่ได้ทำในไฟล์นี้

---

## วิธีรอหน้าเว็บที่ใช้ในเทสต์

| จุด | เหตุผล |
| :--- | :--- |
| `goto` หน้านั้นซ้ำแล้วรอ `networkidle` ก่อนกรอกค่า | รายการสินค้าโหลดหลายรอบ และการโหลดจะล้างค่าที่เพิ่งกรอก |
| รอคำตอบของ `POST /cart/items` หลังกดเพิ่ม | หน้าเว็บไม่แสดงข้อความเมื่อเพิ่มสำเร็จ |
| รอเห็น P1 ก่อนเช็คว่า P2 มี 0 แถว | กันการเช็คผ่านทั้งที่รายการยังโหลดไม่เสร็จ |
