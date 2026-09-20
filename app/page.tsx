"use client"

import { useState } from "react"
import { CalendarIcon, ChevronLeft, ChevronRight, PawPrint, Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DogHeader } from "@/components/dog-header"
import { MealCard } from "@/components/meal-card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/lib/app-store"

function isSameDate(a: string | Date, b: string | Date) {
  const da = typeof a === "string" ? new Date(a) : a
  const db = typeof b === "string" ? new Date(b) : b
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

function formatThaiDate(date: Date) {
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function TodayPage() {
  const { dogs, schedules, logs, isLoading } = useAppStore()
  
  // View mode: "today" | "history"
  const [viewMode, setViewMode] = useState<"today" | "history">("today")
  // Custom date for history mode (defaults to yesterday)
  const [historyDate, setHistoryDate] = useState<Date>(() => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return y
  })
  const [calendarOpen, setCalendarOpen] = useState(false)

  const activeDate = viewMode === "today" ? new Date() : historyDate
  const selectedLogs = logs.filter((l) => isSameDate(l.at, activeDate))

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>
      </div>
    )
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
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <PawPrint className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold text-foreground">
            {viewMode === "today" ? "วันนี้" : "ข้อมูลย้อนหลัง"}
          </h1>
        </div>
        <Link
          href="/log"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="size-4" />
          ไปหน้าบันทึก
        </Link>
      </header>

      {/* สลับดูวันนี้ กับ ดูข้อมูลย้อนหลัง */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setViewMode("today")}
            className={`rounded-lg py-2 text-sm font-medium transition-all ${
              viewMode === "today" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            วันนี้ (ปัจจุบัน)
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`rounded-lg py-2 text-sm font-medium transition-all ${
              viewMode === "history" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ดูข้อมูลย้อนหลัง
          </button>
        </div>

        {/* ถ้าเลือกดูข้อมูลย้อนหลัง ให้เลือกวันที่ได้อิสระ ย้อนดูได้ทุกวัน */}
        {viewMode === "history" && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                const prev = new Date(historyDate)
                prev.setDate(prev.getDate() - 1)
                setHistoryDate(prev)
              }}
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                  />
                }
              >
                <CalendarIcon className="size-3.5 text-primary" />
                <span>{formatThaiDate(historyDate)}</span>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={historyDate}
                  onSelect={(date) => {
                    if (date) {
                      setHistoryDate(date)
                      setCalendarOpen(false)
                    }
                  }}
                  disabled={{ after: new Date() }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isSameDate(new Date(), historyDate)}
              onClick={() => {
                const next = new Date(historyDate)
                next.setDate(next.getDate() + 1)
                if (next <= new Date()) {
                  setHistoryDate(next)
                }
              }}
              title="วันถัดไป"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {dogs.map((dog) => {
        const dogSchedules = schedules.filter((s) => s.dog_id === dog.id)
        const dogLogsDay = selectedLogs.filter((l) => l.dog_id === dog.id)
        const latestLog = dogLogsDay[0] ?? null
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

            {dogSchedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                <p>ยังไม่มีมื้ออาหาร</p>
                <Link
                  href="/settings"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
                >
                  <Plus className="size-4" /> ไปที่ตั้งค่าเพื่อเพิ่มมื้อเช้า/เย็น
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {dogSchedules.map((schedule) => {
                  const log = dogLogsDay.find((l) => l.schedule_id === schedule.id) ?? null
                  return (
                    <MealCard
                      key={schedule.id}
                      schedule={schedule}
                      log={log}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
