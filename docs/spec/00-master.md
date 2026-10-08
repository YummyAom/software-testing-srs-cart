# Implementation Specification — SRS-CART-002 v1.8

Baseline: SRS v1.8 + API Design workbook. ประเภทเอกสาร: DESIGN / implementation handoff ไม่ใช่การแก้ SRS. วันที่จัดทำ: 2026-10-08.

## Problem Statement

Customer ต้องมีตะกร้าและออเดอร์แยกกัน ใช้ราคา/สต็อกปัจจุบันและส่วนลดที่ถูกต้อง เข้าสู่การชำระเงินที่กลับมาทำต่อได้หลัง login ใหม่ โดยออเดอร์ที่สร้างแล้วไม่เปลี่ยนตาม Admin. Admin ต้องแก้ราคา สต็อกพร้อมขาย และสถานะสินค้า/คูปองได้โดยไม่ทำลาย snapshot. ทีมต้องได้ข้อกำหนดที่ AI implement และสร้าง automated tests จาก SRS ได้ โดยไม่เดาพฤติกรรมจากแอปที่สร้างขึ้น

## Solution

Web UI และ api-server แบบ persistent monolith ใช้บัญชี seed 2 Customer และ 1 Admin. Customer มี stage ที่ server เป็นเจ้าของ จองสต็อกเมื่อ checkout ชำระผ่าน gateway จำลอง หรือยกเลิกเพื่อคืนสต็อก ส่วน Admin มีเฉพาะการจัดการที่ SRS อนุญาต. จัดทำ contract, schema, transaction rules, UI observability, traceability และ implementation sequence ที่ใช้ร่วมกัน

## User Stories

