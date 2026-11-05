# E2E Test Case Design — Admin Products Page (`page-admin-products`)

| รายการ | รายละเอียด |
| :--- | :--- |
| **อ้างอิงข้อกำหนด** | SRS-CART-002 v1.8 (`SRS-CART-002_v1.8_pubs.md`) — FR-0.2, FR-0.3.2, FR-0.7, FR-1.3, FR-9, AC-10, AC-13, AC-14, AC-16 |
| **ขอบเขตการทดสอบ** | การทดสอบแบบ End-to-End บนเบราว์เซอร์สำหรับหน้า **จัดการสินค้า** ของ Admin (`/admin/products`) รวมถึงผลข้ามบทบาทที่ Customer มองเห็น |
| **เครื่องมือทดสอบ** | Playwright (`e2e/admin-products.spec.ts`) |
| **Design Constraints** | DC-2 (Web UI Testability & Automation Contract) — ตาราง 6.2.1 แถว `page-admin-products`, DC-2.7 (`data-value`), DC-2.8 (`app-message`), DC-2.9 (`data-status`), DC-2.12 (เข้าถึงด้วย URL) |
| **ข้อมูลตั้งต้น** | หลัง `/test/reset` (SRS ส่วนที่ 7): P1 Coffee Beans 250g 450 บ. สต็อก 20, P2 Drip Kettle 1,200 บ. สต็อก 3, P3 Espresso Machine 15,000 บ. สต็อก 5 — ทุกตัว `onSale` |

---

## 1. ภาพรวม Scenarios ที่คัดเลือก (Selected Scenarios)

ชุดการทดสอบนี้คัดเลือกจาก User Journey ของ Admin บนหน้าจัดการสินค้า และผลกระทบที่ Customer ต้องเห็นตาม FR-9 แบ่งออกเป็น 6 Scenarios หลัก:

1. **`E2E-ADMIN-1` (Initial Product List & Display Contract):** Admin login แล้วเห็นสินค้าทั้งหมดพร้อมราคา สต็อก สถานะ และช่องแก้ไขที่กรอกค่าปัจจุบันไว้
2. **`E2E-ADMIN-2` (Update Price & Stock — Valid Classes / Boundaries):** แก้ราคาและสต็อกด้วยค่าที่ถูกต้อง รวมค่าขอบล่างและขอบบน (BVA)
3. **`E2E-ADMIN-3` (Update Validation — Invalid Classes):** ปฏิเสธราคาหรือสต็อกที่อยู่นอกช่วงหรือไม่ใช่จำนวนเต็มด้วย `VALIDATION_ERROR` และข้อมูลสินค้าต้องไม่เปลี่ยน (FR-0.7)
4. **`E2E-ADMIN-4` (Toggle Sale Status):** เปิด/ปิดการขาย และสถานะคงอยู่หลังโหลดหน้าใหม่
5. **`E2E-ADMIN-5` (Cross-Actor Effects on Customer):** ผลของราคาใหม่ สต็อกใหม่ และการปิดขาย ต่อหน้าสินค้า ตะกร้า และออเดอร์ของ Customer
6. **`E2E-ADMIN-6` (Access Control):** Customer และผู้ที่ไม่ได้ login ต้องแก้ไขสินค้าไม่ได้

---

## 2. ตารางกรณีทดสอบรวม (Unified Test Case Table)

