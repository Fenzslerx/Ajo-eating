import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StatusChip } from "@/components/status-chip"
import { getMealConfig, getLogMealKey } from "@/lib/meal-utils"
import type { MealLog, Schedule } from "@/lib/types"

export function DogHeader({
  name,
  photo,
  latestLog,
  latestSchedule,
  breed,
  birthdate,
}: {
  name: string
  photo: string | null
  latestLog: MealLog | null
  latestSchedule?: Schedule | null
  breed?: string | null
  birthdate?: string | null
}) {
  const mealLabel = latestLog
    ? latestSchedule?.label ?? getMealConfig(getLogMealKey(latestLog)).label
    : null

  // Calculate age if birthdate is available
  let ageText = ""
  if (birthdate) {
    const birth = new Date(birthdate)
    if (!isNaN(birth.getTime())) {
      const now = new Date()
      const diffYears = now.getFullYear() - birth.getFullYear()
      const diffMonths = now.getMonth() - birth.getMonth()
      const totalMonths = diffYears * 12 + diffMonths
      if (totalMonths >= 12) {
        const y = Math.floor(totalMonths / 12)
        const m = totalMonths % 12
        ageText = m > 0 ? `${y} ปี ${m} เดือน` : `${y} ปี`
      } else if (totalMonths > 0) {
        ageText = `${totalMonths} เดือน`
      }
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-14 border border-border shadow-xs">
        {photo && <AvatarImage src={photo || "/placeholder.svg"} alt={`รูปของ${name}`} />}
        <AvatarFallback className="bg-secondary text-2xl">🐶</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold leading-tight text-foreground">{name}</h2>
          {breed && (
            <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {breed}
            </span>
          )}
        </div>

        {ageText && (
          <span className="text-xs text-muted-foreground">อายุ {ageText}</span>
        )}

        {latestLog && mealLabel ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
            <span>มื้อล่าสุด: {mealLabel}</span>
            <StatusChip status={latestLog.status} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground pt-0.5">ยังไม่มีบันทึกวันนี้</span>
        )}
      </div>
    </div>
  )
}
