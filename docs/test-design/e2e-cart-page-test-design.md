# E2E Test Case Design — Cart Page (`page-cart`)

| รายการ | รายละเอียด |
| :--- | :--- |
| **อ้างอิงข้อกำหนด** | SRS-CART-002 v1.8 (`SRS-CART-002_v1.8_pubs.md`) |
| **ขอบเขตการทดสอบ** | การทดสอบแบบ End-to-End บนเบราว์เซอร์สำหรับหน้า **รถเข็นสินค้า** (`/cart`) |
| **เครื่องมือทดสอบ** | Playwright (`e2e/cart.spec.ts`) |
| **Design Constraints** | DC-2 (Web UI Testability & Automation Contract) |

---

## 1. ภาพรวม Scenarios ที่คัดเลือก (Selected Scenarios)

ชุดการทดสอบนี้คัดเลือกมาจาก User Journey สำคัญที่ผู้ใช้มีปฏิสัมพันธ์กับหน้ารถเข็น แบ่งออกเป็น 6 Scenarios หลัก:

1. **`E2E-CART-1` (Initial Empty Cart & Disabled Checkout):** ตรวจสอบสถานะเริ่มต้นเมื่อตะกร้าว่าง, การผูกคูปองขณะตะกร้าว่าง และการล็อกปุ่มชำระเงิน
2. **`E2E-CART-2` (Update Quantity & Real-Time Calculation):** ปรับจำนวนสินค้าด้วยปุ่ม `+`/`-` และช่องกรอกตัวเลขโดยตรง พร้อมคำนวณยอดรวมทันที
3. **`E2E-CART-3` (Remove Items & Empty State Transition):** การลบสินค้าออกจากตะกร้า และการเปลี่ยนผ่านสู่สภาวะตะกร้าว่าง
4. **`E2E-CART-4` (Coupon Validation & Case-Sensitivity):** การผูกคูปองที่ถูกต้อง และการปฏิเสธโค้ดที่ผิด/ตัวพิมพ์เล็กโดยคูปองเดิมไม่หลุด
5. **`E2E-CART-5` (Admin Live Changes: Price & OffSale):** การสะท้อนข้อมูลสดในรถเข็นเมื่อแอดมินแก้ไขราคาหรือปิดการขายสินค้า
6. **`E2E-CART-6` (Delivery Selection, Re-login & Checkout):** การเลือกจัดส่ง, ความคงอยู่ของข้อมูลข้ามเซสชัน Re-login และการเข้าสู่หน้าชำระเงิน

---

## 2. ตารางกรณีทดสอบรวม (Unified Test Case Table)

