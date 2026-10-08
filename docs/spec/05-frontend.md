# Frontend functional and interaction specification

React + Vite + React Router + TypeScript (DESIGN). UI mode เน้นทำงานได้ชัดเจน ไม่ใช้ impeccable หรือออกแบบเพิ่มเหนือ SRS. ภาษาไทยสำหรับ actions/status/messages, ชื่อสินค้า seed คงเดิม, เงิน THB integer พร้อม comma; data-value เก็บ raw integer. ไม่มีภาพสินค้า/marketing copy ที่ SRS ไม่กำหนด

## State ownership / networking

Server owns stage/cart/order/pricing/availability. Browser stores only bearer access token (DESIGN: sessionStorage), display user state, input drafts, zone/speed และ request pending state. No persisted client cart and no discount calculation as authoritative expected total. No optimistic stock/cart/status edits; await server success then update returned DTO/refetch. Prevent double clicks while in flight but disabled controls do not replace backend guards. Domain 4xx แสดง code/message และไม่รายงาน success; network failure outcome unknown ให้ refetch state ก่อน retry checkout (no auto POST retry)

Bootstrap protected route: read token -> GET /auth/me -> authorize role -> route guard -> load page data. On 401 clear token and navigate login; business state unaffected. Login success Customer stage determines /cart,/checkout,/success; Admin -> /admin/products. Never infer stage from route/localStorage. On checkout/success refresh order via currentOrderId and owned GET order, not latest-order guess. Technical bootstrap failure show recoverable error not fake empty cart

Workflow stage guards: /cart only cart; /checkout only checkout; /success only success. Wrong workflow URL redirects replace=true to actual stage page. Read-only products/orders/detail remain accessible every stage per DESIGN reading of FR-8.5.2; see SOI-03 for DC-2.13 ambiguity. nav-cart directs actual workflow page. Admin URLs reject Customer; Customer mutation pages reject Admin; login prerequisite for both. Detail non-owner/not-found shows ORDER_NOT_FOUND app-message, no foreign data

## Screens

| URL / page test ID | Required data and interaction | Important states |
|---|---|---|
| /login / page-login | username,password labeled inputs, submit; show auth error | idle/submitting/error; no registration/reset links |
| /products / page-products | available products, name/price/weight/stock, qty input and add action per row | empty catalog; loading; add disabled outside cart, quantity drafts still possible; POST add returns Cart |
| /cart / page-cart | live cart rows, edit quantity/update/remove, subtotal, coupon code/input/apply, zone/speed, checkout | empty with disabled checkout; unavailable row kept/removable; coupon attach even empty; checkout enabled iff lineCount>=1 and cart stage |
| /checkout / page-checkout | pending snapshot lines/orderId/totals/zone/speed/coupon; cancel; test-only pay-success/pay-fail | gateway fail info stays checkout; coupon notice survives navigation; no editing snapshot |
| /success / page-success | paid snapshot orderId/lines/all totals; continue shopping | button -> server continue -> cart |
| /orders / page-orders | own orders newest first, status/total/view links | no orders empty state; all stages readable |
| /orders/{orderId} / page-order-detail | owned immutable order details, line names/prices/qty and totals/status | not found and non-owner identical error; no cancel/refund paid orders |
| /admin/products / page-admin-products | all products incl stock0/offSale; price/stock inputs, save, status toggle | save can update one or both fields; errors show every invalid specified field; no create/delete/name/weight edit |
| /admin/coupons / page-admin-coupons | all code/percent/minSpend/status and toggle | no create/edit discount/minSpend; refresh list returned by OP-17 |

Cart quantity input should accept drafts but submit a number when syntactically numeric; don't silently turn blank into0 or string "1" into an API domain string. Real API invalid-type tests bypass UI. Inputs 1..10 hint is not quantity 0 removal; remove button is separate. Admin blank untouched field omitted; clearing an edited field must not silently save0. Zone options inCity/upcountry/remote and speed standard/express; DESIGN defaults inCity/standard (not SRS test assumption)

## Required semantic and automation contract (DC-2)

All controls native button/a/input/select, labels tied by for/id, unique accessible name within container, focus visible. Use getByRole/getByLabel first; getByTestId for identifiers/observations. Exact minimum IDs copied below; do not rename or globalize row-child IDs. Scope repeated child IDs to row

