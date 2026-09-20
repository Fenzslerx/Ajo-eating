# DogMeal — Frontend Design Handoff

ออกแบบเฉพาะ frontend/mobile UI ให้เชื่อมกับโครงสร้างและ API เดิม ห้ามเปลี่ยนชื่อ table, field, route หรือ RLS

## Product

DogMeal คือ PWA ภาษาไทยสำหรับคนในบ้านร่วมกันบันทึกว่าน้องหมากินอาหารหมดหรือไม่

- ผู้ใช้หลัก: เจ้าของหมา/คนในครอบครัว
- อุปกรณ์หลัก: มือถือ 360–430px
- บุคลิก: อบอุ่น, สบายใจ, สะอาด, ใช้งานได้ด้วยมือเดียว
- สีหลัก: `#f97316` (orange), พื้นหลัง `#fffaf5`, ตัวอักษร `#3f3028`
- ฟอนต์: `Noto Sans Thai` หรือ system sans-serif
- ใช้ emoji ได้เป็น placeholder แต่ต้องรองรับรูปหมาจริง

## Routes ที่ต้องออกแบบ

| Route | เป้าหมาย | ข้อมูลหลัก | CTA หลัก |
| --- | --- | --- | --- |
| `/` | ดูว่าวันนี้หมากินแล้วหรือยัง | dogs, schedules, logs วันนี้ | บันทึก กินหมด / กินบางส่วน / ไม่กิน |
| `/log` | เพิ่มหรือแก้ไขบันทึกมื้อ | dogs, schedules, logs | บันทึกมื้ออาหาร |
| `/history` | ค้นหาบันทึกย้อนหลัง | logs + filter วัน/หมา/สถานะ | เปิดรายละเอียด log |
| `/stats` | ดูนิสัยการกิน | logs 7/30 วัน | เปลี่ยนช่วงเวลา/หมา |
| `/settings` | ตั้งค่าหมา, ตารางมื้อ, สมาชิก | dogs, schedules, dog_members | เพิ่มมื้อ/จัดการสมาชิก |
| `/login` | เข้าสู่ระบบด้วย Magic Link | email | ส่งลิงก์เข้าสู่ระบบ |

## Shared UI states

- Loading: skeleton card 2–3 ใบ ไม่ใช้ spinner เต็มหน้า
- Empty dogs: ภาพประกอบหมา + ข้อความ “ยังไม่มีน้องหมา” + CTA เพิ่มหมา
- Empty schedule: แนะนำเพิ่มมื้อแรก
- Offline: แสดง pill “ออฟไลน์ · บันทึกจะส่งอัตโนมัติ”
- Error: toast ภาษาไทยที่มีปุ่มลองใหม่
- Success: toast สีเขียว สั้น และหายเอง

## Mobile navigation

Bottom navigation fixed: วันนี้, บันทึก, สถิติ, ตั้งค่า

- ขนาดแตะอย่างน้อย 44×44px
- เว้น safe area ด้านล่าง
- หน้าฟอร์มมี CTA หลักติดล่างได้ แต่ไม่บัง bottom navigation

## Data contract (Supabase)

### `dogs`

```ts
type Dog = { id: string; name: string; photo: string | null; owner_id: string }
```

### `schedules`

```ts
type Schedule = { id: string; dog_id: string; label: string; time: string }
```

### `logs`

```ts
type MealLog = {
  id: string; dog_id: string; schedule_id: string | null; at: string;
  status: "finished" | "partial" | "none";
  amount_g: number | null; food: string | null; note: string | null;
  photo: string | null; by: string;
}
```

### `dog_members`

```ts
type DogMember = { dog_id: string; user_id: string; role: "owner" | "member" }
```

## Interaction rules

1. Quick log จากหน้า `/` สร้าง `logs` ด้วย `dog_id`, `schedule_id`, `status` และเวลาปัจจุบัน
2. Form `/log` รองรับ status, amount_g, food, note, photo และเวลาย้อนหลัง
3. รูปเก็บที่ Storage bucket `dog-photos` โดย path ต้องเริ่มด้วย `{dog_id}/`
4. Realtime `logs` อาจเปลี่ยนจากผู้ใช้คนอื่น ต้อง refresh card/list โดยไม่รบกวนสิ่งที่ผู้ใช้กำลังพิมพ์
5. Offline creation อยู่ IndexedDB และ sync เมื่อออนไลน์; ห้ามแสดงว่า sync สำเร็จก่อน Supabase ตอบสำเร็จ
6. RLS ทำให้ทุก query เห็นเฉพาะหมาที่ผู้ใช้เป็น member — อย่าแสดง UI ที่สัญญาว่าจะเห็นข้อมูลของหมาอื่น

## Components ที่แนะนำ

- `DogHeader`: รูป, ชื่อ, สถานะมื้อล่าสุด
- `MealCard`: เวลา, ชื่อมื้อ, state ยังไม่บันทึก/บันทึกแล้ว, quick actions
- `StatusChip`: finished/partial/none พร้อมสีที่ไม่พึ่งสีเพียงอย่างเดียว
- `MealLogForm`: form แบบ bottom sheet หรือ full page
- `PhotoPicker`: preview, replace, remove
- `DateFilter`: วันนี้, 7 วัน, กำหนดเอง
- `MemberRow`: avatar, email/name, role, action menu (owner only)
- `OfflineBanner` และ `SyncToast`

## Accessibility

- ทุกปุ่มสถานะต้องมี label ชัดเจน เช่น “บันทึกว่ากินหมด”
- สี status: finished=เขียว, partial=ส้ม, none=แดง พร้อมข้อความและไอคอน
- contrast ตัวอักษรอย่างน้อย WCAG AA
- input และรูปภาพมี label/alt ภาษาไทย

## Files ที่เชื่อมอยู่แล้ว

- `app/page.tsx` — หน้าแรก
- `app/log/page.tsx` — form CRUD logs
- `app/stats/page.tsx` — สถิติ
- `app/settings/page.tsx` — ตารางมื้อและแจ้งเตือน
- `lib/supabase/client.ts` — browser client
- `lib/offline-queue.ts` — offline queue
- `supabase/migrations/20260920000000_initial_schema.sql` — schema/RLS จริง