| TC-ID | Scenario ID | Test Case | Precondition | Input | Expected Output |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **TC-01** | **`E2E-ADMIN-1`** | Admin login แล้วเข้าหน้าจัดการสินค้า และเห็นสินค้าทั้งหมด | ข้อมูล seed, ยังไม่ login | login ด้วย `admin01` | • เบราว์เซอร์ไปที่ `/admin/products` และเห็น `page-admin-products`<br>• มีแถว `admin-product-row-P1`, `-P2`, `-P3` ครบ 3 แถว<br>• เมนู `nav-admin-products` และ `nav-admin-coupons` แสดงอยู่ และไม่มี `nav-cart` |
| **TC-02** | **`E2E-ADMIN-1`** | ราคา สต็อก และสถานะแสดงตาม contract (DC-2.7, DC-2.9) | อยู่หน้า `/admin/products` | — | • P1: `admin-product-price` `data-value="450"`, `admin-product-stock` `data-value="20"`, `admin-product-status` `data-status="onSale"`<br>• P2: `1200` / `3` / `onSale`<br>• P3: `15000` / `5` / `onSale` |
| **TC-03** | **`E2E-ADMIN-1`** | ช่องแก้ไขกรอกค่าปัจจุบันไว้ให้ | อยู่หน้า `/admin/products` | — | • `admin-product-price-input` ของ P1 มีค่า `450`<br>• `admin-product-stock-input` ของ P1 มีค่า `20` |
| **TC-04** | **`E2E-ADMIN-1`** | เปิด URL `/admin/products` โดยตรงหลัง login (DC-2.12) | login `admin01` แล้ว อยู่หน้าอื่น | เปิด URL `/admin/products` | • เห็น `page-admin-products` และแถวสินค้าครบ 3 แถว |
| **TC-05** | **`E2E-ADMIN-2`** | แก้ราคาและสต็อกด้วยค่าปกติ (FR-9.1.2) | P1 ราคา 450 สต็อก 20 | 1. กรอก `500` ใน `admin-product-price-input` (P1)<br>2. กรอก `15` ใน `admin-product-stock-input` (P1)<br>3. คลิก `admin-product-save` | • `admin-product-price` ของ P1 `data-value="500"`<br>• `admin-product-stock` ของ P1 `data-value="15"`<br>• ไม่มี `app-message` แบบ error<br>• P2, P3 ไม่เปลี่ยน |
| **TC-06** | **`E2E-ADMIN-2`** | ค่าขอบล่างที่ยอมรับ: ราคา 1, สต็อก 0 (BVA) | P1 ราคา 450 สต็อก 20 | กรอกราคา `1` สต็อก `0` แล้วคลิก `admin-product-save` | • P1 `data-value` ราคา `1` สต็อก `0`<br>• ไม่มี `app-message` แบบ error |
| **TC-07** | **`E2E-ADMIN-2`** | ค่าขอบบนที่ยอมรับ: ราคา 50,000, สต็อก 9,999 (BVA) | P1 ราคา 450 สต็อก 20 | กรอกราคา `50000` สต็อก `9999` แล้วคลิก `admin-product-save` | • P1 `data-value` ราคา `50000` สต็อก `9999`<br>• ไม่มี `app-message` แบบ error |
| **TC-08** | **`E2E-ADMIN-2`** | ค่าที่บันทึกแล้วคงอยู่หลังโหลดหน้าใหม่ | บันทึก P1 ราคา 500 สต็อก 15 แล้ว (TC-05) | reload หน้า `/admin/products` | • P1 ราคา `data-value="500"` สต็อก `data-value="15"` |
| **TC-09** | **`E2E-ADMIN-3`** | ราคาต่ำกว่าขอบล่าง (ราคา 0) | P1 ราคา 450 สต็อก 20 | กรอกราคา `0` (สต็อกคง `20`) แล้วคลิก `admin-product-save` | • `app-message` `data-kind="error"` `data-code="VALIDATION_ERROR"`<br>• P1 ราคายัง `data-value="450"` สต็อก `20` (FR-0.7) |
| **TC-10** | **`E2E-ADMIN-3`** | ราคาเกินขอบบน (ราคา 50,001) | P1 ราคา 450 สต็อก 20 | กรอกราคา `50001` แล้วคลิก `admin-product-save` | • `app-message` `data-code="VALIDATION_ERROR"`<br>• P1 ราคายัง `450` |
| **TC-11** | **`E2E-ADMIN-3`** | สต็อกต่ำกว่าขอบล่าง (สต็อก -1) | P1 ราคา 450 สต็อก 20 | กรอกสต็อก `-1` แล้วคลิก `admin-product-save` | • `app-message` `data-code="VALIDATION_ERROR"`<br>• P1 สต็อกยัง `20` |
| **TC-12** | **`E2E-ADMIN-3`** | สต็อกเกินขอบบน (สต็อก 10,000) | P1 ราคา 450 สต็อก 20 | กรอกสต็อก `10000` แล้วคลิก `admin-product-save` | • `app-message` `data-code="VALIDATION_ERROR"`<br>• P1 สต็อกยัง `20` |
| **TC-13** | **`E2E-ADMIN-3`** | ราคาและสต็อกผิดพร้อมกัน (AC-16) | P1 ราคา 450 สต็อก 20 | กรอกราคา `0` สต็อก `10000` แล้วคลิก `admin-product-save` | • `app-message` `data-code="VALIDATION_ERROR"`<br>• P1 ราคายัง `450` สต็อกยัง `20` |
| **TC-14** | **`E2E-ADMIN-3`** | ราคาไม่ใช่จำนวนเต็ม (ECT) | P1 ราคา 450 สต็อก 20 | กรอกราคา `1.5` แล้วคลิก `admin-product-save` | • `app-message` `data-code="VALIDATION_ERROR"`<br>• P1 ราคายัง `450` |
| **TC-15** | **`E2E-ADMIN-4`** | ปิดการขายสินค้า (FR-9.3.2) | P1 `onSale` | คลิก `admin-product-toggle-status` ของ P1 | • `admin-product-status` ของ P1 `data-status="offSale"` แสดง `"ปิดจำหน่าย"`<br>• ปุ่ม toggle เปลี่ยนข้อความเป็น `"เปิดขาย"`<br>• P2, P3 ยัง `onSale` |
| **TC-16** | **`E2E-ADMIN-4`** | สถานะคงอยู่หลังโหลดหน้าใหม่ | P1 `offSale` (TC-15) | reload หน้า `/admin/products` | • P1 ยัง `data-status="offSale"` |
| **TC-17** | **`E2E-ADMIN-4`** | เปิดการขายกลับ (FR-9.3.2) | P1 `offSale` | คลิก `admin-product-toggle-status` ของ P1 | • P1 `data-status="onSale"` แสดง `"วางจำหน่าย"`<br>• ปุ่มเปลี่ยนข้อความเป็น `"ปิดขาย"` |
| **TC-18** | **`E2E-ADMIN-5`** | ราคาใหม่มีผลกับตะกร้าของ Customer ทันที (FR-9.2.1, AC-13) | ตะกร้าของ `cus_normal` มี P1 × 1 | admin01 แก้ราคา P1 เป็น `500` แล้ว cus_normal เปิด `/cart` ใหม่ | • `cart-line-P1` › `cart-line-unit-price` `data-value="500"`<br>• `cart-subtotal` `data-value="500"` |
| **TC-19** | **`E2E-ADMIN-5`** | ราคาใหม่ไม่มีผลกับออเดอร์ที่สร้างแล้ว (FR-9.2.2, AC-13) | `cus_normal` มีออเดอร์ `รอชำระเงิน` ที่มี P1 ราคา 450 | admin01 แก้ราคา P1 เป็น `500` แล้ว cus_normal เปิด `/orders/{orderId}` | • `order-line-P1` › `order-line-unit-price` ยัง `data-value="450"` |
| **TC-20** | **`E2E-ADMIN-5`** | สินค้าที่ปิดขายหายจากหน้าสินค้าของ Customer (FR-1.3.1) | P1 `onSale` | admin01 ปิดขาย P1 แล้ว cus_normal เปิด `/products` ใหม่ | • ไม่มี `product-row-P1`<br>• ยังมี `product-row-P2` และ `product-row-P3` |
| **TC-21** | **`E2E-ADMIN-5`** | สินค้าที่ปิดขายยังอยู่ในตะกร้าแต่ไม่พร้อมขาย (FR-9.3.4, AC-10) | ตะกร้าของ `cus_normal` มี P1 × 1 | admin01 ปิดขาย P1 แล้ว cus_normal เปิด `/cart` ใหม่ | • ยังมี `cart-line-P1`<br>• `cart-line-availability` `data-available="false"` |
| **TC-22** | **`E2E-ADMIN-5`** | สต็อก 0 ทำให้สินค้าหายจากหน้าสินค้าของ Customer (FR-1.3.1, FR-9.1.2) | P2 สต็อก 3 | admin01 แก้สต็อก P2 เป็น `0` แล้ว cus_normal เปิด `/products` ใหม่ | • ไม่มี `product-row-P2` |
| **TC-23** | **`E2E-ADMIN-6`** | Customer บันทึกการแก้ไขสินค้าไม่ได้ (FR-0.3.2, AC-14) | login `cus_normal` | เปิด URL `/admin/products` → กรอกราคา P1 `500` → คลิก `admin-product-save` | • `app-message` `data-kind="error"` `data-code="AUTH_FORBIDDEN"`<br>• เมื่อ admin01 เปิด `/admin/products` P1 ราคายัง `data-value="450"` (FR-0.7) |
| **TC-24** | **`E2E-ADMIN-6`** | Customer เปลี่ยนสถานะการขายไม่ได้ (FR-0.3.2) | login `cus_normal` อยู่หน้า `/admin/products` | คลิก `admin-product-toggle-status` ของ P1 | • `app-message` `data-code="AUTH_FORBIDDEN"`<br>• P1 ยังอยู่ในหน้าสินค้าของ Customer (`product-row-P1`) |
| **TC-25** | **`E2E-ADMIN-6`** | ผู้ที่ไม่ได้ login ไม่เห็นข้อมูลสินค้าฝั่ง Admin (FR-0.2) | ยังไม่ login (context ใหม่) | เปิด URL `/admin/products` | • ไม่มีแถว `admin-product-row-*` |

