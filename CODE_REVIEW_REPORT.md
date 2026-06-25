# รายงานรีวิวโค้ดและ UX — Nutri Smart AI Analyzer
วันที่: 2026-06-20

> **หมายเหตุเรื่องวิธีตรวจ**: ส่วน Backend/Frontend ตรวจโดยอ่านโค้ดจริงทั้งไฟล์ (citation เป็น file:line) ส่วน UX มือถือ/เดสก์ท็อปตรวจจากโค้ด (responsive class, breakpoint, viewport meta) เนื่องจากไม่มีเครื่องมือเปิดเบราว์เซอร์ถ่ายภาพจริง — ได้ทดสอบรันแอป (`next dev`) แล้วยืนยันว่าหน้าแรกโหลดได้ (`GET / 200`) แต่ไม่ได้ไล่คลิกทุกหน้าด้วยตา

---

## 1. สรุปภาพรวม

| ด้าน | สถานะ |
|---|---|
| Backend (FastAPI) | ใช้งานได้ มีช่องโหว่ด้านการรั่วข้อมูล error และ endpoint ไม่มี auth บางจุด |
| Frontend (Next.js) | ใช้งานได้ มีโค้ดซ้ำ/ตายค้างจำนวนมากจากการรีแฟกเตอร์ที่ยังไม่เคลียร์ |
| Mobile UX | โครงสร้างดี (bottom nav, safe area ส่วนใหญ่ถูก) แต่มีจุดบกพร่องเรื่อง zoom/touch target/viewport unit |
| Desktop UX | ใช้งานได้ดี เลย์เอาต์ responsive สมเหตุสมผล |
| ความสอดคล้องของดีไซน์ | หน้าใหม่ (settings) แคบกว่าหน้าเก่าอย่างเห็นได้ชัด ไม่ตรงกับโปรเจกต์ที่เหลือ |

---

## 2. Backend — ปัญหาตามความรุนแรง

### วิกฤต
- `backend/middleware/auth.py:57-59` — คืนข้อความ exception ดิบให้ผู้ใช้เห็นตรง ๆ เสี่ยงรั่ว internal details (เช่น URL Supabase)
- `backend/routers/health_api.py:37-39` — endpoint สถานะระบบไม่มี auth และเผย `database_error` แบบดิบ
- `backend/main.py` ไม่มี global exception handler — router หลายตัว (`food_search.py`, `dashboard.py`, `profile.py`) ไม่มี try/except เลย
- ไฟล์ทดสอบ/ดีบักหลุดเข้า repo: `backend/test_pydantic.py`, `test_pydantic2.py`, `test_query.py`, `test_req.txt`

### ปานกลาง
- Error message จาก AI provider/exception ถูกส่งตรงให้ frontend ในหลาย endpoint (`analyze.py`, `chat.py`, `ai_service.py`)
- การวิเคราะห์ภาพอาหารจะ auto-save เข้า diary ทันทีโดยไม่มี flag ให้ "ดูตัวอย่างก่อนบันทึก" (ต่างจาก `/estimate` ที่มี `save: bool`)
- `food_search.py:37-72` — สูตรเฉลี่ยพลังงาน `(existing + new) / 2` ไม่ใช่ running average ที่ถูกต้อง ทำให้ค่า autocomplete เพี้ยนเมื่อเวลาผ่านไป
- CORS origins hardcode ในโค้ดแทนอ่านจาก env
- `DEFAULT_USER_ID = "default"` ประกาศซ้ำหลายไฟล์

### เล็กน้อย
- ปนกันระหว่าง `print()` กับ `logger` ในโค้ด notification, คอมเมนต์หลงเหลือจาก commit message, `import httpx` ซ้ำ

---

## 3. Frontend — ปัญหาตามความรุนแรง

### วิกฤต
- `lib/store.ts:18` — สร้าง Supabase client ระดับ module + zustand persist แตะ `localStorage` เสี่ยง hydration mismatch
- `components/profile-page.tsx:84-94` — ฟอร์มโปรไฟล์ตั้งค่าเริ่มต้นจาก prop ครั้งเดียวตอน mount ไม่ sync ใหม่ ถ้าข้อมูลจาก store มาถึงช้า ฟอร์มจะโชว์ค่า default ปลอม (อายุ 28, น้ำหนัก 65) ทับของจริง
- `components/analyzer-dashboard.tsx` — dead code ทั้งไฟล์ และ `handleAnalyze` เป็น `setTimeout` ปลอม ไม่เรียก API จริง
- `app/api/route.ts` + `lib/ai/rag-agent.ts:10` — pipeline AI สำรองที่ไม่มีใครเรียกใช้ และฮาร์ดโค้ด `http://localhost:8000`

