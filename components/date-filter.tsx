"use client"

import { cn } from "@/lib/utils"

export type DateRangeOption = "today" | "7d" | "30d"

export function DateFilter({
  value,
  onChange,
  options = ["today", "7d", "30d"],
}: {
  value: DateRangeOption
  onChange: (value: DateRangeOption) => void
  options?: DateRangeOption[]
}) {
  const labels: Record<DateRangeOption, string> = {
    today: "วันนี้",
    "7d": "7 วัน",
    "30d": "30 วัน",
  }

  return (
    <div
      role="tablist"
      aria-label="เลือกช่วงเวลา"
      className="inline-flex rounded-full bg-muted p-1"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={value === opt}
          onClick={() => onChange(opt)}
          className={cn(
            "min-h-9 rounded-full px-3 text-sm font-medium transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}
