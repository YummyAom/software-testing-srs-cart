# Plan: E2E-ADMIN — Admin Products Page (`page-admin-products`) Playwright Tests

## Summary
เขียน `e2e/admin-products.spec.ts` ให้ครอบคลุม TC-01 ถึง TC-25 ตาม `docs/test-design/e2e-admin-products-page-test-design.md` (SRS-CART-002 v1.8: FR-0.2, FR-0.3.2, FR-0.7, FR-1.3, FR-9, AC-10, AC-13, AC-14, AC-16) โดยเพิ่มไฟล์เทสอย่างเดียว ไม่แก้ frontend หรือ backend ใช้รูปแบบเดียวกับ `e2e/cart.spec.ts` คือ reset ใน `beforeEach` และรอ API call ที่ค้างใน `afterEach` (ป้องกัน deadlock ของ `/test/reset`)

## Scenario → Test Mapping

| test() | Steps | Actors |
|---|---|---|
| E2E-ADMIN-1 | TC-01 → TC-02 → TC-03 → TC-04 | admin01 |
| E2E-ADMIN-2 | TC-05 → TC-08 → TC-06 → TC-07 | admin01 |
| E2E-ADMIN-3 | TC-09 … TC-14 (data-driven) | admin01 |
| E2E-ADMIN-4 | TC-15 → TC-16 → TC-17 | admin01 |
| E2E-ADMIN-5a | TC-18, TC-19 | cus_normal (ออเดอร์ pending), cus_prime (ตะกร้า), admin01 |
| E2E-ADMIN-5b | TC-20, TC-22, TC-21 | cus_normal, admin01 |
| E2E-ADMIN-6 | TC-23 → TC-24 → (admin ตรวจ FR-0.7) → TC-25 | cus_normal, admin01, guest |

## จุดที่ปรับจากเอกสาร
- TC-18 กับ TC-19 ใช้ Customer คนละคน: Customer ที่มีออเดอร์ `รอชำระเงิน` อยู่ stage ชำระเงิน จึงเปิด `/cart` ไม่ได้ (DC-2.13)
- TC-08 (reload) รันต่อจาก TC-05 ทันที เพื่อตรวจค่าที่เพิ่งบันทึก
- TC-24 เปิด `/products` ด้วย URL เพราะ `/admin/products` แสดงเมนู Admin เสมอ (`AppShell role="admin"`) จึงไม่มี `nav-products`

## Files to Change

| File Path | Action | Description |
|---|---|---|
| `e2e/admin-products.spec.ts` | CREATE | 7 test / 25 step |

## Validation & Test Plan
- `cd e2e && npm run typecheck` → 0 errors ✔
- `npx playwright test admin-products.spec.ts` → 7/7 passed (รัน 2 รอบติด) ✔
- `npx playwright test` (ทั้ง suite) → spec ใหม่ผ่านทั้งหมด แต่ spec เดิม `checkout.spec.ts` / `order-detail.spec.ts` fail บางรอบ (ดูรายงานในแชท ยังไม่ได้แก้)
