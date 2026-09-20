"use client"

import { useRef } from "react"
import { Camera, CheckCircle2, CircleDashed, Edit3, ImagePlus, Moon, Sun, Utensils, X, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StatusChip } from "@/components/status-chip"
import type { MealLog, MealStatus, Schedule } from "@/lib/types"

const STATUS_ACTIONS: { status: MealStatus; label: string; icon: typeof CheckCircle2; color: string }[] = [
  { status: "finished", label: "กินหมด", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
  { status: "partial", label: "กินบางส่วน", icon: CircleDashed, color: "text-amber-600 dark:text-amber-400" },
  { status: "none", label: "ไม่กิน", icon: XCircle, color: "text-rose-600 dark:text-rose-400" },
]

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
  onStatusChange,
  onPhotoChange,
  onOpenDetail,
}: {
  schedule: Schedule
  log: MealLog | null
  onStatusChange: (status: MealStatus) => void
  onPhotoChange?: (photoUrl: string | null) => void
  onOpenDetail?: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onPhotoChange) return
    const url = URL.createObjectURL(file)
    onPhotoChange(url)
    e.target.value = ""
  }

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

        {log && (
          <div className="flex items-center gap-1.5">
            <StatusChip status={log.status} />
            {onOpenDetail && (
              <button
                type="button"
                onClick={onOpenDetail}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="แก้ไขรายละเอียด"
                title="แก้ไขรายละเอียด"
              >
                <Edit3 className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {STATUS_ACTIONS.map(({ status, label, icon: Icon, color }) => {
          const isSelected = log?.status === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium transition-all active:scale-95 ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-sm"
                  : "border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary"
              }`}
            >
              <Icon className={`size-4 ${isSelected ? "text-primary" : color}`} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Photo Section for THIS specific meal */}
      <div className="mt-1 flex flex-col gap-2">
        {log?.photo_after ? (
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={log.photo_after}
              alt={`รูปมื้อ${schedule.label}`}
              className="h-44 w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2.5 text-white">
              <span className="text-xs font-medium">รูปมื้อ{schedule.label}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-black/50 px-2 py-1 text-xs backdrop-blur hover:bg-black/80"
                >
                  เปลี่ยนรูป
                </button>
                {onPhotoChange && (
                  <button
                    type="button"
                    onClick={() => onPhotoChange(null)}
                    className="flex size-6 items-center justify-center rounded-lg bg-red-600/80 hover:bg-red-700"
                    aria-label="ลบรูป"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Camera className="size-4 text-primary" />
            <span>📷 ถ่ายรูป / ใส่รูปมื้อ{schedule.label}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileSelect}
        />
      </div>

      {/* Extra info badge if available */}
      {log && (log.food || log.amount_g || log.note) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          {log.food && <span className="rounded-md bg-secondary px-2 py-0.5">🍖 {log.food}</span>}
          {log.amount_g && <span className="rounded-md bg-secondary px-2 py-0.5">⚖️ {log.amount_g}g</span>}
          {log.note && <span className="rounded-md bg-secondary px-2 py-0.5">📝 {log.note}</span>}
        </div>
      )}
    </Card>
  )
}
