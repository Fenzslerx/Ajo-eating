"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { MealLogForm, type MealLogFormValues } from "@/components/meal-log-form"
import { useAppStore } from "@/lib/app-store"
import { isSameBangkokDay, getLogMealKey } from "@/lib/meal-utils"

function LogFormContainer() {
  const { dogs, schedules, logs, addLog, updateLog, isOnline, getUserRole } = useAppStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const queryDogId = searchParams.get("dog")

  function handleSubmit(values: MealLogFormValues) {
    const role = getUserRole(values.dogId)
    if (role === "viewer") {
      toast.error("คุณมีสิทธิ์เข้าดูอย่างเดียว (Viewer) ไม่สามารถบันทึกได้")
      return
    }

    const nowIso = new Date().toISOString()
    const nowDate = new Date()

    // Find schedule for this meal if exists (e.g. morning/noon/evening)
    const dogSchedules = schedules.filter((s) => s.dog_id === values.dogId)
    const matchingSchedule = dogSchedules.find((s) => {
      if (values.mealType === "morning" && s.label.includes("เช้า")) return true
      if (values.mealType === "noon" && (s.label.includes("เที่ยง") || s.label.includes("กลางวัน"))) return true
      if (values.mealType === "evening" && (s.label.includes("เย็น") || s.label.includes("ค่ำ"))) return true
      return false
    })

    // Check if user already logged for this same meal period today -> update instead of duplicate
    const existingLog = logs.find(
      (l) =>
        l.dog_id === values.dogId &&
        isSameBangkokDay(l.at, nowDate) &&
        getLogMealKey(l) === values.mealType
    )

    if (existingLog) {
      updateLog(existingLog.id, {
        dog_id: values.dogId,
        schedule_id: matchingSchedule?.id ?? existingLog.schedule_id,
        status: values.status,
        amount_g: values.amountG ? Number(values.amountG) : null,
        food: values.food || null,
        note: values.note || null,
        photo_after: values.photoAfter,
        mealType: values.mealType,
        recordedAt: values.recordedAt,
      })
      toast.success(isOnline ? "อัปเดตบันทึกมื้ออาหารแล้ว" : "อัปเดตไว้แล้ว จะส่งเมื่อออนไลน์")
    } else {
      addLog({
        dog_id: values.dogId,
        schedule_id: matchingSchedule?.id ?? null,
        at: nowIso,
        status: values.status,
        amount_g: values.amountG ? Number(values.amountG) : null,
        food: values.food || null,
        note: values.note || null,
        photo_before: null,
        photo_after: values.photoAfter,
        mealType: values.mealType,
        recordedAt: values.recordedAt,
      })
      toast.success(isOnline ? "บันทึกมื้ออาหารแล้ว" : "บันทึกไว้แล้ว จะส่งอัตโนมัติเมื่อออนไลน์")
    }

    router.push("/")
  }

  if (dogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center text-sm text-muted-foreground">
        เพิ่มน้องหมาก่อนเพื่อบันทึกมื้ออาหาร
      </div>
    )
  }

  const initialDogId = (queryDogId && dogs.some((d) => d.id === queryDogId)) ? queryDogId : (dogs[0]?.id ?? "")
  const [selectedDogId, setSelectedDogId] = useState(initialDogId)
  const currentRole = selectedDogId ? getUserRole(selectedDogId) : null
  const isViewer = currentRole === "viewer"

  const initialValues = {
    dogId: initialDogId,
  }

  return (
    <MealLogForm
      dogs={dogs}
      initialValues={initialValues}
      readOnly={isViewer}
      readOnlyMessage="คุณมีสิทธิ์เข้าดูอย่างเดียว (Viewer) ไม่สามารถบันทึกหรือแก้ไขมื้ออาหารของน้องหมาตัวนี้ได้"
      onDogChange={setSelectedDogId}
      onSubmit={handleSubmit}
    />
  )
}

export default function LogPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-foreground">บันทึกมื้ออาหาร</h1>
        <p className="text-sm text-muted-foreground">ระบบจะคำนวณมื้อและเวลาบันทึกให้อัตโนมัติ</p>
      </header>
      <Suspense fallback={<div className="text-sm text-muted-foreground">กำลังโหลดฟอร์ม...</div>}>
        <LogFormContainer />
      </Suspense>
    </div>
  )
}