| TC-ID | Scenario ID | Test Case | Precondition | Input | Expected Output |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **TC-01** | **`E2E-CART-1`** | ตะกร้าว่างเริ่มต้น และปุ่มชำระเงินถูกปิดใช้งาน | ลูกค้า `cus_normal` เข้าสู่ระบบ, ยังไม่มีสินค้าในตะกร้า | เปิดไปที่ URL `/cart` | • แสดงข้อความ `"ยังไม่มีสินค้าในรถเข็น"`<br>• `cart-subtotal` มี `data-value="0"`<br>• `cart-coupon-code` แสดง `"ยังไม่ได้ใช้คูปอง"`<br>• **ปุ่ม `checkout-button` มี attribute `disabled`** |
| **TC-02** | **`E2E-CART-1`** | ผูกคูปองส่วนลดขณะที่ตะกร้ายังว่างเปล่า | ลูกค้าเปิดหน้า `/cart` (ตะกร้าว่าง) | 1. พิมพ์ `"SAVE10"` ใน `coupon-input`<br>2. คลิกปุ่ม `coupon-apply` | • `cart-coupon-code` แสดงข้อความ `"SAVE10"` สำเร็จ<br>• **ปุ่ม `checkout-button` ยังคงมี attribute `disabled`** |
| **TC-03** | **`E2E-CART-2`** | เพิ่มจำนวนสินค้าด้วยปุ่ม `+` | ตะกร้ามี P1 (450 บ.) 1 ชิ้น, เปิดหน้า `/cart` | คลิกปุ่ม `+` (`aria-label="เพิ่มจำนวน"`) ในแถว P1 | • `cart-line-qty` ของ P1 มี `data-value="2"`<br>• ยอดรวมแถว P1 แสดง `"900 บาท"`<br>• `cart-subtotal` อัปเดตยอดรวมใหม่เป็น `data-value="900"` |
| **TC-04** | **`E2E-CART-2`** | ลดจำนวนสินค้าด้วยปุ่ม `-` จนถึงขั้นต่ำ (1 ชิ้น) | แถว P1 มีจำนวน 2 ชิ้น ในหน้า `/cart` | คลิกปุ่ม `-` (`aria-label="ลดจำนวน"`) ในแถว P1 | • `cart-line-qty` ของ P1 ลดเหลือ `data-value="1"`<br>• `cart-subtotal` ปรับเป็น `data-value="450"`<br>• **ปุ่ม `-` เปลี่ยนสถานะเป็น `disabled` (ไม่ลดเป็น 0)** |
| **TC-05** | **`E2E-CART-2`** | กรอกจำนวนโดยตรงผ่านช่อง Input แล้วกดอัปเดต | ตะกร้ามี P2 (1,200 บ. สต็อก 3) 1 ชิ้น | 1. พิมพ์ `"3"` ใน `cart-line-qty-input` (P2)<br>2. คลิกปุ่ม `cart-line-update` | • `cart-line-qty` ของ P2 มี `data-value="3"`<br>• ยอดรวม P2 แสดง `"3,600 บาท"`<br>• `cart-subtotal` อัปเดตยอดรวมเพิ่มขึ้นถูกต้อง |
| **TC-06** | **`E2E-CART-2`** | กรอกจำนวนสินค้าเกินสต็อกคงเหลือ | ตะกร้ามี P2 (มีสต็อกคงเหลือจริง 3 ชิ้น) | 1. พิมพ์ `"4"` ใน `cart-line-qty-input` (P2)<br>2. คลิกปุ่ม `cart-line-update` | • ขึ้นแบนเนอร์แจ้งเตือน `app-message`<br>• มี `data-kind="error"` และ `data-code="INSUFFICIENT_STOCK"`<br>• จำนวน P2 ไม่เปลี่ยน (ยังคงเป็น 3 ชิ้นเดิม) |
| **TC-07** | **`E2E-CART-4`** | ผูกคูปองส่วนลดที่ถูกต้อง (`SAVE10`) | ตะกร้ามีสินค้า, คูปองยังไม่ได้ใช้ | 1. พิมพ์ `"SAVE10"` ใน `coupon-input`<br>2. คลิกปุ่ม `coupon-apply` | • `cart-coupon-code` แสดงข้อความ `"SAVE10"`<br>• ช่องกรอก `coupon-input` เคลียร์เป็นค่าว่าง<br>• ไม่ขึ้น Error ใดๆ |
| **TC-08** | **`E2E-CART-4`** | กรอกคูปองตัวพิมพ์เล็ก (Case-Sensitive) | อยู่หน้า `/cart`, ยังไม่ได้ผูกคูปอง | 1. พิมพ์ `"save10"` ใน `coupon-input`<br>2. คลิกปุ่ม `coupon-apply` | • ขึ้นแบนเนอร์ `app-message` แจ้งเตือน Error<br>• มี `data-kind="error"` และ `data-code="COUPON_INVALID"`<br>• คูปองไม่ถูกผูกเข้ากับตะกร้า |
| **TC-09** | **`E2E-CART-4`** | กรอกโค้ดคูปองที่ไม่มีในระบบ | อยู่หน้า `/cart` | 1. พิมพ์ `"NOPE"` ใน `coupon-input`<br>2. คลิกปุ่ม `coupon-apply` | • ขึ้นแบนเนอร์ `app-message` แจ้งเตือน Error<br>• มี `data-kind="error"` และ `data-code="COUPON_INVALID"` |
| **TC-10** | **`E2E-CART-4`** | คูปองเดิมต้องไม่หลุดเมื่อกรอกโค้ดใหม่ผิดพลาด | มีคูปอง `"SAVE10"` ผูกอยู่สำเร็จแล้ว | 1. พิมพ์ `"INVALID"` ใน `coupon-input`<br>2. คลิกปุ่ม `coupon-apply` | • ขึ้นแบนเนอร์ Error `COUPON_INVALID`<br>• **`cart-coupon-code` ยังคงแสดงเป็น `"SAVE10"` เหมือนเดิม** |
| **TC-11** | **`E2E-CART-3`** | ลบสินค้า 1 รายการเมื่อในตะกร้ามีหลายสินค้า | ตะกร้ามี P1 และ P2 รวม 2 รายการ | คลิกปุ่ม `"นำออก"` (`cart-line-remove`) ในแถว P1 | • แถว `cart-line-P1` หายไปจากหน้าจอทันที<br>• แถว P2 ยังคงอยู่ปกติ<br>• `cart-subtotal` ลดลงเหลือเฉพาะราคาของ P2<br>• **ปุ่ม `checkout-button` ยังคง `toBeEnabled()`** |
| **TC-12** | **`E2E-CART-5`** | ลบสินค้าที่แอดมินปิดการขาย (`offSale`) ออกจากตะกร้า | สินค้า P1 ถูกแอดมินปิดขาย (`data-available="false"`) | คลิกปุ่ม `"นำออก"` (`cart-line-remove`) ในแถว P1 | • แถว P1 ถูกลบออกจากหน้าจอสำเร็จ<br>• ป้ายเตือนสินค้าหมดสีแดงหายไปจากหน้าจอ |
| **TC-13** | **`E2E-CART-3`** | ลบสินค้าชิ้นสุดท้ายจนตะกร้าว่าง | ในตะกร้าเหลือสินค้าเพียง 1 รายการสุดท้าย | คลิกปุ่ม `"นำออก"` (`cart-line-remove`) ของรายการสุดท้าย | • แสดงข้อความ `"ยังไม่มีสินค้าในรถเข็น"`<br>• `app-message` แสดงข้อความ Info ว่า `"ตะกร้าว่าง"`<br>• `cart-subtotal` ปรับเป็น `data-value="0"`<br>• **ปุ่ม `checkout-button` เปลี่ยนเป็น `disabled` ทันที** |
| **TC-14** | **`E2E-CART-6`** | เลือกพื้นที่จัดส่งและรูปแบบความเร็วการจัดส่ง | ตะกร้ามีสินค้า $\ge 1$ รายการ, อยู่หน้า `/cart` | 1. เลือก `zone-select` เป็น `"ต่างจังหวัด"`<br>2. เลือก `speed-select` เป็น `"ด่วน"` | • Dropdown `zone-select` มีค่าเป็น `"upcountry"`<br>• Dropdown `speed-select` มีค่าเป็น `"express"` |
| **TC-15** | **`E2E-CART-6`** | ข้อมูลสินค้าและคูปองคงอยู่ข้ามการ Re-login | ลูกค้ามี P1 และคูปอง `SAVE10` ในตะกร้า | 1. คลิก Logout<br>2. Login บัญชีเดิมกลับเข้ามา<br>3. คลิกเมนู `nav-cart` | • แถวสินค้า `cart-line-P1` ยังคงแสดงอยู่ครบถ้วน<br>• `cart-coupon-code` ยังคงแสดงรหัส `"SAVE10"` |
| **TC-16** | **`E2E-CART-6`** | กดปุ่มดำเนินการชำระเงินเพื่อไปหน้า Checkout | ตะกร้ามีสินค้าพร้อมขาย, ปุ่ม Checkout เปิดอยู่ | คลิกปุ่ม `"ดำเนินการชำระเงิน"` (`checkout-button`) | • เบราว์เซอร์ Navigate ไปยัง URL `/checkout`<br>• Element `page-checkout` แสดงผลบนหน้าจอ<br>• Element `checkout-order-id` แสดงเลขที่คำสั่งซื้อ |

