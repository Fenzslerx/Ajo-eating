import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StatusChip } from "@/components/status-chip"
import type { MealLog, Schedule } from "@/lib/types"

export function DogHeader({
  name,
  photo,
  latestLog,
  latestSchedule,
}: {
  name: string
  photo: string | null
  latestLog: MealLog | null
  latestSchedule: Schedule | null
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-12 border border-border">
        {photo && <AvatarImage src={photo || "/placeholder.svg"} alt={`รูปของ${name}`} />}
        <AvatarFallback className="bg-secondary text-lg">🐶</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-tight text-foreground">{name}</h2>
        {latestLog && latestSchedule ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>มื้อล่าสุด: {latestSchedule.label}</span>
            <StatusChip status={latestLog.status} />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">ยังไม่มีบันทึกวันนี้</span>
        )}
      </div>
    </div>
  )
}
