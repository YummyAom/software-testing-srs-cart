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
npm run e2e         # ทุกครั้งที่จะรันเทสต์
npm run e2e:stop    # หยุด Supabase local เมื่อเลิกใช้
```

`npm run e2e` เปิด Supabase, API และ frontend ให้เอง แล้วปิด API กับ frontend เมื่อรันจบ ไม่ต้องเปิด terminal อื่น

ส่งค่าให้ Playwright ต่อท้าย `--` ได้:

```bash
npm run e2e -- checkout.spec     # เฉพาะไฟล์
npm run e2e -- --ui              # เปิดหน้าต่าง UI mode
npm run e2e -- --headed          # เปิด browser ให้เห็น
```

ดูรายงานรอบล่าสุด: `cd e2e && npm run report`

## `e2e:setup` ทำอะไร

1. เช็ค Node และ Docker
2. ติดตั้ง dependency ของ root, `frontend`, `e2e` และ Chromium
3. เปิด Supabase local (ครั้งแรกโหลด image หลายนาที) โดยใช้พอร์ต 55320-55329
4. สร้าง `backend/.env.test` จาก `supabase status` และสุ่ม token กับรหัสผ่าน ถ้ามีไฟล์นี้อยู่แล้วจะไม่เขียนทับ
5. สร้างบัญชี `cus_normal`, `cus_prime`, `admin01`

`backend/.env.test` อยู่ในเครื่องใครเครื่องมัน ไม่อยู่ใน git

## การกัน database กลาง

เทสต์จะหยุดทันที ถ้า:

- ไม่มี `backend/.env.test`
- `APP_ENV` ไม่ใช่ `test` หรือ Supabase URL ไม่ได้ชี้มาที่เครื่องนี้
- `API_PORT` ไม่ใช่ 3001 เพราะ frontend เรียกพอร์ต 3001 เสมอ
- มีโปรแกรมอื่นใช้พอร์ต 3001 หรือ 5173 อยู่

ทุกเทสต์เรียก `/test/reset` ก่อนเริ่ม และ `workers: 1` เพราะใช้ฐานข้อมูลเดียวกัน

## แก้ปัญหา

| อาการ | วิธีแก้ |
| :--- | :--- |
| `Docker is not running` | เปิด Docker Desktop หรือ `colima start` แล้วรันใหม่ |
| `port 3001` หรือ `5173 is already in use` | ปิด backend หรือ frontend ที่เปิดค้างไว้ |
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