---

## 3. รายละเอียด Test Locators และ Automation Attributes (DC-2)

| Element บนหน้าจอ | Playwright Locator / Selector | สิ่งที่ใช้ตรวจสอบ (Assertion) |
| :--- | :--- | :--- |
| กรอบหน้า Cart | `page.getByTestId('page-cart')` | `toBeVisible()` |
| แถวสินค้าตาม ID | `page.getByTestId('cart-line-P1')` | `toBeVisible()` / `toBeHidden()` |
| ชื่อสินค้า | `row.getByTestId('cart-line-name')` | ข้อความชื่อสินค้า |
| ราคาต่อชิ้น | `row.getByTestId('cart-line-unit-price')` | `toHaveAttribute('data-value', '450')` |
| จำนวนชิ้นปัจจุบัน | `row.getByTestId('cart-line-qty')` | `toHaveAttribute('data-value', '2')` |
| สถานะความพร้อม | `row.getByTestId('cart-line-availability')` | `toHaveAttribute('data-available', 'true' / 'false')` |
| ช่องพิมพ์จำนวน | `row.getByTestId('cart-line-qty-input')` | `.fill('3')` |
| ปุ่มอัปเดตจำนวน | `row.getByTestId('cart-line-update')` | `.click()` |
| ปุ่มนำสินค้าออก | `row.getByTestId('cart-line-remove')` | `.click()` |
| ยอดรวมสินค้า | `page.getByTestId('cart-subtotal')` | `toHaveAttribute('data-value', '900')` |
| โค้ดคูปองที่ผูก | `page.getByTestId('cart-coupon-code')` | `toHaveText('SAVE10')` |
| ช่องกรอกคูปอง | `page.getByTestId('coupon-input')` | `.fill('SAVE10')` |
| ปุ่มใช้คูปอง | `page.getByTestId('coupon-apply')` | `.click()` |
| Dropdown พื้นที่จัดส่ง | `page.getByTestId('zone-select')` | `.selectOption('upcountry')` |
| Dropdown ความเร็วจัดส่ง | `page.getByTestId('speed-select')` | `.selectOption('express')` |
| ปุ่มชำระเงิน | `page.getByTestId('checkout-button')` | `toBeEnabled()` / `toBeDisabled()` |
| กล่องข้อความแจ้งเตือน | `page.getByTestId('app-message')` | `toHaveAttribute('data-code', 'COUPON_INVALID')` / `toContainText('ตะกร้าว่าง')` |

