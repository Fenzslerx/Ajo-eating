"use client"

import { useMemo, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DateFilter, type DateRangeOption } from "@/components/date-filter"
import { useAppStore } from "@/lib/app-store"
import { cn } from "@/lib/utils"

function isSameDay(iso: string, date: Date) {
  const target = new Date(iso)
  return (
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  )
}

function withinRange(iso: string, range: DateRangeOption) {
  const days = range === "today" ? 0 : range === "7d" ? 7 : 30
  const target = new Date(iso)
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  cutoff.setHours(0, 0, 0, 0)
  return target >= cutoff
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export default function StatsPage() {
  const { dogs, logs } = useAppStore()
  const [range, setRange] = useState<DateRangeOption>("7d")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const stats = useMemo(() => {
    return dogs.map((dog) => {
      const dogLogs = logs.filter(
        (l) =>
          l.dog_id === dog.id && (selectedDate ? isSameDay(l.at, selectedDate) : withinRange(l.at, range)),
      )
      const total = dogLogs.length
      const finished = dogLogs.filter((l) => l.status === "finished").length
      const partial = dogLogs.filter((l) => l.status === "partial").length
      const none = dogLogs.filter((l) => l.status === "none").length
      const rate = total > 0 ? Math.round((finished / total) * 100) : 0
      return { dog, total, finished, partial, none, rate }
    })
  }, [dogs, logs, range, selectedDate])

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-3 pt-2">
        <h1 className="text-xl font-bold text-foreground">สถิติ</h1>
        <div className="flex items-center gap-2">
          <DateFilter
            value={range}
            onChange={(value) => {
              setSelectedDate(undefined)
              setRange(value)
            }}
            options={["7d", "30d"]}
          />
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "min-h-9 gap-1.5 rounded-full border-border text-sm",
                    selectedDate && "border-primary text-primary",
                  )}
                />
              }
            >
              <CalendarIcon className="size-4" />
              {selectedDate ? dateFormatter.format(selectedDate) : "เลือกวันที่"}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date)
                  setCalendarOpen(false)
                }}
                disabled={{ after: new Date() }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        {selectedDate ? (
          <button
            type="button"
            onClick={() => setSelectedDate(undefined)}
            className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            ล้างวันที่เลือก
          </button>
        ) : null}
      </header>

      {stats.length === 0 || stats.every((s) => s.total === 0) ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
      ) : (
        <div className="flex flex-col gap-4">
          {stats.map(({ dog, total, finished, partial, none, rate }) => (
            <Card key={dog.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{dog.name}</span>
                <span className="text-sm text-muted-foreground">{total} มื้อ</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>อัตรากินหมด</span>
                  <span className="font-medium text-foreground">{rate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col gap-0.5 rounded-lg bg-secondary/50 py-2">
                  <span className="text-sm font-semibold text-foreground">{finished}</span>
                  <span className="text-[11px] text-muted-foreground">กินหมด</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-lg bg-secondary/50 py-2">
                  <span className="text-sm font-semibold text-foreground">{partial}</span>
                  <span className="text-[11px] text-muted-foreground">บางส่วน</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-lg bg-secondary/50 py-2">
                  <span className="text-sm font-semibold text-foreground">{none}</span>
                  <span className="text-[11px] text-muted-foreground">ไม่กิน</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
