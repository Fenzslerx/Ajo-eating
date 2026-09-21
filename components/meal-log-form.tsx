"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, CircleDashed, Clock, Sparkles, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhotoPicker } from "@/components/photo-picker"
import { cn } from "@/lib/utils"
import {
  getMealConfig,
  resolveMealKeyForRecord,
  formatRecordedTime,
  type MealKey,
} from "@/lib/meal-utils"
import type { Dog, MealStatus } from "@/lib/types"

const STATUS_OPTIONS: { status: MealStatus; label: string; icon: typeof CheckCircle2; color: string }[] = [
  { status: "finished", label: "กินหมด", icon: CheckCircle2, color: "text-emerald-500" },
  { status: "partial", label: "กินบางส่วน", icon: CircleDashed, color: "text-amber-500" },
  { status: "none", label: "ไม่กิน", icon: XCircle, color: "text-rose-500" },
]

const FOOD_PRESETS = ["อาหารเม็ด", "อกไก่ต้ม", "อาหารเปียก", "บาร์ฟ"]
const AMOUNT_PRESETS = ["50", "100", "150", "200"]

export type MealLogFormValues = {
  dogId: string
  status: MealStatus
  amountG: string
  food: string
  note: string
  photoAfter: string | null
  mealType: MealKey
  recordedAt: string
}

export function MealLogForm({
  dogs,
  initialValues,
  submitLabel = "บันทึกมื้ออาหาร",
  readOnly = false,
  readOnlyMessage,
  onDogChange,
  onSubmit,
}: {
  dogs: Dog[]
  initialValues?: Partial<MealLogFormValues>
  submitLabel?: string
  readOnly?: boolean
  readOnlyMessage?: string
  onDogChange?: (dogId: string) => void
  onSubmit: (values: MealLogFormValues) => void
}) {
  const [dogId, setDogId] = useState(initialValues?.dogId ?? dogs[0]?.id ?? "")
  const [status, setStatus] = useState<MealStatus>(initialValues?.status ?? "finished")
  const [amountG, setAmountG] = useState(initialValues?.amountG ?? "")
  const [food, setFood] = useState(initialValues?.food ?? "")
  const [note, setNote] = useState(initialValues?.note ?? "")
  const [photoAfter, setPhotoAfter] = useState<string | null>(initialValues?.photoAfter ?? null)

  // Real-time system time calculation
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const currentMealKey = resolveMealKeyForRecord(now)
  const currentMealConfig = getMealConfig(currentMealKey)
  const currentFormattedTime = formatRecordedTime(now)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        const submitNow = new Date()
        const resolvedMealKey = resolveMealKeyForRecord(submitNow)
        const resolvedTime = formatRecordedTime(submitNow)

        onSubmit({
          dogId,
          status,
          amountG,
          food,
          note,
          photoAfter,
          mealType: resolvedMealKey,
          recordedAt: resolvedTime,
        })
      }}
    >
      {/* Dog Selection (Only show pills if multiple dogs) */}
      {dogs.length > 1 && (
        <div className="flex flex-col gap-2">
          <Label>น้องหมา</Label>
          <div className="flex flex-wrap gap-2">
            {dogs.map((dog) => (
              <button
                key={dog.id}
                type="button"
                onClick={() => {
                  setDogId(dog.id)
                  onDogChange?.(dog.id)
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all",
                  dogId === dog.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                🐶 {dog.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Auto-detected Meal Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">คำนวณมื้ออาหารอัตโนมัติ</span>
            </div>
            <span className="text-base font-bold text-foreground">
              มื้อ{currentMealConfig.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-2xs border border-border">
          <Clock className="size-3.5 text-muted-foreground" />
          <span>{currentFormattedTime} น.</span>
        </div>
      </div>

      {/* Status Selection */}
      <div className="flex flex-col gap-2">
        <Label>สถานะการกิน</Label>
        <div className="grid grid-cols-3 gap-2">
          {STATUS_OPTIONS.map(({ status: s, label, icon: Icon, color }) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium transition-all active:scale-95",
                status === s
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-sm"
                  : "border-border bg-secondary/40 text-secondary-foreground hover:bg-secondary"
              )}
            >
              <Icon className={cn("size-5", status === s ? "text-primary" : color)} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Photo Picker */}
      <PhotoPicker
        id="photo-after"
        label="รูปอาหาร / รูปชามอาหาร"
        value={photoAfter}
        onChange={setPhotoAfter}
      />

      {/* Quick Food selection & Amount */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="food-input">ชื่ออาหาร</Label>
          <Input
            id="food-input"
            value={food}
            onChange={(e) => setFood(e.target.value)}
            placeholder="เช่น อาหารเม็ด, อกไก่"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {FOOD_PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFood(item)}
                className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary active:scale-95"
              >
                + {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="amount-input">ปริมาณ (กรัม)</Label>
          <Input
            id="amount-input"
            type="number"
            min={0}
            inputMode="numeric"
            value={amountG}
            onChange={(e) => setAmountG(e.target.value)}
            placeholder="เช่น 150"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {AMOUNT_PRESETS.map((grams) => (
              <button
                key={grams}
                type="button"
                onClick={() => setAmountG(grams)}
                className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary active:scale-95"
              >
                {grams}g
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-input">บันทึกเพิ่มเติม (ไม่บังคับ)</Label>
        <Textarea
          id="note-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น กินเกลี้ยง, ใส่ยาบำรุงด้วย"
          rows={2}
        />
      </div>

      {readOnly && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-center text-xs text-blue-600 dark:text-blue-400">
          {readOnlyMessage || "คุณมีสิทธิ์เข้าดูอย่างเดียว (Viewer) ไม่สามารถบันทึกหรือแก้ไขมื้ออาหารได้"}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="min-h-12 rounded-full font-semibold"
        disabled={!dogId || readOnly}
      >
        {readOnly ? "ไม่มีสิทธิ์บันทึกข้อมูล (Viewer)" : submitLabel}
      </Button>
    </form>
  )
}
