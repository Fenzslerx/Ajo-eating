"use client"

import { useState } from "react"
import { PawPrint, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DogHeader } from "@/components/dog-header"
import { MealCard } from "@/components/meal-card"
import { MealLogForm, type MealLogFormValues } from "@/components/meal-log-form"
import { useAppStore } from "@/lib/app-store"
import type { MealLog, MealStatus } from "@/lib/types"

function isDay(iso: string, offset = 0) {
  const d = new Date(iso)
  const now = new Date()
  now.setDate(now.getDate() - offset)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export default function TodayPage() {
  const { dogs, schedules, logs, addLog, updateLog, removeLog, isOnline } = useAppStore()
  const [editingLog, setEditingLog] = useState<MealLog | null>(null)
  const [dayOffset, setDayOffset] = useState(0)

  const selectedLogs = logs.filter((l) => isDay(l.at, dayOffset))

  function handleQuickLog(dogId: string, scheduleId: string, status: MealStatus) {
    addLog({
      dog_id: dogId,
      schedule_id: scheduleId,
      at: new Date().toISOString(),
      status,
      amount_g: null,
      food: null,
      note: null,
      photo_before: null,
      photo_after: null,
    })
    toast.success(isOnline ? "บันทึกแล้ว" : "บันทึกไว้แล้ว จะส่งอัตโนมัติเมื่อออนไลน์")
  }

  function handleUpdateLog(values: MealLogFormValues) {
    if (!editingLog) return
    updateLog(editingLog.id, {
      dog_id: values.dogId,
      schedule_id: values.scheduleId,
      status: values.status,
      amount_g: values.amountG ? Number(values.amountG) : null,
      food: values.food.trim() || null,
      note: values.note.trim() || null,
      photo_after: values.photoAfter,
      at: values.at,
    })
    setEditingLog(null)
    toast.success("แก้ไขแล้ว")
  }

  function handleDeleteLog() {
    if (!editingLog) return
    removeLog(editingLog.id)
    setEditingLog(null)
    toast.success("ลบมื้ออาหารแล้ว")
  }

  if (dogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-secondary text-4xl">🐾</div>
        <h1 className="text-lg font-semibold text-foreground">ยังไม่มีน้องหมา</h1>
        <p className="text-sm text-muted-foreground">เพิ่มน้องหมาตัวแรกเพื่อเริ่มบันทึกมื้ออาหาร</p>
        <Button render={<Link href="/settings" />} className="rounded-full">
          <Plus className="size-4" aria-hidden="true" />
          เพิ่มน้องหมา
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex items-center gap-2 pt-2">
        <PawPrint className="size-5 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-bold text-foreground">{dayOffset === 0 ? "วันนี้" : "เมื่อวาน"}</h1>
      </header>
      <div className="grid grid-cols-2 rounded-xl bg-secondary/50 p-1"><button onClick={() => setDayOffset(0)} className={`rounded-lg py-2 text-sm font-medium ${dayOffset === 0 ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>วันนี้</button><button onClick={() => setDayOffset(1)} className={`rounded-lg py-2 text-sm font-medium ${dayOffset === 1 ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>ดูข้อมูลเมื่อวาน</button></div>

      {dogs.map((dog) => {
        const dogSchedules = schedules.filter((s) => s.dog_id === dog.id)
        const dogLogsToday = selectedLogs.filter((l) => l.dog_id === dog.id)
        const latestLog = dogLogsToday[0] ?? null
        const latestSchedule = latestLog
          ? dogSchedules.find((s) => s.id === latestLog.schedule_id) ?? null
          : null

        return (
          <section key={dog.id} className="flex flex-col gap-3" aria-label={`มื้ออาหารของ${dog.name}`}>
            <DogHeader
              name={dog.name}
              photo={dog.photo}
              latestLog={latestLog}
              latestSchedule={latestSchedule}
            />
            {latestLog && <article className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center gap-3 p-3"><div className="flex-1"><p className="font-semibold">{dog.name} {latestLog.status === "finished" ? "กินหมด" : latestLog.status === "partial" ? "กินบางส่วน" : "ไม่กิน"}</p><p className="mt-1 text-sm text-muted-foreground">รูปหลังกิน · {new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date(latestLog.at))}</p></div>{latestLog.photo_after && <img src={latestLog.photo_after} alt={`รูปหลังกินของ${dog.name}`} className="size-20 rounded-xl object-cover" />}</div></article>}
            {dogSchedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                ยังไม่มีมื้ออาหาร ไปที่{" "}
                <Link href="/settings" className="text-primary underline underline-offset-2">
                  ตั้งค่า
                </Link>{" "}
                เพื่อเพิ่มมื้อแรก
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {dayOffset === 0 && dogSchedules.map((schedule) => {
                  const log = dogLogsToday.find((l) => l.schedule_id === schedule.id) ?? null
                  return (
                    <MealCard
                      key={schedule.id}
                      schedule={schedule}
                      log={log}
                      onQuickLog={(status) => handleQuickLog(dog.id, schedule.id, status)}
                      onOpenDetail={() => log && setEditingLog(log)}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขมื้ออาหาร</DialogTitle>
          </DialogHeader>
          {editingLog && (
            <>
              <MealLogForm
                dogs={dogs}
                schedules={schedules}
                submitLabel="บันทึกการแก้ไข"
                initialValues={{
                  dogId: editingLog.dog_id,
                  scheduleId: editingLog.schedule_id,
                  status: editingLog.status,
                  amountG: editingLog.amount_g?.toString() ?? "",
                  food: editingLog.food ?? "",
                  note: editingLog.note ?? "",
                  photoAfter: editingLog.photo_after,
                  at: editingLog.at,
                }}
                onSubmit={handleUpdateLog}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-12 rounded-full text-destructive hover:text-destructive"
                onClick={handleDeleteLog}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                ลบมื้ออาหารนี้
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
