# HTTP API contract (DESIGN refinement of workbook)

Machine-readable definition: [OpenAPI 3.1](../api/openapi.json). API origin แยกจาก Web origin; paths ไม่มี prefix. JSON UTF-8, Accept/Content-Type application/json เมื่อมี body. Protected OPs use `Authorization: Bearer <backend-issued JWT>`. Successful collections unpaginated. No PUT body coercion/qty alias. Integers returned as JSON numbers in THB/grams; timestamps UTC ISO8601; IDs strings

## Operations

| OP | Method / path | Body | Success | Data |
|---|---|---|---|---|
| 1 | POST /auth/login | username,password strings | 200 | LoginResult |
| 2 | GET /products | none | 200 | {products: Product[]} — Customer available only; Admin all |
| 3 | POST /cart/items | productId string, quantity unknown to domain validator | 200 | Cart |
| 4 | PUT /cart/items/{productId} | quantity unknown | 200 | Cart |
| 5 | DELETE /cart/items/{productId} | none | 200 | Cart; last removal info message |
| 6 | PUT /cart/coupon | code string | 200 | Cart |
| 7 | GET /cart | none | 200 | Cart |
| 8 | POST /cart/checkout | zone,speed (unknown until domain validation) | 201 | {customer,order}; coupon notice if removed |
| 9 | DELETE /cart/checkout | none; no orderId param | 200 | {cart,order} cancelled |
| 10 | POST /orders/{orderId}/pay-success | {result:"success"} | 200 | {customer,order} paid |
| 11 | POST /orders/{orderId}/pay-fail | {result:"fail"} | 200 | {customer,order} pending + info |
| 12 | POST /cart/continue | none | 200 | Cart |
| 13 | GET /orders | none | 200 | {orders: OrderSummary[]} newest first |
| 14 | GET /orders/{orderId} | none | 200 | Order |
| 15 | PUT /admin/products/{productId} | price?/stock? unknown, validate all | 200 | AdminProduct |
| 16 | POST /admin/products/{productId}/status | status:onSale/offSale | 200 | AdminProduct |
| 17 | POST /admin/coupons/{code}/status | status:active/inactive | 200 | {coupons:Coupon[]} |
| 18 | GET /admin/coupons | none | 200 | {coupons:Coupon[]} |
| support | GET /auth/me | none | 200 | UserState |
| test | POST /test/reset | none; X-Test-Reset-Token header | 200 | {reset:true} |

OP-10/11 and reset exist only APP_ENV=test. Simulator has no Customer auth requirement; reset requires isolated test secret. Error for absent route is ordinary 404, not falsely mapped ORDER_NOT_FOUND. Every other OP except login requires auth; roles follow SRS

## Success envelope and DTOs

All successes: `{data: <operation data>, messages: Message[]}`. messages is always array, empty when none. Message: `{kind:"notice"|"info",code:string,message:string}`; info code is empty string. Error response is NOT wrapped in data: `{error:{code,message,details?}}` from workbook. Notice is success not 4xx

- UserState: userId UUID, username, role Customer|Admin, memberTier normal|prime|null, stage cart|checkout|success|null, currentOrderId UUID|null. Admin tier/stage/reference null
- LoginResult: accessToken (backend-issued HS256 JWT), tokenType:"Bearer", expiresIn=3600 seconds (DESIGN), user:UserState. No refresh token/password_hash/credential exposed. Backend verifies required sub/iss/aud/iat/exp and reads role/tier from DB; not Supabase Auth. Invalid/missing/expired token =>401 AUTH_REQUIRED; token expiry never cancels pending orders
- Product: productId,name,price,weightGram,availableStock. Customer result omits sale status. AdminProduct adds status:onSale|offSale
- Cart: stage,currentOrderId,couponCode:string|null,lineCount,checkoutEnabled,subtotal,lines:CartLine[]. CartLine: productId,name,unitPrice,weightGram,quantity,available:boolean. Live product values used in every read
- Coupon: code,percent,minSpend,status:active|inactive
- OrderSummary: orderId,createdAt,status:pending|paid|cancelled,netTotal
- Order: summary + lines:OrderLine[],subtotal,discount,shippingFee,zone,speed,couponCode:string|null. OrderLine: productId,name,unitPrice,quantity,weightGram (snapshot extra DESIGN). discountSource:coupon|member|none and totalWeightGram stored/returned for diagnostics; immutable
- API does not expose ownerId for another user; owned order DTO does not need ownerId

Enum mapping: cart=ตะกร้า, checkout=ชำระเงิน, success=สำเร็จ; pending=รอชำระเงิน, paid=ชำระเงินแล้ว, cancelled=ยกเลิก; onSale=เปิดขาย, offSale=ปิดขาย; active=เปิดใช้, inactive=ปิดใช้

## Error mapping (all 16 SRS codes)

| HTTP | Codes |
|---|---|
| 400 | VALIDATION_ERROR, QTY_OUT_OF_RANGE, PRODUCT_UNAVAILABLE, INSUFFICIENT_STOCK, CART_EMPTY, COUPON_INVALID, ITEMS_UNAVAILABLE, WEIGHT_LIMIT_EXCEEDED, OPERATION_NOT_ALLOWED |
| 401 | AUTH_REQUIRED, AUTH_INVALID_CREDENTIALS |
| 403 | AUTH_FORBIDDEN |
| 404 | PRODUCT_NOT_FOUND, ITEM_NOT_IN_CART, ORDER_NOT_FOUND, COUPON_NOT_FOUND |

ITEMS_UNAVAILABLE details={productIds:[...]} contains ALL failures once each, deterministic cart-line order; SRS tests assert set unless order clarified. Admin validation details={fields:["price","stock"]} for both invalid; include only specified invalid fields unless none supplied (SOI-05). Optional details otherwise omitted. All errors leave domain state unchanged

Exact required texts:
- remove empty: `ไม่มีสินค้าให้ลบ`
- remove absent in nonempty: `ไม่พบสินค้าในตะกร้า`
- last remove info: `ตะกร้าว่าง`
- checkout empty: `ไม่สามารถชำระเงินได้ ตะกร้าว่าง`
- coupon removed notice code COUPON_NOT_APPLICABLE: `คูปองไม่สามารถใช้กับคำสั่งซื้อนี้`
- payFail info: `การชำระเงินล้มเหลว กรุณาลองใหม่`

Other messages descriptive Thai but tests assert code rather than invent exact SRS text. Unexpected infra failures sanitized 500/503 (not new domain codes), UI shows retry message without reporting success

## Examples

Checkout cus_prime P1×1,P2×1,SAVE10,inCity,standard => 201, data.order subtotal=1650,discount=165,shippingFee=0,netTotal=1485,status=pending; data.customer.stage=checkout; messages=[]. Same customer P1×2,SAVE10,upcountry,express => couponCode=null, discountSource=member,discount=45,shippingFee=25,netTotal=880, notice COUPON_NOT_APPLICABLE. Failed checkout before coupon evaluation does not change couponCode

Gateway fail returns 200 and pending order unchanged, same stage checkout and info message. Duplicate paySuccess after paid => 400 OPERATION_NOT_ALLOWED, not 200. Non-owner GET order and nonexistent GET order both 404 ORDER_NOT_FOUND with same outward message