1. As a Customer, I want to login ด้วยบัญชี seed, so that ฉันเข้าถึงข้อมูลของตัวเองได้
2. As an Admin, I want to login ด้วยบทบาทของบัญชี, so that ฉันจัดการร้านได้ตามสิทธิ์
3. As a user, I want to see รหัสและข้อความเมื่อ login ผิด, so that ฉันทราบว่าคำขอไม่สำเร็จ
4. As a Customer, I want to see เฉพาะสินค้าพร้อมขาย, so that ฉันเลือกสินค้าที่ซื้อได้
5. As a Customer, I want to see ราคา น้ำหนัก และสต็อกพร้อมขาย, so that ฉันตัดสินใจเลือกจำนวนได้
6. As an Admin, I want to see สินค้าทั้งหมดรวมปิดขายและสต็อกศูนย์, so that ฉันจัดการสถานะร้านได้
7. As a new Customer, I want to start ด้วยตะกร้าว่างและ stage ตะกร้า, so that ฉันเริ่มซื้อสินค้าได้
8. As a Customer, I want to add สินค้าใหม่จำนวน 1–10, so that ฉันเก็บสินค้าที่ต้องการซื้อ
9. As a Customer, I want to add สินค้าเดิมแบบบวก quantity, so that ฉันไม่เกิด cart line ซ้ำ
10. As a Customer, I want to be told เมื่อ quantity ไม่ใช่จำนวนเต็ม, so that ฉันแก้ข้อมูลให้ถูกต้อง
11. As a Customer, I want to be told เมื่อจำนวนที่ระบุหรือรวมเกินช่วง, so that ฉันไม่สั่งเกินข้อจำกัด
12. As a Customer, I want to be told เมื่อจำนวนเกินสต็อก, so that ฉันทราบสินค้าคงเหลือ
13. As a Customer, I want to update quantity แบบแทนค่า, so that ฉันปรับความต้องการได้
14. As a Customer, I want to remove ทั้ง cart line แม้สินค้าปิดขาย, so that ฉันเอารายการที่ไม่ต้องการออกได้
15. As a Customer, I want to see ข้อความเมื่อตะกร้าว่างหรือไม่พบรายการที่จะลบ, so that ฉันเข้าใจผลของคำขอ
16. As a Customer, I want to see ราคาปัจจุบันในตะกร้า, so that ฉันเห็นผลจากการแก้ราคาของ Admin
17. As a Customer, I want to see รายการไม่พร้อมขายยังคงอยู่ในตะกร้า, so that ฉันเลือกเอาออกได้เอง
18. As a Customer, I want to see จำนวน cart lines แยกจาก quantity, so that ฉันเข้าใจจำนวนรายการจริง
19. As a Customer, I want to have checkout เปิดเฉพาะเมื่อมีรายการใน stage ตะกร้า, so that ฉันไม่เริ่มชำระเงินในบริบทผิด
20. As a Customer, I want to apply คูปองแบบ case-sensitive, so that ฉันใช้ code ตามที่กำหนด
21. As a Customer, I want to replace คูปองที่ผูกด้วยคูปองใหม่, so that ฉันมีคูปองผูกครั้งละหนึ่งใบ
22. As a Customer, I want to apply คูปองได้แม้ตะกร้าว่างหรือยังไม่ถึงยอดขั้นต่ำ, so that ฉันเตรียมใช้ส่วนลดก่อนซื้อได้
23. As a Customer, I want to receive coupon discount เมื่อคูปองยังใช้ได้และถึงยอดขั้นต่ำ, so that ฉันได้รับสิทธิ์ตามกฎ
24. As a prime Customer, I want to receive ส่วนลดสมาชิกเมื่อไม่มีคูปองที่ใช้ได้, so that ฉันได้รับส่วนลด 5% ปัดลง
25. As a prime Customer, I want to have ส่วนลดไม่ทบกัน, so that ยอดเงินตรงตามกติกา
26. As a Customer, I want to receive notice เมื่อคูปองถูกถอดเฉพาะหลัง checkout ผ่านการตรวจ, so that ฉันเข้าใจส่วนลดที่เปลี่ยน
27. As a Customer, I want to select โซนและความเร็วจัดส่ง, so that ค่าจัดส่งตรงกับคำสั่งซื้อ
28. As a Customer, I want to have shipping คำนวณตามน้ำหนักและระดับสมาชิก, so that ฉันได้ยอดสุทธิที่ถูกต้อง
29. As a Customer, I want to be told ทุก productId ที่ใช้ checkout ไม่ได้, so that ฉันแก้รายการได้ครบ
30. As a Customer, I want to be prevented จาก checkout น้ำหนักเกิน 20,000 กรัม, so that ฉันไม่สร้างออเดอร์ที่ส่งไม่ได้
31. As a Customer, I want to have no data changed เมื่อคำขอถูกปฏิเสธ, so that ฉันแก้และลองใหม่ได้โดยไม่เสียข้อมูล
32. As a Customer, I want to receive orderId ที่ไม่ซ้ำและคงที่, so that ฉันอ้างอิงคำสั่งซื้อได้
33. As a Customer, I want to have order snapshot ราคา ชื่อ จำนวนและยอดเงิน, so that การแก้ข้อมูลภายหลังไม่กระทบออเดอร์เดิม
34. As a Customer, I want to reserve stock เมื่อ checkout, so that สต็อกพร้อมขายสะท้อนการจองจริง
35. As another Customer, I want to be prevented จากใช้สต็อกที่ถูกจองหมด, so that ระบบไม่ขายสต็อกพร้อมขายที่ไม่มี
36. As a Customer, I want to keep cart lines ระหว่างชำระเงิน, so that ฉันกลับไปแก้ได้เมื่อยกเลิก
37. As a Customer, I want to resume ตะกร้า คูปอง stage และ pending order หลัง login ใหม่, so that ฉันทำงานต่อได้
38. As a Customer, I want to keep การจองจนชำระหรือยกเลิกโดยไม่หมดอายุ, so that การออกจากหน้าไม่เปลี่ยนออเดอร์
39. As a Customer, I want to see payment failure พร้อมข้อความที่กำหนด, so that ฉันลองชำระใหม่ได้
40. As a Customer, I want to retry payment ไม่จำกัดโดยไม่คืนสต็อก, so that pending order เดิมยังใช้ต่อได้
41. As a Customer, I want to have cart และคูปองถูกล้างเมื่อชำระสำเร็จ, so that ฉันไม่สั่งรายการเดิมโดยไม่ตั้งใจ
42. As a Customer, I want to see หน้าสำเร็จพร้อม orderId รายการและยอดเงินทุกส่วน, so that ฉันยืนยันผลซื้อได้
43. As a Customer, I want to continue shopping จากหน้าสำเร็จ, so that ฉันเริ่มคำสั่งซื้อใหม่ได้
44. As a Customer, I want to cancel pending checkout, so that ฉันกลับตะกร้าและคืนสต็อกได้
45. As a Customer, I want to keep คูปองที่ใช้ได้เมื่อยกเลิกและไม่คืนคูปองที่ถูกถอด, so that ตะกร้าคงสถานะที่ถูกต้อง
46. As a Customer, I want to receive orderId ใหม่เมื่อ checkout หลังยกเลิก, so that ประวัติออเดอร์ไม่ถูกเขียนทับ
47. As a Customer, I want to see เฉพาะออเดอร์ตัวเองจากใหม่ไปเก่า, so that ฉันค้นหาประวัติได้
48. As a Customer, I want to view รายละเอียด snapshot ของออเดอร์ตัวเอง, so that ฉันตรวจยอดย้อนหลังได้
49. As a Customer, I want to receive ORDER_NOT_FOUND เหมือนกันสำหรับออเดอร์คนอื่นและที่ไม่มี, so that ไม่มีข้อมูลเจ้าของอื่นรั่วไหล
50. As a Customer, I want to have cart mutations ถูกปฏิเสธใน stage ชำระเงินหรือสำเร็จ, so that workflow คงความถูกต้อง
51. As a gateway simulator, I want to have callbacks ถูกปฏิเสธสำหรับออเดอร์ที่ปิดแล้ว, so that ไม่หักหรือคืนสต็อกซ้ำ
52. As an Admin, I want to update ราคาและ/หรือสต็อกพร้อมขาย, so that ฉันปรับร้านได้โดยไม่แก้ snapshot
53. As an Admin, I want to see invalid price/stock fields ทั้งหมดหลังตรวจว่าสินค้ามีอยู่, so that ฉันแก้ฟอร์มได้ครบ
54. As an Admin, I want to set เปิด/ปิดขายและตั้งค่าเดิมได้สำเร็จ, so that ฉันควบคุมการขายได้
55. As an Admin, I want to see คูปองทุกใบพร้อม percent, minSpend และสถานะ, so that ฉันทราบกฎที่มีอยู่
56. As an Admin, I want to enable/disable คูปองโดยมีผลกับ checkout ถัดไปเท่านั้น, so that ออเดอร์ที่สร้างแล้วไม่เปลี่ยน
57. As a user, I want to access URLs โดยตรงและได้หน้าตรง stage, so that refresh และ bookmark ไม่ทำให้ workflow ผิด
58. As a keyboard user, I want to use semantic controls และ labeled inputs, so that ฉันใช้งานได้โดยไม่ต้องใช้เมาส์
59. As a test author, I want to observe outcomes ผ่าน test IDs และ data attributes ที่กำหนด, so that E2E เสถียรและไม่อ่าน hidden implementation
60. As a test author, I want to reset test environment กลับ seed, so that tests เป็นอิสระจากกัน
61. As a test author, I want to test pure functions ตาม signatures เดิม, so that expected values อิง SRS ไม่ใช่ route implementation
62. As a deployment operator, I want to have reset และ gateway buttons ปิดนอก test environment, so that ไม่มี test control ทำลายข้อมูลจริง

