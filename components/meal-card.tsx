"use client"

import Link from "next/link"
import { Moon, Sun, Utensils, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StatusChip } from "@/components/status-chip"
import type { MealLog, Schedule } from "@/lib/types"

function formatTime(timeStr: string) {
  if (!timeStr) return ""
  return timeStr.slice(0, 5) + " น."
}

function getMealIcon(label: string) {
  if (label.includes("เช้า")) return <Sun className="size-5 text-amber-500" />
  if (label.includes("เย็น") || label.includes("ค่ำ")) return <Moon className="size-5 text-indigo-400" />
  return <Utensils className="size-5 text-primary" />
}

export function MealCard({
  schedule,
  log,
}: {
  schedule: Schedule
  log: MealLog | null
}) {
  return (
    <Card className="flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-sm">
      {/* Header with Meal name and Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
            {getMealIcon(schedule.label)}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{schedule.label}</span>
            <span className="text-xs text-muted-foreground">{formatTime(schedule.time)}</span>
          </div>
        </div>

        {log ? (
          <StatusChip status={log.status} />
        ) : (
          <span className="rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            ยังไม่บันทึก
          </span>
        )}
      </div>

      {/* Content Section: Read-only */}
      {log ? (
        <div className="flex flex-col gap-2.5">
          {/* Photo Display (Read-Only) */}
          {log.photo_after && (
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={log.photo_after}
                alt={`รูปมื้อ${schedule.label}`}
                className="h-48 w-full object-cover"
              />
            </div>
          )}

          {/* Details (Food, Amount, Note) */}
          {(log.food || log.amount_g || log.note) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              {log.food && <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-foreground">🍖 {log.food}</span>}
              {log.amount_g && <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-foreground">⚖️ {log.amount_g} กรัม</span>}
              {log.note && <span className="rounded-md bg-secondary px-2.5 py-1 text-foreground">📝 {log.note}</span>}
            </div>
          )}
        </div>
      ) : (
        /* Empty state with link to record page */
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-secondary/20 px-3.5 py-3">
          <span className="text-xs text-muted-foreground font-medium">
            ยังไม่บันทึกการกินข้าว
          </span>
          <Link
            href={`/log?dog=${schedule.dog_id}&schedule=${schedule.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            ไปบันทึกตอนนี้
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </Card>
  )
}