---

## 3. รายละเอียด Test Locators และ Automation Attributes (DC-2)

| Element บนหน้าจอ | Playwright Locator / Selector | สิ่งที่ใช้ตรวจสอบ (Assertion) |
| :--- | :--- | :--- |
| กรอบหน้าจัดการสินค้า | `page.getByTestId('page-admin-products')` | `toBeVisible()` |
| แถวสินค้าตาม ID | `page.getByTestId('admin-product-row-P1')` | `toBeVisible()` / `toHaveCount(0)` |
| ชื่อสินค้า | `row.getByTestId('admin-product-name')` | ข้อความชื่อสินค้า |
| ราคาปัจจุบัน | `row.getByTestId('admin-product-price')` | `toHaveAttribute('data-value', '450')` |
| สต็อกพร้อมขาย | `row.getByTestId('admin-product-stock')` | `toHaveAttribute('data-value', '20')` |
| สถานะการขาย | `row.getByTestId('admin-product-status')` | `toHaveAttribute('data-status', 'onSale' / 'offSale')` |
| ช่องแก้ราคา | `row.getByTestId('admin-product-price-input')` | `.fill('500')` / `toHaveValue('450')` |
| ช่องแก้สต็อก | `row.getByTestId('admin-product-stock-input')` | `.fill('15')` / `toHaveValue('20')` |
| ปุ่มบันทึก | `row.getByTestId('admin-product-save')` | `.click()` |
| ปุ่มเปิด/ปิดการขาย | `row.getByTestId('admin-product-toggle-status')` | `.click()` / `toHaveText('ปิดขาย' / 'เปิดขาย')` |
| กล่องข้อความแจ้งเตือน | `page.getByTestId('app-message')` | `toHaveAttribute('data-code', 'VALIDATION_ERROR' / 'AUTH_FORBIDDEN')` |
| เมนู Admin | `page.getByTestId('nav-admin-products')`, `page.getByTestId('nav-admin-coupons')` | `toBeVisible()` |
| ฝั่ง Customer: แถวสินค้า | `page.getByTestId('product-row-P1')` | `toHaveCount(0)` |
| ฝั่ง Customer: ราคาในตะกร้า | `page.getByTestId('cart-line-P1').getByTestId('cart-line-unit-price')` | `toHaveAttribute('data-value', '500')` |
| ฝั่ง Customer: ความพร้อมขายในตะกร้า | `page.getByTestId('cart-line-P1').getByTestId('cart-line-availability')` | `toHaveAttribute('data-available', 'false')` |
| ฝั่ง Customer: ราคาในออเดอร์ | `page.getByTestId('order-line-P1').getByTestId('order-line-unit-price')` | `toHaveAttribute('data-value', '450')` |

