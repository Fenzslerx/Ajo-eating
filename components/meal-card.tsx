"use client"

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StatusChip } from "@/components/status-chip"
import type { MealLog, MealStatus, Schedule } from "@/lib/types"

const QUICK_ACTIONS: { status: MealStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { status: "finished", label: "กินหมด", icon: CheckCircle2 },
  { status: "partial", label: "กินบางส่วน", icon: CircleDashed },
  { status: "none", label: "ไม่กิน", icon: XCircle },
]

export function MealCard({
  schedule,
  log,
  onQuickLog,
  onOpenDetail,
}: {
  schedule: Schedule
  log: MealLog | null
  onQuickLog: (status: MealStatus) => void
  onOpenDetail?: () => void
}) {
  return (
    <Card className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{schedule.label}</span>
          <span className="text-sm text-muted-foreground">{schedule.time} น.</span>
        </div>
        {log ? (
          <button
            type="button"
            onClick={onOpenDetail}
            className="rounded-full underline-offset-2 hover:underline"
            aria-label={`ดูรายละเอียดมื้อ${schedule.label}`}
          >
            <StatusChip status={log.status} />
          </button>
        ) : null}
      </div>

      {!log && (
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map(({ status, label, icon: Icon }) => (
            <button
              key={status}
              type="button"
              onClick={() => onQuickLog(status)}
              aria-label={`บันทึกว่า${label}สำหรับมื้อ${schedule.label}`}
              className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary/60 px-1 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary active:scale-95"
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