## Implementation Decisions

- ใช้ monolith TypeScript ที่แยก domain calculations, application orchestration, persistence adapter และ HTTP interface; frontend ไม่ตัดสิน business rules แทน server
- ใช้ Supabase PostgreSQL ตามคำขอผู้ใช้ โดย backend process เดียวประมวลผลคำสั่งเรียงลำดับ; ไม่รองรับ horizontal scaling ตาม scope
- Stage และ current order reference เก็บต่อ Customer, CartLine มีเอกลักษณ์ต่อ Customer/Product, OrderLine เก็บสำเนา ไม่ใช้ live join แสดงประวัติ
- Checkout/cancel/paySuccess ใช้ transaction เดียว รวม stage, cart, coupon, stock, order และ snapshot
- คง methods/paths และ HTTP status mapping ของ workbook; ทำ schema ที่แน่นอนสำหรับฟิลด์และ enum ที่ workbook ยังไม่กำหนด
- quantity ใช้ชื่อเดียวทั้ง request/response; gateway ไม่บังคับ Customer bearer token เพราะ gateway authentication อยู่นอก scope ของ SRS
- ใช้ Supabase Auth ผ่าน backend login adapter แปลง seeded username เป็น email ภายในและคืน bearer token; ownership จาก verified principal ไม่รับ customerId จาก client; ปิด signup และใช้ state bootstrap read-only เพื่อให้ stage routing ทำงานได้
- มี DB constraints สำหรับ invariant ที่ไม่ขัดกับ SRS และไม่มี upper stock constraint 9,999 ที่ทำให้การคืนสต็อกตาม snapshot ถูกปฏิเสธ
- เก็บ integer บาท/กรัม, floor ใน pure functions, current cart valuation แยกจาก immutable order valuation; เปิด RLS และปิด direct browser access ของ domain tables; backend ใช้ server-only PostgreSQL credentials และ transaction บน connection เดียว
- DC-1 signatures ทั้งหมดคงตามต้นฉบับ; route processing ต้องเรียกผ่าน orchestration ไม่เขียนสูตรซ้ำ
- UI ต้องใช้ URL/test IDs/data attributes ตาม DC-2 และ test-only gateway buttons ตาม DC-3
- บันทึก SOI แยกจาก API/design decisions; ไม่สร้าง SRS expected values สำหรับพฤติกรรมที่ SRS ไม่กำหนด