---

## 4. Requirement Traceability Matrix (RTM)

| รหัสข้อกำหนด (SRS) | คำอธิบายโดยย่อ | Test Cases ที่ครอบคลุม |
| :--- | :--- | :--- |
| **`FR-1.1`** | สถานะเริ่มต้นเมื่อตะกร้าว่างและปุ่มปิดใช้งาน | `TC-01` |
| **`FR-1.2.1, FR-1.2.2`** | รายการสินค้าและคูปองคงอยู่ข้ามการ Re-login | `TC-15` |
| **`FR-2.5.2, FR-2.5.6`** | แก้ไขจำนวนสินค้า, การแทนที่ค่าเดิม และช่วง 1–10 | `TC-03`, `TC-04`, `TC-05` |
| **`FR-2.5.5`** | ปฏิเสธการแก้จำนวนเมื่อเกินสต็อก (`INSUFFICIENT_STOCK`) | `TC-06` |
| **`FR-2.7.3`** | ลบสินค้าทั้งรายการออกจากตะกร้า | `TC-11`, `TC-12` |
| **`FR-2.7.4`** | แสดงข้อความ info `"ตะกร้าว่าง"` เมื่อลบรายการสุดท้าย | `TC-13` |
| **`FR-2.8`** | ปุ่มชำระเงินเปิดใช้งานเมื่อ `lineCount ≥ 1` และ stage ตะกร้า | `TC-01`, `TC-02`, `TC-11`, `TC-13`, `TC-16` |
| **`FR-2.9`** | แสดงรายละเอียดสินค้า ราคาปัจจุบัน และคูปองที่ผูก | `TC-01`, `TC-03`, `TC-07` |
| **`FR-3.1.1`** | ตรวจสอบโค้ดคูปองแบบ Case-Sensitive | `TC-08` |
| **`FR-3.1.2`** | ปฏิเสธโค้ดที่ไม่มีในระบบ (`COUPON_INVALID`) | `TC-09` |
| **`FR-3.2.1`** | ผูกคูปองที่เปิดใช้เข้ากับตะกร้า | `TC-07` |
| **`FR-3.2.3`** | อนุญาตให้ผูกคูปองขณะตะกร้าว่าง | `TC-02` |
| **`FR-9.2.1`** | ราคาใหม่ที่แอดมินแก้ไขสะท้อนในตะกร้าทันที | `TC-03` |
| **`FR-9.3.4`** | สินค้าที่ปิดขายยังอยู่ในตะกร้าและระบุว่าไม่พร้อมขาย | `TC-12` |

