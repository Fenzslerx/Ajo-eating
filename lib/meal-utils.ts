export type MealKey = "morning" | "noon" | "evening"

export interface MealConfigItem {
  key: MealKey
  label: string
  startHour: number
  endHour: number
}

/**
 * Global configuration for meal periods.
 * - morning: 05:00 - 12:00
 * - noon: 12:00 - 17:00
 * - evening: 17:00 - 21:00
 */
export const MEAL_CONFIG: MealConfigItem[] = [
  { key: "morning", label: "เช้า", startHour: 5, endHour: 12 },
  { key: "noon", label: "เที่ยง", startHour: 12, endHour: 17 },
  { key: "evening", label: "เย็น", startHour: 17, endHour: 21 },
]

/** Grace period in minutes after endHour before marking as "missed" */
export const GRACE_MINUTES = 15

export type MealDisplayStatus = "recorded" | "missed" | "pending"

/**
 * Get date components in Asia/Bangkok timezone.
 */
export function getBangkokParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const partMap: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== "literal") {
      partMap[p.type] = parseInt(p.value, 10)
    }
  }

  return {
    year: partMap.year,
    month: partMap.month, // 1-indexed
    day: partMap.day,
    hour: partMap.hour === 24 ? 0 : partMap.hour,
    minute: partMap.minute,
    second: partMap.second,
  }
}

/**
 * Check if two dates are the same calendar day in Asia/Bangkok.
 */
export function isSameBangkokDay(d1: Date | string, d2: Date | string): boolean {
  const date1 = typeof d1 === "string" ? new Date(d1) : d1
  const date2 = typeof d2 === "string" ? new Date(d2) : d2
  const p1 = getBangkokParts(date1)
  const p2 = getBangkokParts(date2)
  return p1.year === p2.year && p1.month === p2.month && p1.day === p2.day
}

/**
 * Calculates the meal type (key) based on time in Asia/Bangkok timezone.
 * Returns null or "off-hours" if outside all configured ranges (e.g. 02:00 or 22:00).
 */
export function getMealTypeFromTime(date: Date = new Date()): MealKey | null {
  const { hour } = getBangkokParts(date)
  for (const config of MEAL_CONFIG) {
    if (hour >= config.startHour && hour < config.endHour) {
      return config.key
    }
  }
  return null
}

/**
 * Resolves meal key when saving a record, handling off-hours edge case:
 * If recording between 21:00 and 05:00 (off-hours), we fallback to the closest meal:
 * - 21:00 - 23:59: late night recording fallback to "evening" (มื้อเย็นที่เพิ่งผ่านไป)
 * - 00:00 - 04:59: early dawn recording fallback to "morning" (เตรียมมื้อเช้าตรู่)
 */
export function resolveMealKeyForRecord(date: Date = new Date()): MealKey {
  const calculated = getMealTypeFromTime(date)
  if (calculated) {
    return calculated
  }
  const { hour } = getBangkokParts(date)
  if (hour < 5) {
    // Early dawn before 5:00 -> prepare for morning
    return "morning"
  }
  // Late night after 21:00 -> fallback to evening
  return "evening"
}

/**
 * Format timestamp into HH:mm (Asia/Bangkok).
 */
export function formatRecordedTime(dateOrIso: Date | string = new Date()): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso
  const { hour, minute } = getBangkokParts(date)
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function getMealConfig(mealKey: MealKey): MealConfigItem {
  const found = MEAL_CONFIG.find((m) => m.key === mealKey)
  return found ?? MEAL_CONFIG[0]
}

/**
 * Helper to determine a log's meal key (either stored in mealType or derived from log.at timestamp)
 */
export function getLogMealKey(log: { at: string; mealType?: string | null }): MealKey {
  if (log.mealType === "morning" || log.mealType === "noon" || log.mealType === "evening") {
    return log.mealType
  }
  return resolveMealKeyForRecord(new Date(log.at))
}

/**
 * Determine the status of a specific meal: "recorded" | "missed" | "pending"
 *
 * - "recorded": A record for this mealKey exists in targetDay logs
 * - "missed": No record AND current time is past (meal.endHour + GRACE_MINUTES)
 * - "pending": No record AND current time is before (meal.endHour + GRACE_MINUTES)
 *
 * Automatically resets status at midnight for new calendar day.
 */
export function getMealStatus(
  mealKey: MealKey,
  dayLogs: Array<{ at: string; mealType?: string | null }>,
  targetDate: Date,
  now: Date = new Date()
): MealDisplayStatus {
  // 1. Check if recorded
  const hasRecord = dayLogs.some((l) => getLogMealKey(l) === mealKey)
  if (hasRecord) {
    return "recorded"
  }

  const targetParts = getBangkokParts(targetDate)
  const nowParts = getBangkokParts(now)

  const targetDayNum = targetParts.year * 10000 + targetParts.month * 100 + targetParts.day
  const nowDayNum = nowParts.year * 10000 + nowParts.month * 100 + nowParts.day

  // If viewing a previous day and no record: missed
  if (targetDayNum < nowDayNum) {
    return "missed"
  }

  // If viewing a future day: pending
  if (targetDayNum > nowDayNum) {
    return "pending"
  }

  // Same day (Today): compare current minutes with (endHour * 60 + GRACE_MINUTES)
  const config = getMealConfig(mealKey)
  const currentMinutes = nowParts.hour * 60 + nowParts.minute
  const cutoffMinutes = config.endHour * 60 + GRACE_MINUTES

  if (currentMinutes >= cutoffMinutes) {
    return "missed"
  }

  return "pending"
}
