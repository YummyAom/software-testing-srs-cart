# API Design workbook — readable extraction

Non-empty cells; source unchanged. Not a corrected contract.

## 1 &3 & 4

- **G1**: Request (Request Contract:)
- **I1**: Response (Response Contract: STATUS CODE)

- **A2**: OP
- **B2**: ผู้เรียก
- **C2**: Operation
- **D2**: คำอธิบาย
- **E2**: method
- **F2**: Path
- **I2**: 200
- **J2**: 201
- **K2**: 400
- **L2**: 401
- **M2**: 403
- **N2**: 404

- **A3**: OP-1
- **B3**: ทุกบทบาท
- **C3**: login(username, password)
- **D3**: เข้าสู่ระบบ
- **E3**: POST
- **F3**: /auth/login
- **G3**: -
- **H3**: Body: username, password
- **I3**: สำเร็จ คืนค่า Token
- **K3**: Error message <br>ตามสาเหตุ
- **L3**: Error message <br>ตามสาเหตุ
- **M3**: Error message <br>ตามสาเหตุ
- **N3**: Error message <br>ตามสาเหตุ

- **A4**: OP-2
- **B4**: ทุกบทบาท
- **C4**: listProducts()
- **D4**: ดูรายการสินค้า
- **E4**: GET
- **F4**: /products
- **G4**: Authorization
- **H4**: -
- **I4**: รายการสินค้า
- **J4**: -
- **K4**: Error message <br>ตามสาเหตุ
- **L4**: Error message <br>ตามสาเหตุ
- **M4**: Error message <br>ตามสาเหตุ
- **N4**: Error message <br>ตามสาเหตุ

- **A5**: OP-3
- **B5**: Customer
- **C5**: addItem(productId, quantity)
- **D5**: เพิ่มสินค้าเข้าตะกร้า
- **E5**: POST
- **F5**: /cart/items
- **G5**: Authorization
- **H5**: Body: productId (String), qty หรือ quantity (Number)
- **I5**: ตะกร้าทั้งใบ (stage,<br> รายการ, ยอดรวม)
- **J5**: -
- **K5**: Error message ตามสาเหตุ
- **L5**: Error message ตามสาเหตุ
- **M5**: Error message ตามสาเหตุ
- **N5**: Error message ตามสาเหตุ

- **A6**: OP-4
- **B6**: Customer
- **C6**: updateQuantity(productId, quantity)
- **D6**: แก้ไขจำนวนของรายการในตะกร้า
- **E6**: PUT
- **F6**: /cart/items/{productId}
- **G6**: Authorization
- **H6**: Path Param: id (รหัสสินค้า)<br>Body: qty (Number)
- **I6**: ตะกร้าทั้งใบที่อัปเดตแล้ว
- **J6**: -
- **K6**: Error message ตามสาเหตุ
- **L6**: Error message ตามสาเหตุ
- **M6**: Error message ตามสาเหตุ
- **N6**: Error message ตามสาเหตุ

- **A7**: OP-5
- **B7**: Customer
- **C7**: removeItem(productId)
- **D7**: ลบรายการออกจากตะกร้า
- **E7**: DELETE
- **F7**: /cart/items/{productId}
- **G7**: Authorization
- **H7**: Path Param: id (รหัสสินค้า)   Body: ไม่มี
- **I7**: ลบสำเร็จ ปรับสถานะตะกร้า<br> (หากเหลือ 0 ชิ้น แจ้ง "ตะกร้าว่าง")
- **J7**: -
- **K7**: -
- **L7**: -
- **M7**: -
- **N7**: Error message ตามสาเหตุ

- **A8**: OP-6
- **B8**: Customer
- **C8**: applyCoupon(code)
- **D8**: ผูกคูปองกับตะกร้า
- **E8**: PUT
- **F8**: /cart/coupon
- **G8**: Authorization
- **H8**: Body: code (String)
- **I8**: ตะกร้าพร้อมรหัสคูปองที่ผูก
- **J8**: -
- **K8**: -
- **L8**: Error message ตามสาเหตุ
- **M8**: -
- **N8**: -

- **A9**: OP-7
- **B9**: Customer
- **C9**: viewCart()
- **D9**: ดูตะกร้า
- **E9**: GET
- **F9**: /cart
- **G9**: Authorization
- **H9**: Body: ไม่มี
- **I9**: อ่านสถานะตะกร้าสำเร็จ<br> (แสดง items, count, checkoutEnabled)   
- **J9**: -
- **K9**: -
- **L9**: Error message ตามสาเหตุ
- **M9**: -
- **N9**: -

