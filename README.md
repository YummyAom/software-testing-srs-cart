# SRS-CART-002 — Implementation Design Pack

เอกสารออกแบบสำหรับ term project: Multi-User Shopping Cart, Checkout & Store Administration ตาม SRS v1.8 และ API Design เดิม **ยังไม่มี application implementation**

## อ่านก่อน implement

1. [SRS ต้นฉบับ](SRS-CART-002_v1.8_pubs.md) — แหล่ง expected behavior หลัก; ส่วน 10 เป็นหมายเหตุผู้สอน ไม่ใช่ feature เพิ่มเติม
2. [API Design ต้นฉบับ](API%20Design.xlsx) และ [ฉบับอ่านได้](docs/sources/api-design-extracted.md)
3. [Master spec](docs/spec/00-master.md) — scope, user stories, implementation/testing decisions
4. [ข้อขัดแย้งและ SOI](docs/spec/01-decisions-and-gaps.md) — อ่านก่อนนำ design decisions ไปตีความว่าเป็น SRS
5. [Backend](docs/spec/02-backend.md), [API contract](docs/spec/03-api-contract.md), [Database](docs/spec/04-database.md)
6. [Frontend](docs/spec/05-frontend.md), [Testing](docs/spec/06-testing.md), [AI implementation plan](docs/spec/07-implementation-plan.md)
7. [OpenAPI](docs/api/openapi.json), [schema proposal](docs/database/schema.sql), [traceability](docs/spec/08-traceability.md), [pure domain rules](docs/spec/09-domain-rules.md)

## สถานะและลำดับอำนาจ

- SRS เป็น Draft รอผู้สอนทบทวน แต่ design pack นี้ใช้ v1.8 เป็น baseline ตามคำขอ
- SRS > API workbook เมื่อขัดกัน > design pack สำหรับรายละเอียดที่ต้นฉบับไม่ได้กำหนด
- `SRS` = ข้อกำหนดต้นฉบับ; `API` = workbook; `DESIGN` = ข้อเสนอเพื่อ implement ไม่ใช่ requirement ของผู้สอน; `SOI` = จุดที่ต้องบันทึกและไม่ใช้เป็น SRS test oracle
- Seam ที่เสนอ: HTTP interface + real test database เป็นหลัก; pure functions และ browser UI เป็น seams เพิ่มที่ DC บังคับ ยังไม่ได้รับคำยืนยันแยกจากผู้ใช้
- ไม่มีการแก้ไฟล์ต้นฉบับ ไม่มีการเพิ่ม registration, refund, shipping tracking หรือ CRUD สร้างสินค้า/คูปอง
- ชุดนี้ไม่ได้ผ่าน runtime tests เพราะยังไม่มีแอป; การตรวจเอกสาร/contract ไม่ใช่หลักฐานว่า implementation ถูกต้อง

## เทคโนโลยีที่เสนอ (DESIGN)

TypeScript strict, Node.js LTS, Fastify, Supabase (PostgreSQL + Auth), React + Vite + React Router, Vitest และ Playwright. เลือก monolith เดียวและ process เดียวตามสมมติฐานคำสั่งเรียงลำดับของ SRS; ห้ามตีความว่า deploy หลาย instance ได้

## GitHub workflow

ใช้ GitHub Issues ใน `YummyAom/software-testing-srs-cart` และ label `ready-for-agent` สำหรับ implementation handoff. อ่าน [tracker](docs/agents/issue-tracker.md) และ [domain glossary](CONTEXT.md). รายละเอียดออกแบบพร้อมให้ implement ตามแผน แต่ SOI และการยืนยัน seam ต้องยังมองเห็นได้ ไม่ถือว่าปิดโดยอัตโนมัติ