---

## 4. Requirement Traceability Matrix (RTM)

| รหัสข้อกำหนด (SRS) | คำอธิบายโดยย่อ | Test Cases ที่ครอบคลุม |
| :--- | :--- | :--- |
| **`FR-0.2`** | ผู้ที่ไม่ได้ login ใช้ OP-15 ถึง OP-18 ไม่ได้ | `TC-25` |
| **`FR-0.3.2`** | ผู้ที่ไม่ใช่ Admin เรียก OP-15/OP-16 ถูกปฏิเสธด้วย `AUTH_FORBIDDEN` | `TC-23`, `TC-24` |
| **`FR-0.7`** | การปฏิเสธต้องไม่เปลี่ยนข้อมูลสินค้า | `TC-09`–`TC-14`, `TC-23`, `TC-24` |
| **`FR-1.3.1`** | Customer เห็นเฉพาะสินค้าพร้อมขาย | `TC-20`, `TC-22` |
| **`FR-1.3.2`** | Admin เห็นสินค้าทั้งหมดพร้อมราคา สต็อก สถานะ | `TC-01`, `TC-02`, `TC-03` |
| **`FR-9.1.1`** | ตรวจราคา 1–50,000 และสต็อก 0–9,999 เป็นจำนวนเต็ม (`VALIDATION_ERROR`) | `TC-06`, `TC-07`, `TC-09`–`TC-14` |
| **`FR-9.1.2`** | บันทึกค่าที่ระบุ โดยสต็อกคือสต็อกพร้อมขายใหม่ | `TC-05`, `TC-06`, `TC-07`, `TC-08`, `TC-22` |
| **`FR-9.2.1`** | ราคาใหม่มีผลกับตะกร้าทุกใบทันที | `TC-18` |
| **`FR-9.2.2`** | ราคาใหม่ไม่มีผลกับออเดอร์ที่สร้างแล้ว | `TC-19` |
| **`FR-9.3.2`** | เปลี่ยนสถานะการขายตามที่ระบุ | `TC-15`, `TC-16`, `TC-17` |
| **`FR-9.3.4`** | สินค้าที่ปิดขายยังอยู่ในตะกร้าและไม่พร้อมขาย | `TC-21` |
| **`AC-10`** | ปิดขายสินค้าที่อยู่ในตะกร้า (ข้าม actor) | `TC-21` |
| **`AC-13`** | ราคาใหม่: ตะกร้าเห็นราคาใหม่ ออเดอร์เดิมยังเป็นราคาเดิม | `TC-18`, `TC-19` |
| **`AC-14`** | Customer แก้ราคาไม่ได้ และราคาไม่เปลี่ยน | `TC-23` |
| **`AC-16`** | ราคาและสต็อกผิดพร้อมกัน → `VALIDATION_ERROR` และค่าไม่เปลี่ยน | `TC-13` |
| **`DC-2.7`, `DC-2.9`** | `data-value` ของราคา/สต็อก และ `data-status` ของสถานะการขาย | `TC-02`, `TC-15`, `TC-17` |
| **`DC-2.12`** | เข้าหน้าได้ด้วย URL โดยตรง | `TC-04` |