- **A10**: OP-8
- **B10**: Customer
- **C10**: pressCheckout(zone, speed)
- **D10**: เข้าสู่ขั้นตอนชำระเงิน
- **E10**: POST
- **F10**: /cart/checkout
- **G10**: Authorization
- **H10**: Body: ข้อมูลจัดส่ง (zone, speed)
- **I10**: -
- **J10**:  สร้าง order ใหม่ (คืนค่า order id ที่ไม่ซ้ำ, snapshot รายการสินค้า)
- **K10**: Error message ตามสาเหตุ
- **L10**: Error message ตามสาเหตุ
- **M10**: -
- **N10**: -

- **A11**: OP-9
- **B11**: Customer
- **C11**: cancelCheckout()
- **D11**: ยกเลิกการชำระเงินและกลับสู่ตะกร้า
- **E11**: DELETE
- **F11**: /cart/checkout
- **G11**: Authorization
- **H11**: Path Param: id (รหัสออเดอร์)
- **I11**: อัปเดตสถานะ order เป็น "ยกเลิก"<br> และกลับสู่หน้าตะกร้าปกติ
- **J11**: -
- **K11**: -
- **L11**: -

- **A12**: OP-10
- **B12**: Payment gateway
- **C12**: paySuccess(orderId)
- **D12**: gateway แจ้งชำระเงินสำเร็จ
- **E12**: POST
- **F12**: /orders/{orderId}/pay-success
- **G12**: Authorization
- **H12**: Path Param: id (รหัสออเดอร์)   Body: {"result": "success"}   
- **I12**: อัปเดตสถานะเป็น <br>"ชำระเงินแล้ว"<br> และตะกร้าถูกล้าง   
- **J12**: -
- **K12**: -
- **L12**: -

- **A13**: OP-11
- **B13**: Payment gateway
- **C13**: payFail(orderId)
- **D13**: gateway แจ้งชำระเงินล้มเหลว
- **E13**: POST
- **F13**: /orders/{orderId}/pay-fail
- **G13**: Authorization
- **H13**: Path Param: id (รหัสออเดอร์)   <br>Body: {"result": "fail"}
- **I13**: บันทึกผล fail สำเร็จ <br>แต่ออเดอร์ยังคงสถานะ<br> "รอชำระเงิน"
- **J13**: -
- **K13**: -

- **A14**: OP-12
- **B14**: Customer
- **C14**: continueShopping()
- **D14**: กลับสู่ตะกร้าหลังสั่งซื้อสำเร็จ
- **E14**: POST
- **F14**: /cart/continue
- **G14**: Authorization
- **H14**: Body: ไม่มี
- **I14**: เปลี่ยน stage กลับเป็นหน้าตะกร้าว่าง
- **J14**: -
- **K14**: -

- **A15**: OP-13
- **B15**: Customer
- **C15**: listOrders()
- **D15**: ดูรายการออเดอร์ของตนเอง
- **E15**: GET
- **F15**: /orders
- **G15**: Authorization
- **H15**: Body: ไม่มี
- **I15**: รายการออเดอร์ทั้งหมดของลูกค้า
- **J15**: -
- **K15**: -

- **A16**: OP-14
- **B16**: Customer
- **C16**: viewOrder(orderId)
- **D16**: ดูรายละเอียดออเดอร์ของตนเอง
- **E16**: GET
- **F16**: /orders/{orderId}
- **G16**: Authorization
- **H16**: Path Param: id (รหัสออเดอร์)   Body: ไม่มี
- **I16**: อ่านข้อมูล order สำเร็จ พร้อมรายการสินค้าครบถ้วน   
- **J16**: -
- **K16**: -
- **N16**: Error message ตามสาเหตุ

- **A17**: OP-15
- **B17**: Admin
- **C17**: updateProduct(productId, price?, stock?)
- **D17**: แก้ไขราคาและ/หรือสต็อก
- **E17**: PUT
- **F17**: /admin/products/{productId}
- **G17**: Authorization
- **H17**: Path Param: id<br>Body: price, stock
- **I17**: อัปเดตข้อมูลสำเร็จ
- **J17**: -
- **K17**: Error message ตามสาเหตุ
- **L17**: -
- **M17**: Error message ตามสาเหตุ
- **N17**: -

- **A18**: OP-16
- **B18**: Admin
- **C18**: setProductStatus(productId, status)
- **D18**: เปิด/ปิดการขาย
- **E18**: POST
- **F18**: /admin/products/{productId}/status
- **G18**: Authorization
- **H18**: Path Param: id<br>Body: status
- **I18**: เปลี่ยนสถานะสำเร็จ
- **J18**: -
- **K18**: -
- **L18**: -
- **M18**: Error message ตามสาเหตุ
- **N18**: -

- **A19**: OP-17
- **B19**: Admin
- **C19**: setCouponStatus(code, status)
- **D19**: เปิด/ปิดใช้คูปอง
- **E19**: POST
- **F19**: /admin/coupons/{code}/status
- **G19**: Authorization
- **H19**: Path Param: code<br>Body: status
- **I19**: รายการคูปองทั้งหมด
- **J19**: -
- **K19**: -
- **L19**: -
- **M19**: Error message ตามสาเหตุ
- **N19**: -

