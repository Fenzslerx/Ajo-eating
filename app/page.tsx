"use client"

import { Suspense, useEffect, useState } from "react"
import { CalendarIcon, ChevronLeft, ChevronRight, PawPrint, Plus } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DogHeader } from "@/components/dog-header"
import { MealCard } from "@/components/meal-card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { NotificationCenter } from "@/components/notification-center"
import { useAppStore } from "@/lib/app-store"
import {
  getActiveMealConfig,
  getMealStatus,
  getLogMealKey,
  isSameBangkokDay,
} from "@/lib/meal-utils"

function formatThaiDate(date: Date) {
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function TodayPageContent() {
  const { dogs, logs, isLoading, load } = useAppStore()
  const searchParams = useSearchParams()
  
  // View mode: "today" | "history"
  const [viewMode, setViewMode] = useState<"today" | "history">("today")
  // Custom date for history mode (defaults to yesterday or query param date)
  const [historyDate, setHistoryDate] = useState<Date>(() => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return y
  })
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [activeMealConfigs, setActiveMealConfigs] = useState(() => getActiveMealConfig())

  useEffect(() => {
    const handleConfigChange = () => {
      setActiveMealConfigs(getActiveMealConfig())
    }
    const handleProfileChange = () => {
      void load()
    }
    window.addEventListener("meal-config-changed", handleConfigChange)
    window.addEventListener("dog-profile-changed", handleProfileChange)
    return () => {
      window.removeEventListener("meal-config-changed", handleConfigChange)
      window.removeEventListener("dog-profile-changed", handleProfileChange)
    }
  }, [load])

  // Listen to ?date=YYYY-MM-DD query param from stats calendar
  useEffect(() => {
    const paramDate = searchParams.get("date")
    if (paramDate) {
      const parsed = new Date(paramDate)
      if (!isNaN(parsed.getTime())) {
        setHistoryDate(parsed)
        setViewMode("history")
      }
    }
  }, [searchParams])

  const activeDate = viewMode === "today" ? new Date() : historyDate
  const selectedLogs = logs.filter((l) => isSameBangkokDay(l.at, activeDate))

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
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Link
            href="/log"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="size-4" />
            ไปหน้าบันทึก
          </Link>
        </div>
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
              disabled={isSameBangkokDay(new Date(), historyDate)}
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
        const dogLogsDay = selectedLogs.filter((l) => l.dog_id === dog.id)
        const latestLog = dogLogsDay[0] ?? null

        return (
          <section key={dog.id} className="flex flex-col gap-3" aria-label={`มื้ออาหารของ${dog.name}`}>
            <DogHeader
              name={dog.name}
              photo={dog.photo}
              latestLog={latestLog}
              breed={dog.breed}
              birthdate={dog.birthdate}
            />

            <div className="flex flex-col gap-3">
              {activeMealConfigs.map((mealConfig) => {
                const log = dogLogsDay.find((l) => getLogMealKey(l, activeMealConfigs) === mealConfig.key) ?? null
                const displayStatus = getMealStatus(mealConfig.key, dogLogsDay, activeDate, undefined, activeMealConfigs)

                return (
                  <MealCard
                    key={mealConfig.key}
                    mealConfig={mealConfig}
                    log={log}
                    displayStatus={displayStatus}
                    dogId={dog.id}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function TodayPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">กำลังโหลด...</div>}>
      <TodayPageContent />
    </Suspense>
  )
}