---

## 5. ข้อจำกัดของ UI และสิ่งที่ต้องทดสอบที่ระดับ API แทน

ตรวจกับ `frontend/src/pages/admin-products.tsx` และ `backend/src/modules/admin/admin-routes.ts` แล้ว:

| ข้อกำหนด | เหตุที่ทดสอบผ่าน UI ไม่ได้ / ข้อสังเกต | ทดสอบแทนที่ |
| :--- | :--- | :--- |
| `FR-9.1.1` ขั้น 1 / `FR-9.3.1` (`PRODUCT_NOT_FOUND`) | หน้าเว็บแสดงเฉพาะสินค้าที่มีอยู่ จึงส่ง productId ที่ไม่มีไม่ได้ | API test (`PUT /admin/products/P999`, `POST /admin/products/P999/status`) |
| `FR-9.1.1` "ระบุอย่างน้อยหนึ่งค่า" | ปุ่มบันทึกส่งทั้ง `price` และ `stock` ทุกครั้ง | API test (body ว่าง / ส่งค่าเดียว) |
| `FR-9.1.1` รายชื่อฟิลด์ที่ไม่ผ่านทั้งหมด | `app-message` แสดงแค่ `data-code` ส่วนรายชื่อฟิลด์ (`details.fields`) ไม่ได้แสดงบนหน้า TC-13 จึงตรวจได้แค่ code กับค่าที่ไม่เปลี่ยน | API test ตรวจ `details.fields = ['price','stock']` |
| `FR-9.3.3` ตั้งสถานะเดิมซ้ำ | ปุ่ม toggle สลับสถานะเสมอ จึงตั้งสถานะเดิมซ้ำผ่าน UI ไม่ได้ | API test (`status: 'onSale'` กับสินค้าที่ `onSale` อยู่แล้ว) |
| `FR-9.3.5` การเปลี่ยนสถานะไม่กระทบออเดอร์ | ทำได้แบบเดียวกับ TC-19 แต่ซ้ำกับแนวคิดเดียวกัน จึงไม่เลือกในชุดนี้ | เพิ่มได้ภายหลังหรือ API test |
| ข้อสังเกตเรื่องสิทธิ์ (TC-23–TC-25) | หน้า `/admin/products` ไม่มี role guard: Customer เปิดได้และเห็นรายการสินค้าแบบ Customer (สถานะแสดงเป็นค่าเริ่มต้น `onSale`) ส่วนผู้ที่ไม่ได้ login จะเห็นหน้าว่าง SRS กำหนดการปฏิเสธไว้ที่ operation (FR-0.2, FR-0.3.2) ไม่ได้บังคับให้ redirect จึงตรวจที่ผลของการกดบันทึก/toggle และข้อมูลที่ไม่เปลี่ยน | — |
| ข้อความเมื่อบันทึกสำเร็จ | หน้าเว็บไม่แสดงข้อความเมื่อสำเร็จ (SRS ไม่ได้กำหนด) จึงตรวจจาก `data-value` / `data-status` ที่อัปเดต และการไม่มี `app-message` แบบ error | — |

---

## 6. หมายเหตุการ implement (สำหรับ `e2e/admin-products.spec.ts`)

- เรียก `/test/reset` ใน `beforeEach` และรอ API call ที่ค้างให้ได้ response ใน `afterEach` เหมือน `e2e/cart.spec.ts` (ป้องกัน deadlock ระหว่าง reset กับ request ที่ค้าง)
- รวม TC ใน Scenario เดียวกันเป็น `test.step` ภายใต้ `test()` เดียว เพื่อ login น้อยครั้ง (Supabase Auth มี rate limit) แต่ TC ที่ต้องการค่าเริ่มต้นใหม่ (เช่น TC-05 ถึง TC-07) ให้กรอกค่ากลับหรือแยก `test()` ตามความเหมาะสม
- Scenario `E2E-ADMIN-5` ใช้ 2 browser context: Admin กับ Customer โดย TC-19 สร้างออเดอร์ `รอชำระเงิน` ผ่าน UI (เพิ่ม P1 → `checkout-button`) แล้วเก็บ orderId จาก `checkout-order-id`
- ข้อมูลทดสอบใช้ DB ร่วมกับทีม ถ้ามีคนอื่นรันเทสพร้อมกันผลอาจไม่แน่นอน
