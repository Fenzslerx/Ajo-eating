"use client"

import Link from "next/link"
import { Moon, Sun, Utensils, ArrowRight, Clock, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StatusChip } from "@/components/status-chip"
import {
  type MealConfigItem,
  type MealDisplayStatus,
  formatRecordedTime,
} from "@/lib/meal-utils"
import type { MealLog } from "@/lib/types"

function getMealIcon(key: string) {
  if (key === "morning") return <Sun className="size-5 text-amber-500" />
  if (key === "noon") return <Utensils className="size-5 text-orange-500" />
  return <Moon className="size-5 text-indigo-400" />
}

export function MealCard({
  mealConfig,
  log,
  displayStatus,
  dogId,
  authorName,
}: {
  mealConfig: MealConfigItem
  log: MealLog | null
  displayStatus: MealDisplayStatus
  dogId: string
  authorName?: string | null
}) {
  const recordedTimeDisplay = log?.recordedAt || (log?.at ? formatRecordedTime(log.at) : null)

  return (
    <Card className="flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-sm">
      {/* Header with Meal name and Recorded Time or Schedule Window */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
            {getMealIcon(mealConfig.key)}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{mealConfig.label}</span>
            {displayStatus === "recorded" && recordedTimeDisplay ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3 text-primary shrink-0" />
                <span>
                  บันทึกเมื่อ {recordedTimeDisplay} น.
                  {authorName && <span className="text-foreground/80 font-medium"> โดย {authorName}</span>}
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                ช่วงเวลา {String(mealConfig.startHour).padStart(2, "0")}:00 - {String(mealConfig.endHour).padStart(2, "0")}:00 น.
              </span>
            )}
          </div>
        </div>

        {displayStatus === "recorded" && log ? (
          <StatusChip status={log.status} />
        ) : displayStatus === "missed" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-3.5" />
            ไม่ได้บันทึก
          </span>
        ) : (
          <span className="rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            ยังไม่ถึงเวลา
          </span>
        )}
      </div>

      {/* Content Section: Read-only */}
      {displayStatus === "recorded" && log ? (
        <div className="flex flex-col gap-2.5">
          {/* Photo Display (Read-Only) */}
          {log.photo_after && (
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={log.photo_after}
                alt={`รูปมื้อ${mealConfig.label}`}
                className="h-48 w-full object-cover"
              />
            </div>
          )}

          {/* Details (Food, Amount, Note) */}
          {(log.food || log.amount_g || log.note) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              {log.food && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-foreground">
                  🍖 {log.food}
                </span>
              )}
              {log.amount_g && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-foreground">
                  ⚖️ {log.amount_g} กรัม
                </span>
              )}
              {log.note && (
                <span className="rounded-md bg-secondary px-2.5 py-1 text-foreground">
                  📝 {log.note}
                </span>
              )}
            </div>
          )}
        </div>
      ) : displayStatus === "missed" ? (
        /* Missed state: ถึงเวลาของมื้อนั้นไปแล้วแต่ยังไม่มีการบันทึก */
        <div className="flex items-center justify-between rounded-xl border border-rose-200/60 bg-rose-50/40 px-3.5 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
            มื้อ{mealConfig.label}ไม่ได้บันทึก
          </span>
          <Link
            href={`/log?dog=${dogId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"
          >
            บันทึกย้อนหลัง
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        /* Pending state: ยังไม่ถึงเวลามื้ออาหาร */
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-secondary/20 px-3.5 py-3">
          <span className="text-xs text-muted-foreground font-medium">
            ยังไม่ถึงเวลามื้อ{mealConfig.label}
          </span>
          <Link
            href={`/log?dog=${dogId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            บันทึกล่วงหน้า
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </Card>
  )
}
