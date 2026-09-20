"use client"

import { useState } from "react"
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PhotoPicker } from "@/components/photo-picker"
import { cn } from "@/lib/utils"
import type { Dog, MealStatus, Schedule } from "@/lib/types"

const STATUS_OPTIONS: { status: MealStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { status: "finished", label: "กินหมด", icon: CheckCircle2 },
  { status: "partial", label: "กินบางส่วน", icon: CircleDashed },
  { status: "none", label: "ไม่กิน", icon: XCircle },
]

export type MealLogFormValues = {
  dogId: string
  scheduleId: string | null
  status: MealStatus
  amountG: string
  food: string
  note: string
  photoAfter: string | null
  at: string
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MealLogForm({
  dogs,
  schedules,
  initialValues,
  submitLabel = "บันทึกมื้ออาหาร",
  onSubmit,
}: {
  dogs: Dog[]
  schedules: Schedule[]
  initialValues?: Partial<MealLogFormValues>
  submitLabel?: string
  onSubmit: (values: MealLogFormValues) => void
}) {
  const [dogId, setDogId] = useState(initialValues?.dogId ?? dogs[0]?.id ?? "")
  const [scheduleId, setScheduleId] = useState<string | null>(initialValues?.scheduleId ?? null)
  const [status, setStatus] = useState<MealStatus>(initialValues?.status ?? "finished")
  const [amountG, setAmountG] = useState(initialValues?.amountG ?? "")
  const [food, setFood] = useState(initialValues?.food ?? "")
  const [note, setNote] = useState(initialValues?.note ?? "")
  const [photoAfter, setPhotoAfter] = useState<string | null>(initialValues?.photoAfter ?? null)
  const [at, setAt] = useState(
    initialValues?.at ? toLocalInputValue(initialValues.at) : toLocalInputValue(new Date().toISOString()),
  )

  const dogSchedules = schedules.filter((s) => s.dog_id === dogId)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          dogId,
          scheduleId,
          status,
          amountG,
          food,
          note,
          photoAfter,
          at: new Date(at).toISOString(),
        })
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="dog-select">น้องหมา</Label>
        <Select value={dogId} onValueChange={(v) => { if (v) setDogId(v); setScheduleId(null) }}>
          <SelectTrigger id="dog-select">
            <SelectValue placeholder="เลือกน้องหมา">
              {(value: string) => dogs.find((d) => d.id === value)?.name ?? "เลือกน้องหมา"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {dogs.map((dog) => (
              <SelectItem key={dog.id} value={dog.id}>
                {dog.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="schedule-select">มื้ออาหาร</Label>
        <Select value={scheduleId ?? "none"} onValueChange={(v) => setScheduleId(v === "none" ? null : v)}>
          <SelectTrigger id="schedule-select">
            <SelectValue placeholder="เลือกมื้ออาหาร">
              {(value: string) => {
                if (value === "none") return "ไม่ระบุมื้อ"
                const s = dogSchedules.find((sc) => sc.id === value)
                return s ? `${s.label} · ${s.time} น.` : "เลือกมื้ออาหาร"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">ไม่ระบุมื้อ</SelectItem>
            {dogSchedules.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label} · {s.time} น.
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">สถานะการกิน</legend>
        <div className="grid grid-cols-3 gap-2">
          {STATUS_OPTIONS.map(({ status: s, label, icon: Icon }) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium transition-colors",
                status === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/40 text-secondary-foreground hover:bg-secondary/70",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="at-input">เวลา</Label>
        <Input id="at-input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="food-input">ชื่ออาหาร</Label>
          <Input
            id="food-input"
            value={food}
            onChange={(e) => setFood(e.target.value)}
            placeholder="เช่น อาหารเม็ดไก่"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note-input">บันทึกเพิ่มเติม</Label>
        <Textarea
          id="note-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น กินช้ากว่าปกติ"
          rows={3}
        />
      </div>

      <PhotoPicker id="photo-after" label="รูปหลังกิน" value={photoAfter} onChange={setPhotoAfter} />

      <Button type="submit" size="lg" className="min-h-12 rounded-full" disabled={!dogId}>
        {submitLabel}
      </Button>
    </form>
  )
}
