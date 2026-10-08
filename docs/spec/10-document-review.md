# Design-pack review record

วันที่: 2026-10-08. Scope: documents only, no application implementation.

## Performed

- อ่าน SRS ทั้งฉบับและทั้งสอง sheets ของ API Design โดยไม่แก้ต้นฉบับ
- แยก workbook inconsistencies, selected design decisions และ unclarified SOI; Supabase เป็น database ตามผู้ใช้
- จัดทำ trace inventory: 105 leaf FRs, 17 DC entries (DC-1 grouped), 23 AC IDs
- ตรวจ OpenAPI JSON parse, 102 internal schema references resolve, unique operation IDs, all18 OPs +2 support endpoints, checkout success201 และ test gateway auth override
- ตรวจ relative Markdown links ใน design pack ว่า target files มีอยู่
- ตรวจเนื้อหาแยก live cart valuation/immutable snapshots, no-error mutation, non-expiring reservation, cancel adding current stock, no duplicate stock deduction, per-Customer ownership และ RLS direct-client denial design

## Not performed / not claimed

- ไม่เรียก subagent (session ไม่มีเครื่องมือดังกล่าว); ตรวจทานใน session เดียว
- ไม่ได้ติดตั้ง application dependencies, เขียน application source หรือรัน application tests
- ไม่ได้สร้าง/link/provision Supabase project, บัญชี Auth, database tables หรือรัน migration
- ไม่ได้ execute SQL หรือ validate DDL กับ PostgreSQL จริง; schema.sql เป็นข้อเสนอสำหรับ migration review
- ไม่ได้ validate OpenAPI ด้วย external standards validator; JSON/reference checks ไม่เท่ากับ full schema conformance proof
- ยังไม่มีคำยืนยัน seam แยก และ SOI ยังไม่ได้รับ clarification จากผู้สอน

## Authentication design amendment

ผู้ใช้เลือก backend-owned auth แทน Supabase Auth: backend spec, master/decisions, PostgreSQL schema proposal, OpenAPI, frontend auth notes, testing และ implementation plan ถูกปรับให้สอดคล้องกัน. app_users ใช้ own UUID/password_hash, Argon2id และ backend-issued HS256 JWT; Supabase เหลือ PostgreSQL. Token policies เป็น DESIGN และไม่เปลี่ยน SRS reservation lifetime. แก้เฉพาะเอกสาร ไม่แก้ source/test files ที่กำลังทำงานอยู่ และไม่ execute migration หรือ implement auth ในรอบนี้

เอกสาร SQL/OpenAPI เป็น design artifacts สำหรับ implementation รอบถัดไป ไม่ใช่ code ของแอปที่ deploy แล้ว. ผู้ implement ต้องทดสอบ migration และ runtime contract ก่อนกล่าวว่าพร้อมใช้งาน
