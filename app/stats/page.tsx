"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  TrendingUp,
  Flame,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { DateFilter, type DateRangeOption } from "@/components/date-filter"
import { useAppStore } from "@/lib/app-store"
import {
  MEAL_CONFIG,
  getBangkokParts,
  getLogMealKey,
  isSameBangkokDay,
} from "@/lib/meal-utils"
import type { MealLog } from "@/lib/types"

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
]

function formatISODate(d: Date): string {
  const p = getBangkokParts(d)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export default function StatsPage() {
  const { dogs, logs } = useAppStore()
  const [trendRange, setTrendRange] = useState<DateRangeOption>("7d")

  // Heatmap Calendar state: month offset
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Group logs by day key (YYYY-MM-DD)
  const logsByDay = useMemo(() => {
    const map = new Map<string, MealLog[]>()
    for (const l of logs) {
      const dayKey = formatISODate(new Date(l.at))
      if (!map.has(dayKey)) {
        map.set(dayKey, [])
      }
      map.get(dayKey)!.push(l)
    }
    return map
  }, [logs])

  // ─────────────────────────────────────────────────────────────
  // 1. Overview Cards Calculations
  // ─────────────────────────────────────────────────────────────
  const overviewStats = useMemo(() => {
    const totalLogs = logs.length
    const finishedLogs = logs.filter((l) => l.status === "finished").length
    const overallRate = totalLogs > 0 ? Math.round((finishedLogs / totalLogs) * 100) : 0

    // Streak calculation (Consecutive days backwards from today or yesterday with at least 1 log)
    const now = new Date()
    let streak = 0
    let checkDate = new Date(now)

    // If today has no log yet, allow streak to count starting from yesterday
    const todayKey = formatISODate(now)
    if (!logsByDay.has(todayKey)) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (true) {
      const key = formatISODate(checkDate)
      const dayLogs = logsByDay.get(key)
      if (dayLogs && dayLogs.length > 0) {
        streak += 1
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Unfinished/None meals in last 7 days
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const last7DaysLogs = logs.filter((l) => new Date(l.at) >= sevenDaysAgo)
    const noneCountLast7Days = last7DaysLogs.filter((l) => l.status === "none").length

    // Latest day missing meals (among days that have logs or recent past 14 days)
    let latestIncompleteDateStr: string | null = null
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = formatISODate(d)
      const dLogs = logsByDay.get(key) || []
      // If day has less than MEAL_CONFIG.length meals recorded
      const uniqueMealsRecorded = new Set(dLogs.map((l) => getLogMealKey(l))).size
      if (uniqueMealsRecorded < MEAL_CONFIG.length) {
        const p = getBangkokParts(d)
        latestIncompleteDateStr = `${p.day} ${THAI_MONTHS[p.month - 1].slice(0, 3)}`
        break
      }
    }

    return {
      totalLogs,
      overallRate,
      streak,
      noneCountLast7Days,
      latestIncompleteDateStr,
    }
  }, [logs, logsByDay])

  // ─────────────────────────────────────────────────────────────
  // 2. Trend (7 Days / 30 Days)
  // ─────────────────────────────────────────────────────────────
  const trendDays = useMemo(() => {
    const count = trendRange === "30d" ? 30 : 7
    const result: {
      dateStr: string
      label: string
      total: number
      finished: number
      rate: number | null // null means no logs that day
    }[] = []

    const now = new Date()
    for (let i = count - 1; i >= 0; i--) {
      const target = new Date(now)
      target.setDate(target.getDate() - i)
      const key = formatISODate(target)
      const dLogs = logsByDay.get(key) || []
      const finished = dLogs.filter((l) => l.status === "finished").length
      const total = dLogs.length
      const rate = total > 0 ? Math.round((finished / total) * 100) : null

      const p = getBangkokParts(target)
      const label = count === 7 ? THAI_DAYS[target.getDay()].slice(0, 2) : `${p.day}`

      result.push({
        dateStr: key,
        label,
        total,
        finished,
        rate,
      })
    }

    return result
  }, [trendRange, logsByDay])

  // ─────────────────────────────────────────────────────────────
  // 3. Comparison by Meal Type
  // ─────────────────────────────────────────────────────────────
  const mealTypeStats = useMemo(() => {
    return MEAL_CONFIG.map((config) => {
      const mealLogs = logs.filter((l) => getLogMealKey(l) === config.key)
      const total = mealLogs.length
      const finished = mealLogs.filter((l) => l.status === "finished").length
      const partial = mealLogs.filter((l) => l.status === "partial").length
      const none = mealLogs.filter((l) => l.status === "none").length
      const rate = total > 0 ? Math.round((finished / total) * 100) : 0

      return {
        key: config.key,
        label: config.label,
        total,
        finished,
        partial,
        none,
        rate,
      }
    })
  }, [logs])

  // ─────────────────────────────────────────────────────────────
  // 4. Heatmap Calendar (Month View)
  // ─────────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: Array<{
      dayNumber: number
      dateStr: string
      statusType: "all-finished" | "partial" | "has-none" | "no-logs"
      isToday: boolean
      isFuture: boolean
    }> = []

    const now = new Date()
    const todayStr = formatISODate(now)

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dateStr = formatISODate(d)
      const isToday = dateStr === todayStr
      const isFuture = d > now && !isToday

      const dayLogs = logsByDay.get(dateStr) || []
      let statusType: "all-finished" | "partial" | "has-none" | "no-logs" = "no-logs"

      if (dayLogs.length > 0) {
        const hasNone = dayLogs.some((l) => l.status === "none")
        const hasPartial = dayLogs.some((l) => l.status === "partial")
        const allFinished = dayLogs.every((l) => l.status === "finished")

        if (hasNone) {
          statusType = "has-none"
        } else if (hasPartial) {
          statusType = "partial"
        } else if (allFinished) {
          statusType = "all-finished"
        }
      }

      days.push({
        dayNumber: day,
        dateStr,
        statusType,
        isToday,
        isFuture,
      })
    }

    return { firstDayIndex, days, month, year }
  }, [calendarDate, logsByDay])

  // ─────────────────────────────────────────────────────────────
  // 5. Pattern Insight (Rule-based aggregation)
  // ─────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (logs.length < 5) {
      return []
    }

    const items: string[] = []

    // 1) Meal with worst completion rate or highest 'none'
    const mealWithMostNone = [...mealTypeStats]
      .filter((m) => m.total >= 2)
      .sort((a, b) => b.none - a.none)[0]

    if (mealWithMostNone && mealWithMostNone.none > 0) {
      items.push(`มื้อ${mealWithMostNone.label} มีจำนวนครั้งที่ไม่กินสูงที่สุด (${mealWithMostNone.none} ครั้ง)`)
    } else {
      const bestMeal = [...mealTypeStats]
        .filter((m) => m.total >= 2)
        .sort((a, b) => b.rate - a.rate)[0]
      if (bestMeal && bestMeal.rate >= 70) {
        items.push(`มื้อ${bestMeal.label} น้องเจริญอาหารดีที่สุด มีอัตรากินหมด ${bestMeal.rate}%`)
      }
    }

    // 2) Day-of-week analysis: which day has lowest finish rate
    const dayStats = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
      const filtered = logs.filter((l) => new Date(l.at).getDay() === dayIndex)
      const total = filtered.length
      const notFinished = filtered.filter((l) => l.status !== "finished").length
      return {
        dayIndex,
        dayName: THAI_DAYS[dayIndex],
        total,
        notFinished,
        rate: total > 0 ? (notFinished / total) * 100 : 0,
      }
    })

    const problematicDay = dayStats
      .filter((d) => d.total >= 2 && d.notFinished > 0)
      .sort((a, b) => b.rate - a.rate)[0]

    if (problematicDay && problematicDay.rate > 30) {
      items.push(`วัน${problematicDay.dayName} มักกินไม่หมดบ่อยกว่าวันอื่น (${Math.round(problematicDay.rate)}% ของมื้อในวันนี้)`)
    }

    // 3) Consistency insight
    if (overviewStats.streak >= 3) {
      items.push(`มีวินัยยอดเยี่ยม! คุณบันทึกมื้ออาหารต่อเนื่องมาแล้ว ${overviewStats.streak} วัน`)
    }

    return items
  }, [logs, mealTypeStats, overviewStats.streak])

  // If completely no logs at all
  if (logs.length === 0) {
    return (
      <div className="flex flex-col gap-5 px-4 pt-4">
        <header className="pt-2">
          <h1 className="text-xl font-bold text-foreground">สถิติ</h1>
          <p className="text-sm text-muted-foreground">ภาพรวมและพฤติกรรมการกินอาหาร</p>
        </header>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <CalendarDays className="size-10 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">ยังไม่มีข้อมูลบันทึกมื้ออาหาร</p>
          <p className="text-xs text-muted-foreground">เริ่มบันทึกมื้ออาหารเพื่อดูสถิติและแนวโน้มที่นี่</p>
          <Link
            href="/log"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            ไปบันทึกมื้ออาหาร
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-12">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-foreground">สถิติ</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมและแนวโน้มการกินข้าว</p>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          1. สรุปภาพรวม (Overview Cards)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Overall Finish Rate */}
        <Card className="flex flex-col justify-between gap-2 rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">อัตรากินหมดรวม</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground">{overviewStats.overallRate}%</span>
            <span className="text-[11px] text-muted-foreground">จาก {overviewStats.totalLogs} มื้อ</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${overviewStats.overallRate}%` }}
            />
          </div>
        </Card>

        {/* Card 2: Streak */}
        <Card className="flex flex-col justify-between gap-2 rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">บันทึกต่อเนื่อง</span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground">{overviewStats.streak}</span>
            <span className="text-xs font-medium text-foreground">วัน</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {overviewStats.streak > 0 ? "สม่ำเสมอต่อเนื่อง" : "เริ่มบันทึกวันนี้"}
          </span>
        </Card>

        {/* Card 3: None Count (7 Days) */}
        <Card className="flex flex-col justify-between gap-2 rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">มื้อไม่กิน (7 วัน)</span>
            <AlertTriangle className={`size-4 ${overviewStats.noneCountLast7Days > 0 ? "text-rose-500" : "text-muted-foreground"}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-extrabold ${overviewStats.noneCountLast7Days > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
              {overviewStats.noneCountLast7Days}
            </span>
            <span className="text-[11px] text-muted-foreground">มื้อ</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {overviewStats.noneCountLast7Days >= 3 ? "⚠️ ค่อนข้างบ่อย ควรสังเกต" : "อยู่ในเกณฑ์ปกติ"}
          </span>
        </Card>

        {/* Card 4: Incomplete day */}
        <Card className="flex flex-col justify-between gap-2 rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">บันทึกไม่ครบ</span>
            <CalendarDays className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground truncate">
              {overviewStats.latestIncompleteDateStr || "ครบทุกมื้อ"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {overviewStats.latestIncompleteDateStr ? "วันล่าสุดที่มีมื้อขาด" : "ไม่มีมื้อตกหล่น"}
          </span>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. แนวโน้มรายสัปดาห์ / 30 วัน (Weekly Trend)
      ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-foreground">แนวโน้มอัตรากินหมด</h2>
            <span className="text-xs text-muted-foreground">เปรียบเทียบในแต่ละวัน</span>
          </div>
          <DateFilter
            value={trendRange}
            onChange={(v) => setTrendRange(v)}
            options={["7d", "30d"]}
          />
        </div>

        <Card className="flex flex-col gap-4 rounded-2xl border border-border p-4 shadow-xs">
          {/* Custom Responsive Bar Chart */}
          <div className="flex h-36 items-end justify-between gap-1.5 pt-4">
            {trendDays.map((item, idx) => {
              const isRecorded = item.rate !== null
              const heightPercent = isRecorded ? Math.max(item.rate!, 12) : 6
              const barColor = !isRecorded
                ? "bg-muted"
                : item.rate! >= 80
                ? "bg-emerald-500"
                : item.rate! >= 40
                ? "bg-amber-500"
                : "bg-rose-500"

              return (
                <div
                  key={idx}
                  className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 hidden rounded-md bg-popover px-1.5 py-0.5 text-[10px] font-semibold text-popover-foreground shadow-md group-hover:flex z-10 whitespace-nowrap">
                    {isRecorded ? `${item.rate}% (${item.finished}/${item.total})` : "ไม่มีบันทึก"}
                  </div>

                  <div
                    className={`w-full max-w-7 rounded-t-md transition-all ${barColor}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground truncate w-full text-center">
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> กินหมดดี (&gt;=80%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" /> ปานกลาง (40-79%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted" /> ไม่ได้บันทึก
            </span>
          </div>
        </Card>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. เปรียบเทียบตามมื้ออาหาร (By Meal Type)
      ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-foreground">เปรียบเทียบตามมื้ออาหาร</h2>
          <span className="text-xs text-muted-foreground">มื้อไหนกินหมดได้ดีที่สุด</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {mealTypeStats.map((meal) => (
            <Card
              key={meal.key}
              className="flex flex-col gap-2.5 rounded-2xl border border-border p-3 shadow-xs text-center"
            >
              <span className="font-semibold text-xs text-foreground">มื้อ{meal.label}</span>

              {meal.total > 0 ? (
                <>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xl font-extrabold text-foreground">{meal.rate}%</span>
                    <span className="text-[10px] text-muted-foreground">กินหมด ({meal.finished}/{meal.total})</span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        meal.rate >= 80 ? "bg-emerald-500" : meal.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${meal.rate}%` }}
                    />
                  </div>

                  {meal.none > 0 && (
                    <span className="text-[10px] font-medium text-rose-500">
                      ไม่กิน {meal.none} มื้อ
                    </span>
                  )}
                </>
              ) : (
                <span className="py-3 text-[11px] text-muted-foreground">ยังไม่มีบันทึก</span>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. ปฏิทินภาพรวม (Heatmap Calendar)
      ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-foreground">ปฏิทินภาพรวมรายวัน</h2>
            <span className="text-xs text-muted-foreground">กดที่วันเพื่อเปิดดูข้อมูลย้อนหลัง</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(calendarDate)
                prev.setMonth(prev.getMonth() - 1)
                setCalendarDate(prev)
              }}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-semibold text-foreground min-w-20 text-center">
              {THAI_MONTHS[calendarDays.month]} {calendarDays.year + 543}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = new Date(calendarDate)
                next.setMonth(next.getMonth() + 1)
                setCalendarDate(next)
              }}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <Card className="flex flex-col gap-3 rounded-2xl border border-border p-3.5 shadow-xs">
          {/* Calendar Header Day Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank placeholder spaces before 1st day of month */}
            {Array.from({ length: calendarDays.firstDayIndex }).map((_, i) => (
              <div key={`blank-${i}`} className="size-8 sm:size-10" />
            ))}

            {calendarDays.days.map((day) => {
              // Color styles
              let colorClass = "bg-secondary/40 text-muted-foreground border-transparent"
              if (!day.isFuture) {
                if (day.statusType === "all-finished") {
                  colorClass = "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/30"
                } else if (day.statusType === "partial") {
                  colorClass = "bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border-amber-500/30"
                } else if (day.statusType === "has-none") {
                  colorClass = "bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold border-rose-500/30"
                }
              }

              return (
                <Link
                  key={day.dateStr}
                  href={`/?date=${day.dateStr}`}
                  title={`${day.dateStr} (คลิกดูย้อนหลัง)`}
                  className={`flex size-8 sm:size-10 items-center justify-center rounded-xl border text-xs transition-all hover:scale-105 active:scale-95 ${colorClass} ${
                    day.isToday ? "ring-2 ring-primary ring-offset-1" : ""
                  }`}
                >
                  {day.dayNumber}
                </Link>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[10px] text-muted-foreground border-t border-border">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" /> ครบทุกมื้อกินหมด
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" /> กินบางส่วน
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-500" /> มีมื้อไม่กิน
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-muted" /> ไม่ได้บันทึก
            </span>
          </div>
        </Card>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. รูปแบบพฤติกรรม (Pattern Insight)
      ───────────────────────────────────────────────────────────── */}
      {insights.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-amber-500" />
            <h2 className="text-sm font-bold text-foreground">ข้อสังเกตและพฤติกรรม</h2>
          </div>

          <div className="flex flex-col gap-2">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground"
              >
                <Info className="size-4 shrink-0 text-primary mt-0.5" />
                <span className="leading-relaxed">{insight}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          💡 บันทึกข้อมูลเพิ่มอีกสัก 2-3 วันเพื่อปลดล็อกข้อสังเกตพฤติกรรมการกินอัตโนมัติ
        </div>
      )}
    </div>
  )
}
