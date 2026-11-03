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

```bash
cd e2e
npm test              # รันทุกไฟล์ *.spec.ts
npm run test:ui       # เปิดหน้าต่าง UI mode ไว้ดูทีละขั้น
npm run report        # เปิดรายงานรอบล่าสุด
npm run typecheck
```

ตั้ง `E2E_BASE_URL` ถ้า frontend ไม่ได้อยู่ที่ `http://localhost:5173`

`workers: 1` เพราะทุก test ใช้ฐานข้อมูลเดียวกันและเรียก `/test/reset`
