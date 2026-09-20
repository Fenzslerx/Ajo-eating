import { CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MealStatus } from "@/lib/types"

const STATUS_CONFIG: Record<
  MealStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  finished: {
    label: "กินหมด",
    icon: CheckCircle2,
    className: "bg-finished text-finished-foreground",
  },
  partial: {
    label: "กินบางส่วน",
    icon: CircleDashed,
    className: "bg-partial text-partial-foreground",
  },
  none: {
    label: "ไม่กิน",
    icon: XCircle,
    className: "bg-none-status text-none-status-foreground",
  },
}

export function StatusChip({
  status,
  className,
}: {
  status: MealStatus
  className?: string
}) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}
