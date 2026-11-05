# E2E (Playwright)

รัน E2E ของทุกคนบน Supabase local ในเครื่องตัวเอง ไม่แตะ database กลางของทีม

## สิ่งที่ต้องติดตั้งเอง

| OS | Docker | Node |
| :--- | :--- | :--- |
| Windows | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) (เปิดโปรแกรมค้างไว้) | [Node 22](https://nodejs.org) |
| macOS | [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) หรือ colima | [Node 22](https://nodejs.org) |
| Linux | [Docker Engine](https://docs.docker.com/engine/install/) และให้ user รัน `docker` ได้โดยไม่ต้อง sudo | [Node 22](https://nodejs.org) |

Supabase CLI ไม่ต้องลงเอง สคริปต์เรียกผ่าน `npx`

## รัน

รันจาก root ของ repo:

```bash
npm run e2e:setup   # ครั้งแรก หรือหลังจาก pull แล้ว dependency เปลี่ยน
npm run test:unit   # Unit
npm run test:api    # API
npm run e2e         # E2E
npm run e2e:report  # เปิดรายงาน E2E รอบล่าสุด
npm run e2e:stop    # หยุด Supabase local เมื่อเลิกใช้
```

คำสั่งเหล่านี้หาพอร์ตว่างเอง ถ้าพอร์ตไม่ว่างจะไปพอร์ตถัดไป และพิมพ์พอร์ตที่ใช้จริงก่อนเริ่มเทสต์:

```text
==> Ports in use
    API           http://localhost:3002  (3001 was busy)
    Frontend      http://localhost:5174  (5173 was busy)
```

| คำสั่ง | พอร์ตเริ่มต้น |
| :--- | :--- |
| `test:unit` | ไม่ใช้พอร์ต |
| `test:api` | API 3001 |
| `e2e` | API 3001, Frontend 5173 |
| `--ui` ของ Vitest | 51204 |
| `--ui` ของ Playwright | 8080 |
| `e2e:report` | 9323 |

Supabase local ใช้พอร์ตตายตัว 55320-55329 ตาม `supabase/config.toml`

`test:api` และ `e2e` เปิด Supabase, API และ frontend ให้เอง แล้วปิด API กับ frontend เมื่อรันจบ ไม่ต้องเปิด terminal อื่น ห้ามรันพร้อมกัน เพราะใช้ฐานข้อมูลเดียวกัน

ส่งค่าเพิ่มต่อท้าย `--` ได้:

```bash
npm run test:unit -- --ui        # เปิดหน้าเว็บ Vitest
npm run test:api -- --ui         # เปิดหน้าเว็บ Vitest
npm run e2e -- --ui              # เปิดหน้าเว็บ Playwright
npm run e2e -- checkout.spec     # เฉพาะไฟล์
npm run e2e -- --headed          # เปิด browser ให้เห็น
```

## `e2e:setup` ทำอะไร

1. เช็ค Node และ Docker
2. ติดตั้ง dependency ของ root, `frontend`, `e2e` และ Chromium
3. เปิด Supabase local (ครั้งแรกโหลด image หลายนาที) โดยใช้พอร์ต 55320-55329
4. สร้าง `backend/.env.test` จาก `supabase status` และสุ่ม token กับรหัสผ่าน ถ้ามีไฟล์นี้อยู่แล้วจะไม่เขียนทับ
5. สร้างบัญชี `cus_normal`, `cus_prime`, `admin01`

`backend/.env.test` อยู่ในเครื่องใครเครื่องมัน ไม่อยู่ใน git

## การกัน database กลาง

`test:api` และ `e2e` จะหยุดทันที ถ้าไม่มี `backend/.env.test`, `APP_ENV` ไม่ใช่ `test` หรือ Supabase URL ไม่ได้ชี้มาที่เครื่องนี้

ระบบส่งพอร์ต API ให้ frontend ที่เปิดในรอบนั้นโดยตรง จึงไม่ยิงไป server อื่นที่เปิดค้างไว้

ทุกเทสต์ E2E เรียก `/test/reset` ก่อนเริ่ม และ `workers: 1` เพราะใช้ฐานข้อมูลเดียวกัน

## แก้ปัญหา

| อาการ | วิธีแก้ |
| :--- | :--- |
| `Docker is not running` | เปิด Docker Desktop หรือ `colima start` แล้วรันใหม่ |
| `http://127.0.0.1:3001/products is already used` | รันผ่าน `npm run e2e` แทน `cd e2e && npm test` ซึ่งใช้พอร์ตคงที่ |
| `backend/.env.test not found` | รัน `npm run e2e:setup` |
| Linux ขึ้นว่า Chromium ขาด library | `cd e2e && sudo npx playwright install-deps chromium` |
| ข้อมูลใน Supabase local เพี้ยน | `npm run db:local:reset` แล้วรัน `npm run e2e` |

## อัดเทสต์ใหม่ด้วย codegen

เปิด API ด้วย `npm run dev:test` และ frontend ด้วย `cd frontend && npm run dev` ก่อน แล้วรัน:

```bash
cd e2e
npm run reset      # คืนข้อมูลเป็น seed
npm run codegen    # เปิด browser สำหรับอัดการคลิกเป็นโค้ด
```

หลังวางโค้ด ให้เปลี่ยนรหัสผ่านที่ถูกอัดมาเป็น `PASSWORD.cus_normal`, `PASSWORD.cus_prime` หรือ `PASSWORD.admin01` ห้าม commit รหัสผ่านจริง