### ปานกลาง
- โค้ดซ้ำที่ไม่ถูกลบหลังรีแฟกเตอร์: `NutriChat.tsx` (ซ้ำกับ `ChatBot.tsx` ที่ใช้จริง), `auth-page.tsx` (ซ้ำกับ `auth-pages.tsx` ที่ใช้จริง), `app-sidebar.tsx`+`dashboard-header.tsx` (มี mock user "Somchai Jaidee" ฝังไว้ ไม่ถูกใช้), `disclaimer-page.tsx` (ซ้ำกับ terms-page.tsx)
- `app/(main)/error.tsx:43` — ปุ่มกลับหน้าหลักใช้ `window.location.href` แบบ full reload เสมอ ไม่ใช้ Next.js routing
- `NotificationCenter.tsx:258-275` — ปุ่ม Demo "จำลองการแจ้งเตือน" ที่คอมเมนต์บอกให้ลบก่อนขึ้น production แต่ยังอยู่จริง
- `home-dashboard.tsx:45` — ชื่อ fallback เป็น "องุ่น" (ชื่อเฉพาะ) แทนคำกลาง ๆ ทำให้ทักทายผู้ใช้ใหม่ผิดชื่อ
- `lib/backend-api.ts:199-206` — `console.debug` log backend URL ทุก request แม้ใน production

### เล็กน้อย
- ข้อมูล mock (`MOCK_WEEKLY`, `INSIGHTS` ใน `health-dashboard-page.tsx`) แสดงเหมือนผลวิเคราะห์จริงเมื่อไม่มีข้อมูล
- `lib/test-auth.ts` ไม่ถูกใช้แต่เป็นความเสี่ยงแฝงถ้ามีคนต่อสายเข้า flow auth จริงในอนาคต

---

## 4. UX มือถือ vs เดสก์ท็อป

### มือถือ
- `app/layout.tsx:21-27` ตั้ง `userScalable: false` — ปิด pinch-zoom ทั้งแอป ขัด accessibility (WCAG 1.4.4)
- `app-shell.tsx:196` ใช้ class `pb-safe` แต่ไม่มีนิยาม class นี้ในโปรเจกต์เลย — อาจไม่กันพื้นที่ home-indicator ของ iPhone จริง
- `ChatBot.tsx:117` ใช้ `h-[70vh]` ไม่ใช่ `dvh` — บน iOS Safari แถบ URL ขยับ-หดจะทำให้ความสูงแชทกระตุก (จุดอื่นในแอปอย่าง `app-shell.tsx:91` ใช้ `h-dvh` ถูกแล้ว แต่จุดนี้พลาด)
- ปุ่มลบรายการอาหาร (`food-log-page.tsx:319`, ขนาด 24px) และปุ่มเปลี่ยนสัปดาห์ (`:165,169`, ขนาด 28px) เล็กกว่ามาตรฐาน touch target 44px อาจกดพลาด
- จุดที่ทำถูก: bottom tab bar จริง, `pb-24` กันเนื้อหาไม่ให้โดน nav บัง, ปุ่มกล้อง/ฟอร์มใช้ขนาดเหมาะกับนิ้ว, `inputMode="decimal"` ถูกต้อง

### เดสก์ท็อป
- Sidebar จริง (`app-shell.tsx`) ใช้งานได้ดี, เลย์เอาต์กริด responsive (`grid-cols-1 lg:grid-cols-3`) ไม่มี overflow
- ไม่พบปัญหาการใช้งานเชิงโครงสร้างบนเดสก์ท็อป — จุดที่พบเป็นเรื่องโค้ดซ้ำที่ไม่ถูกใช้ ไม่กระทบผู้ใช้จริง

### ความสอดคล้องของดีไซน์ (จุดที่ตรงคำถาม "ตรงกับโปรเจคมั้ย")
- หน้าเก่า (dashboard, health, food-log, profile) ใช้ `max-w-2xl lg:max-w-6xl` + `p-4` สม่ำเสมอ
- หน้าใหม่ (notification/privacy/help/terms settings) ใช้ `max-w-xl` เท่านั้น ไม่มี `lg:` variant และไม่มี `p-4`/`pb-*` ปิดท้าย — **บนจอเดสก์ท็อปหน้าตั้งค่าจะดูแคบและไม่เข้าชุดกับหน้าอื่นในแอปเดียวกัน**

---

## 5. ข้อเสนอแนะเร่งด่วน (เรียงตามผลกระทบ)
1. ลบไฟล์ดีบัก/dead code: `backend/test_*.py`, `test_req.txt`, `NutriChat.tsx`, `auth-page.tsx`, `app-sidebar.tsx`, `dashboard-header.tsx`, `disclaimer-page.tsx`, `analyzer-dashboard.tsx`
2. ใส่ auth ให้ `health_api.py` และเปลี่ยนทุก endpoint ที่คืน `str(e)` ตรง ๆ ให้ log แล้วคืนข้อความทั่วไป
3. แก้ `profile-page.tsx` ให้ sync ฟอร์มกับ `initialData` ที่มาช้า (เช่นใช้ `useEffect` หรือ `key` reset)
4. ปรับ `max-w-xl` → `max-w-2xl lg:max-w-6xl` ในหน้า settings ทั้ง 4 หน้าให้เข้าชุดกับหน้าอื่น
5. เปิด pinch-zoom กลับ (`userScalable: true` หรือเอา `maximumScale` ออก) และเปลี่ยน `h-[70vh]` → `h-[70dvh]` ใน ChatBot
6. ขยายปุ่มลบ/ปุ่มเปลี่ยนสัปดาห์ใน food-log ให้ถึง 44px touch target