| Container | Exact children / rows | Attributes |
|---|---|---|
| every page | app-message | data-kind=error/notice/info, data-code domain/notice or empty for info |
| authenticated Customer | nav-products,nav-cart,nav-orders | anchors |
| authenticated Admin | nav-admin-products,nav-admin-coupons | anchors |
| page-login | login-username,login-password,login-submit | labels/password type |
| page-products | product-row-{productId}: product-name,product-price,product-stock,product-add-qty,product-add-button | price/stock data-value |
| page-cart | cart-line-{productId}: cart-line-name,cart-line-unit-price,cart-line-qty,cart-line-availability,cart-line-qty-input,cart-line-update,cart-line-remove | price/qty data-value; availability data-available=true/false |
| page-cart | cart-subtotal,cart-coupon-code,coupon-input,coupon-apply,zone-select,speed-select,checkout-button | subtotal data-value; checkout native disabled |
| page-checkout | checkout-order-id,checkout-subtotal,checkout-discount,checkout-shipping,checkout-total,cancel-checkout-button | money data-value |
| page-checkout (test only) | gateway-pay-success,gateway-pay-fail | buttons call current order's OP-10/11 |
| page-success | success-order-id,success-line-{productId},success-subtotal,success-discount,success-shipping,success-total,continue-shopping-button | money data-value; each line visible name/qty/price |
| page-orders | order-row-{orderId}: order-status,order-total,order-view | status data-status, total data-value |
| page-order-detail | order-detail-id,order-detail-status,order-line-{productId}: order-line-unit-price,order-line-qty; order-detail-subtotal,order-detail-discount,order-detail-shipping,order-detail-total | status data-status; amounts/qty data-value |
| page-admin-products | admin-product-row-{productId}: admin-product-price,admin-product-stock,admin-product-status,admin-product-price-input,admin-product-stock-input,admin-product-save,admin-product-toggle-status | price/stock data-value; status data-status |
| page-admin-coupons | admin-coupon-row-{code}: admin-coupon-percent,admin-coupon-min-spend,admin-coupon-status,admin-coupon-toggle-status | percent/minSpend data-value; status data-status |

Page root itself has exact page-* test ID. All displayed money/quantities including extra displays get data-value unformatted integer, not only enumerated minima. data-status uses API enum not translated Thai. Dynamic row identifier uses original productId/code/orderId. Duplicate child IDs only inside distinct row containers. No random IDs for automation

## Messages / accessibility / layout (DESIGN)

app-message single stable container, role=alert for errors, role=status/aria-live=polite for notices/info; multiple messages within child blocks without duplicate app-message test IDs. Render per-response kind/code on container; SRS operations produce at most one required message here. Preserve checkout notice during redirect until dismissed/next operation; do not flash then disappear. Required Thai strings verbatim per contract. On payFail simulator response display info immediately and keep pending screen. Error refetch should not overwrite error with generic success

Consistent shell with role-specific navigation, page heading, content and message region. Desktop row/table layout, small screens stacked rows keeping label/value pair association and visible actions; admin table can scroll with labeled inputs. Show status text not color only. No fixed overlay hiding controls, no animation required. Loading states must not show empty as settled state. WCAG AA contrast/keyboard/focus and 200% zoom are DESIGN quality checks alongside mandatory DC accessibility. Money labels: ยอดรวมสินค้า, ส่วนลด, ค่าจัดส่ง, ยอดชำระสุทธิ

## Security and test controls

Browser calls only api-server for domain operations and username/password login; accessToken เป็น backend-issued JWT ไม่ใช่ Supabase Auth token. ไม่ใช้ Supabase Auth SDK/login/session refresh; no Supabase table calls/service keys. Token expiry =>login ใหม่โดย cart/stage/order ยังอยู่; UI contract และ sessionStorage behavior เดิม. Token is XSS-sensitive: render messages as text not HTML; no dangerouslySetInnerHTML; do not log token. Test flags for buttons must agree with backend APP_ENV=test; frontend flag alone never enables reset/callback API. Seed credentials not displayed in production UI. API origin/CORS configured explicitly. SPA server must return app shell for each DC URL when refreshed
