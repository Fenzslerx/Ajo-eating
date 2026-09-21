# Database State Checklist & Verification Guide

ไฟล์นี้ใช้จับคู่ผลลัพธ์จาก query ใน [`scripts/verify-db-state.sql`](file:///c:/Users/Gladeyejtp/OneDrive/เอกสาร/ChatGPT/Ajo%20eating/scripts/verify-db-state.sql) เพื่อตรวจสอบสถานะความจริงบน Supabase Cloud โดยไม่ต้องคาดเดา

---

## 1. การตรวจ Columns (`information_schema.columns`)

### ถ้าเห็นแบบนี้ แปลว่ายังไม่ได้รัน Migration ไหน:
- **ถ้าตาราง `public.dogs` ไม่มีคอลัมน์ `breed` หรือ `birthdate`**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000007_cleanup_and_fix_shared_access_rls.sql`** (Part 7 บรรทัด 160-161)
  - **ผลกระทบ**: ถ้าโค้ด client ตัวไหนส่ง `.select("...,breed,birthdate")` จะเกิด error `42703 (undefined column)` ทันที
- **ถ้าไม่มีตาราง `public.notifications`**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000004_storage_and_notifications_cron.sql`** (บรรทัด 70)
- **ถ้ายังมีตาราง `public.dog_invites` อยู่ในฐานข้อมูล**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000006` หรือ `20260921000007`** (ทั้งสองไฟล์มีคำสั่ง `drop table if exists public.dog_invites cascade;`)

### ตาราง Columns ที่คาดหวังเมื่อรันครบถึง Migration 000007:
| Table Name | Column Name | Expected Data Type | Migration Source |
| :--- | :--- | :--- | :--- |
| `dogs` | `id` | `uuid` | 000000_initial_schema.sql |
| `dogs` | `name` | `text` | 000000_initial_schema.sql |
| `dogs` | `photo` | `text` | 000000_initial_schema.sql |
| `dogs` | `owner_id` | `uuid` | 000000_initial_schema.sql |
| `dogs` | `created_at` | `timestamp with time zone` | 000000_initial_schema.sql |
| `dogs` | `breed` | `text` | **20260921000007_cleanup_and_fix_shared_access_rls.sql** |
| `dogs` | `birthdate` | `text` | **20260921000007_cleanup_and_fix_shared_access_rls.sql** |
| `logs` | `id` | `uuid` | 000000_initial_schema.sql |
| `logs` | `dog_id` | `uuid` | 000000_initial_schema.sql |
| `logs` | `schedule_id` | `uuid` | 000000_initial_schema.sql |
| `logs` | `at` | `timestamp with time zone` | 000000_initial_schema.sql |
| `logs` | `status` | `USER-DEFINED` (`log_status`) | 000000_initial_schema.sql |
| `logs` | `amount_g` | `numeric` | 000000_initial_schema.sql |
| `logs` | `food` | `text` | 000000_initial_schema.sql |
| `logs` | `note` | `text` | 000000_initial_schema.sql |
| `logs` | `photo` | `text` | 000000_initial_schema.sql |
| `logs` | `by` | `uuid` | 000000_initial_schema.sql |
| `logs` | `created_at` | `timestamp with time zone` | 000000_initial_schema.sql |
| `schedules` | `id` | `uuid` | 000000_initial_schema.sql |
| `schedules` | `dog_id` | `uuid` | 000000_initial_schema.sql |
| `schedules` | `label` | `text` | 000000_initial_schema.sql |
| `schedules` | `time` | `time without time zone` | 000000_initial_schema.sql |
| `schedules` | `created_at` | `timestamp with time zone` | 000000_initial_schema.sql |
| `dog_members` | `dog_id` | `uuid` | 000000_initial_schema.sql |
| `dog_members` | `user_id` | `uuid` | 000000_initial_schema.sql |
| `dog_members` | `role` | `text` หรือ `USER-DEFINED` | 000005_role_management_and_invites.sql |
| `dog_members` | `created_at` | `timestamp with time zone` | 000000_initial_schema.sql |
| `notifications` | `id` | `uuid` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `dog_id` | `uuid` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `user_id` | `uuid` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `meal_key` | `text` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `schedule_id` | `uuid` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `message` | `text` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `is_read` | `boolean` | 000004_storage_and_notifications_cron.sql |
| `notifications` | `created_at` | `timestamp with time zone` | 000004_storage_and_notifications_cron.sql |

---

## 2. การตรวจ RLS Policies (`pg_policies`)

### ถ้าเห็นแบบนี้ แปลว่ายังไม่ได้รัน Migration ไหน:
- **ถ้าเห็น Policy ชื่อ `"members can view dogs"`, `"members view schedules"`, `"members view logs"`, `"caretakers and owners add logs"`**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000006` หรือ `20260921000007`** (ตกค้างอยู่ที่ Migration `000000` - `000005`)
  - **ผลกระทบ**: user ที่ login ด้วยอีเมลอื่นที่ไม่ใช่ owner/member ของน้องหมาจะไม่เห็นข้อมูลเลย (RLS กรองออกหมด)
- **ถ้าเห็น Policy ชื่อ `"authenticated view dogs"` แต่ค่า `qual` เป็น `(auth.role() = 'authenticated'::text)`**:
  - **ความหมาย**: **รันถึง Migration `20260921000006` แล้ว แต่ยังไม่ได้รัน `20260921000007`**
- **ถ้าเห็น Policy ชื่อ `"authenticated view dogs"` และค่า `qual` เป็น `(auth.uid() IS NOT NULL)`**:
  - **ความหมาย**: **รัน Migration `20260921000007_cleanup_and_fix_shared_access_rls.sql` สมบูรณ์แล้ว**
- **ถ้าบน `storage.objects` ยังเห็น Policy `"members read dog photos"` หรือ `"members upload dog photos"`**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000006` หรือ `20260921000007`** ทำให้รูปภาพติด RLS ตรวจความเป็นสมาชิก

### รายชื่อ Policy ที่ต้องมีเมื่อรัน Migration 000007 สำเร็จ (ทั้งหมดต้องใช้ `auth.uid() IS NOT NULL`):
- `public.dogs`:
  - `authenticated view dogs` (`SELECT`)
  - `authenticated insert dogs` (`INSERT`)
  - `authenticated update dogs` (`UPDATE`)
  - `authenticated delete dogs` (`DELETE`)
- `public.schedules`:
  - `authenticated view schedules` (`SELECT`)
  - `authenticated insert schedules` (`INSERT`)
  - `authenticated update schedules` (`UPDATE`)
  - `authenticated delete schedules` (`DELETE`)
- `public.logs`:
  - `authenticated view logs` (`SELECT`)
  - `authenticated insert logs` (`INSERT`)
  - `authenticated update logs` (`UPDATE`)
  - `authenticated delete logs` (`DELETE`)
- `public.dog_members`:
  - `authenticated view dog_members` (`SELECT`)
  - `authenticated manage dog_members` (`ALL`)
- `storage.objects`:
  - `authenticated read photos` (`SELECT`)
  - `authenticated upload photos` (`INSERT`)
  - `authenticated update photos` (`UPDATE`)
  - `authenticated delete photos` (`DELETE`)

---

## 3. การตรวจ Database Functions (`pg_proc`)

### ถ้าเห็นแบบนี้ แปลว่ายังไม่ได้รัน Migration ไหน:
- **ถ้ายังมีฟังก์ชัน `create_invite_link`, `accept_invite`, `revoke_invite`, `get_dog_invites`**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000006` หรือ `20260921000007`** (ทั้งสอง migration มีคำสั่ง `drop function` ชัดเจน)
- **ถ้าไม่มีฟังก์ชัน `get_app_users()`**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000006_shared_access_all_users.sql`** (Part 6 บรรทัด 175)
- **ถ้าฟังก์ชัน `create_dog` ยังมี argument `(dog_name text, dog_breed text, dog_birthdate text)`**:
  - **ความหมาย**: เป็น signature เก่าก่อนการปรับปรุงเป็น `(dog_name text, dog_photo text)` ใน Migration `000003` / `000006`

---

## 4. การตรวจ Storage Buckets (`storage.buckets`)

### สิ่งที่ต้องพบ:
1. `id = 'dog-photos'`, `public = false`
2. `id = 'meal-photos'`, `public = false`

- **ถ้าไม่พบบัคเก็ตทั้งสองนี้**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000004_storage_and_notifications_cron.sql`**

---

## 5. การตรวจ Cron Jobs (`cron.job`)

### สิ่งที่ต้องพบ:
- แถวที่มี `jobname = 'check-missed-meals'`, `schedule = '*/15 * * * *'`, `command = 'select public.check_missed_meals();'`

- **ถ้าไม่มีแถวนี้**:
  - **ความหมาย**: **ยังไม่ได้รัน Migration `20260921000004_storage_and_notifications_cron.sql`** หรือโปรเจกต์ Supabase ยังไม่ได้เปิด Extension `pg_cron`
