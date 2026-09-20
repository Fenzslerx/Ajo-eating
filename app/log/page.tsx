"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { MealLogForm, type MealLogFormValues } from "@/components/meal-log-form"
import { useAppStore } from "@/lib/app-store"

function LogFormContainer() {
  const { dogs, schedules, addLog, isOnline } = useAppStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const queryDogId = searchParams.get("dog")
  const queryScheduleId = searchParams.get("schedule")

  function handleSubmit(values: MealLogFormValues) {
    addLog({
      dog_id: values.dogId,
      schedule_id: values.scheduleId,
      at: values.at,
      status: values.status,
      amount_g: values.amountG ? Number(values.amountG) : null,
      food: values.food || null,
      note: values.note || null,
      photo_before: null,
      photo_after: values.photoAfter,
    })
    toast.success(isOnline ? "บันทึกมื้ออาหารแล้ว" : "บันทึกไว้แล้ว จะส่งอัตโนมัติเมื่อออนไลน์")
    router.push("/")
  }

  if (dogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center text-sm text-muted-foreground">
        เพิ่มน้องหมาก่อนเพื่อบันทึกมื้ออาหาร
      </div>
    )
  }

  const initialValues = {
    dogId: queryDogId && dogs.some((d) => d.id === queryDogId) ? queryDogId : undefined,
    scheduleId: queryScheduleId && schedules.some((s) => s.id === queryScheduleId) ? queryScheduleId : undefined,
  }

  return (
    <MealLogForm
      dogs={dogs}
      schedules={schedules}
      initialValues={initialValues}
      onSubmit={handleSubmit}
    />
  )
}

export default function LogPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-foreground">บันทึกมื้ออาหาร</h1>
        <p className="text-sm text-muted-foreground">บันทึกมื้ออาหารและสถานะการกินของน้องหมา</p>
      </header>
      <Suspense fallback={<div className="text-sm text-muted-foreground">กำลังโหลดฟอร์ม...</div>}>
        <LogFormContainer />
      </Suspense>
    </div>
  )
}