- **A20**: OP-18
- **B20**: Admin
- **C20**: listCoupons()
- **D20**: ดูรายการคูปองทั้งหมด
- **E20**: GET
- **F20**: /admin/coupons
- **G20**: Authorization
- **H20**: Body: ไม่มี
- **I20**: รายการคูปองทั้งหมด
- **J20**: -
- **K20**: -
- **L20**: -
- **M20**: Error message ตามสาเหตุ
- **N20**: -

- **B23**: https://share.gemini.google/KTJ0PErRkyXd

## 2. กำหนดของที่ใช้ร่วมกันทุก end

- **A1**: 2.1 กลไก Authentication & Authorization

- **A2**: ผู้ใช้ที่ Login สำเร็จจะได้รับ Token

- **A3**: ทุก Endpoint ที่ต้องตรวจสอบตัวตน (FR-0.2) ต้องแนบ Header:
- **D3**: Authorization: Bearer <token>

- **A5**: 2.2 โครงสร้าง Response กลางสำหรับกรณี Error
- **D5**: Default_Error_responce.json
- **F5**: {<br>  "error": {<br>    "code": "ERROR_CODE",<br>    "message": "ข้อความอธิบายสาเหตุของความผิดพลาด",<br>    "details": {} // (Optional) ข้อมูลเพิ่มเติม เช่น รายชื่อฟิลด์ที่ไม่ผ่าน<br>  }<br>}

- **A7**: 2.3 การจับคู่ Domain Error Codes กับ HTTP Status Codes

- **A8**: HTTP Status Code
- **B8**: ความหมายเชิงเทคนิค (HTTP)
- **C8**: Domain Error Code
- **D8**: ความหมาย / รายละเอียดเงื่อนไข

- **A9**: 200 OK
- **B9**: สำเร็จตามคำขอ
- **C9**: -
- **D9**: การอ่าน, แก้ไข หรือประมวลผลคำสั่งสำเร็จ

- **A10**: 201 Created
- **B10**: สร้าง Resource สำเร็จ
- **C10**: -
- **D10**: pressCheckout สร้างออเดอร์ใหม่สำเร็จ

- **A11**: 400 Bad Request
- **B11**: ข้อมูลผิดพลาดหรือไม่เป็นไปตาม Business Rules
- **C11**: VALIDATION_ERROR
- **D11**: รูปแบบหรือช่วงของข้อมูลไม่ถูกต้อง

- **C12**: QTY_OUT_OF_RANGE
- **D12**: quantity อยู่นอกช่วง 1–10

- **C13**: PRODUCT_UNAVAILABLE
- **D13**: ไม่ใช่สินค้าพร้อมขาย

- **C14**: INSUFFICIENT_STOCK
- **D14**: quantity เกินสต็อกพร้อมขาย

- **C15**: CART_EMPTY
- **D15**: ตะกร้าว่าง

- **C16**: COUPON_INVALID
- **D16**: คูปองไม่มีหรือปิดใช้ ณ ขณะผูก

- **C17**: ITEMS_UNAVAILABLE
- **D17**: มีรายการที่ไม่พร้อมขาย ณ checkout

- **C18**: WEIGHT_LIMIT_EXCEEDED
- **D18**: น้ำหนักรวมเกิน 20,000 กรัม

- **C19**: OPERATION_NOT_ALLOWED
- **D19**: operation ไม่อนุญาตใน stage/สถานะปัจจุบัน

- **A20**: 401 Unauthorized
- **B20**: ยังไม่ได้ยืนยันตัวตนหรือข้อมูลประจำตัวไม่ถูกต้อง
- **C20**: AUTH_REQUIRED
- **D20**: ยังไม่ได้ login

- **C21**: AUTH_INVALID_CREDENTIALS
- **D21**: username/password ไม่ถูกต้อง

- **A22**: 403 Forbidden
- **B22**: มีการยืนยันตัวตนแล้วแต่ไม่มีสิทธิ์ใน Role นั้น
- **C22**: AUTH_FORBIDDEN
- **D22**: บทบาทไม่มีสิทธิ์

- **A23**: 404 Not Found
- **B23**: ไม่พบ Resource ที่อ้างถึง
- **C23**: PRODUCT_NOT_FOUND
- **D23**: ไม่มีสินค้า

- **C24**: ITEM_NOT_IN_CART
- **D24**: สินค้าไม่อยู่ในตะกร้า

- **C25**: ORDER_NOT_FOUND
- **D25**: ไม่พบออเดอร์ (หรือไม่ใช่ของ Customer ผู้เรียก)

- **C26**: COUPON_NOT_FOUND
- **D26**: ไม่พบคูปอง

