"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusChip } from "@/components/status-chip"
import { DateFilter, type DateRangeOption } from "@/components/date-filter"
import { useAppStore } from "@/lib/app-store"
import type { MealLog, MealStatus } from "@/lib/types"

function withinRange(iso: string, range: DateRangeOption) {
  const days = range === "today" ? 0 : range === "7d" ? 7 : 30
  const target = new Date(iso)
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  cutoff.setHours(0, 0, 0, 0)
  return target >= cutoff
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function HistoryPage() {
  const { dogs, schedules, logs, profileFor } = useAppStore()
  const [range, setRange] = useState<DateRangeOption>("7d")
  const [dogFilter, setDogFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<MealStatus | "all">("all")
  const [selected, setSelected] = useState<MealLog | null>(null)

  const filtered = useMemo(() => {
    return logs
      .filter((l) => withinRange(l.at, range))
      .filter((l) => dogFilter === "all" || l.dog_id === dogFilter)
      .filter((l) => statusFilter === "all" || l.status === statusFilter)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [logs, range, dogFilter, statusFilter])

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-3 pt-2">
        <h1 className="text-xl font-bold text-foreground">ประวัติ</h1>
        <DateFilter value={range} onChange={setRange} />
        <div className="flex gap-2">
          <Select value={dogFilter} onValueChange={(value) => value && setDogFilter(value)}>
            <SelectTrigger className="flex-1" aria-label="กรองตามน้องหมา">
              <SelectValue placeholder="ทุกตัว" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกตัว</SelectItem>
              {dogs.map((dog) => (
                <SelectItem key={dog.id} value={dog.id}>
                  {dog.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MealStatus | "all")}>
            <SelectTrigger className="flex-1" aria-label="กรองตามสถานะ">
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="finished">กินหมด</SelectItem>
              <SelectItem value="partial">กินบางส่วน</SelectItem>
              <SelectItem value="none">ไม่กิน</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Search className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">ไม่พบบันทึกที่ตรงกับตัวกรอง</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((log) => {
            const dog = dogs.find((d) => d.id === log.dog_id)
            const schedule = schedules.find((s) => s.id === log.schedule_id)
            const by = profileFor(log.by)
            return (
              <li key={log.id}>
                <button
                  type="button"
                  onClick={() => setSelected(log)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {dog?.name} · {schedule?.label ?? "ไม่ระบุมื้อ"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(log.at)} · บันทึกโดย {by?.name ?? "ไม่ทราบ"}
                    </span>
                  </div>
                  <StatusChip status={log.status} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dogs.find((d) => d.id === selected.dog_id)?.name} ·{" "}
                  {schedules.find((s) => s.id === selected.schedule_id)?.label ?? "ไม่ระบุมื้อ"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">สถานะ</span>
                  <StatusChip status={selected.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">เวลา</span>
                  <span>{formatDateTime(selected.at)}</span>
                </div>
                {selected.amount_g != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ปริมาณ</span>
                    <span>{selected.amount_g} กรัม</span>
                  </div>
                )}
                {selected.food && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">อาหาร</span>
                    <span>{selected.food}</span>
                  </div>
                )}
                {selected.note && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">บันทึกเพิ่มเติม</span>
                    <p>{selected.note}</p>
                  </div>
                )}
                {selected.photo_after && <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">รูปหลังกิน</span><img src={selected.photo_after} alt="รูปมื้ออาหารหลังกิน" className="w-full rounded-xl border border-border object-cover" /></div>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