## Testing Decisions

- เสนอ HTTP interface กับ real temporary database เป็น seam หลัก เพื่อทดสอบ observable responses และ persistence โดยไม่ mock repository หรือ assert call counts
- ยังคง pure-function unit seam และ browser E2E seam ตาม DC ที่บังคับ; ไม่มี seams เพิ่มสำหรับทุกชั้นภายใน
- Seam proposal ยังรอผู้ใช้ยืนยัน; ไม่กล่าวว่าได้รับอนุมัติแล้ว
- ทดสอบ external behavior รวม error precedence, rollback, user isolation, state transitions, immutable snapshots และ seed reset
- ใช้ expected values จาก FR/AC/ตาราง SRS โดยตรง ไม่ derive expected ผ่าน production functions
- ไม่มี test prior art ใน repo เดิม (มีเพียงเอกสารสองไฟล์); ให้ AC-1 ถึง AC-19b เป็น acceptance prior art แทน
- ECT, BVA, Decision Table, pairwise และ FSM ต้องมี case IDs และ traceability; coverage percentage ไม่แทน requirement coverage

## Out of Scope

Registration, reset password, password policy, race-condition support, real gateway/authentication, refunds, cancellation of paid orders, tax, currencies other than THB, creating products/coupons, fulfillment/tracking และ Admin order viewing. ไม่เพิ่ม pagination, image upload, addresses, coupon removal operation หรือ order timeout

## Further Notes

Design pack ไม่ใช่ application และไม่มี runtime test results. รายละเอียด schema/API/UX/testing อยู่ใน companion documents. AI ต้องอ่าน SOI ก่อน implement; เมื่อพบ gap ใหม่ให้บันทึก ไม่ทำให้พฤติกรรมที่เดากลายเป็น expected value ของงานทดสอบ SRS. ใช้ GitHub issue label ready-for-agent เป็น handoff ไม่ใช่หลักฐานว่าผู้สอนอนุมัติ SRS หรือ seams
