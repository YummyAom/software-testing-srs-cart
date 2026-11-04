# E2E (Playwright)

แยกเป็น package ของตัวเอง ไม่อยู่ใน npm workspaces และไม่อยู่ใน typecheck ของ root

## ติดตั้งครั้งแรก

```bash
cd e2e
npm install
npx playwright install chromium
```

## รัน

ต้องเปิด 2 อย่างก่อน:

1. backend ที่ `localhost:3001` ด้วย `APP_ENV=test` (ดู "Local Supabase for tests" ใน `backend/README.md` ของ branch `feat/Nissorn-local-supabase`)
2. frontend ที่ `localhost:5173` (`cd frontend && npm run dev`)

test อ่าน `TEST_RESET_TOKEN` และ `SEED_PASSWORD_*` จาก `backend/.env.test` (ไฟล์นี้ไม่อยู่ใน git) ทุก test เรียก `/test/reset` ก่อน และจะหยุดทันทีถ้า reset ไม่ได้ 200

```bash
cd e2e
npm test              # รันทุกไฟล์ *.spec.ts
npm run test:ui       # เปิดหน้าต่าง UI mode ไว้ดูทีละขั้น
npm run report        # เปิดรายงานรอบล่าสุด
npm run typecheck
npm run reset         # คืนข้อมูลเป็น seed ก่อนอัดด้วย codegen
npm run codegen       # เปิด browser สำหรับอัดการคลิกเป็นโค้ด
```

หลังวางโค้ดจาก codegen ให้เปลี่ยนรหัสผ่านที่ถูกอัดมาเป็น `PASSWORD.cus_normal`, `PASSWORD.cus_prime` หรือ `PASSWORD.admin01` ห้าม commit รหัสผ่านจริง

ตั้ง `E2E_BASE_URL` ถ้า frontend ไม่ได้อยู่ที่ `http://localhost:5173`

`workers: 1` เพราะทุก test ใช้ฐานข้อมูลเดียวกันและเรียก `/test/reset`
