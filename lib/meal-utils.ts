export type MealKey = "morning" | "noon" | "evening" | string

export interface MealConfigItem {
  key: string
  label: string
  startHour: number
  endHour: number
}

/**
 * Default global configuration for meal periods.
 * - morning: 05:00 - 12:00
 * - noon: 12:00 - 17:00
 * - evening: 17:00 - 21:00
 */
export const DEFAULT_MEAL_CONFIG: MealConfigItem[] = [
  { key: "morning", label: "เช้า", startHour: 5, endHour: 12 },
  { key: "noon", label: "เที่ยง", startHour: 12, endHour: 17 },
  { key: "evening", label: "เย็น", startHour: 17, endHour: 21 },
]

export const MEAL_CONFIG_STORAGE_KEY = "custom_meal_config"
export const NOTIFICATIONS_STORAGE_KEY = "dogmeal_notifications_enabled"
export const DOG_PROFILE_STORAGE_KEY = "dogProfile"

/** Grace period in minutes after endHour before marking as "missed" */
export const GRACE_MINUTES = 15

export type MealDisplayStatus = "recorded" | "missed" | "pending"

/**
 * Get active meal configuration from localStorage (or fallback to DEFAULT_MEAL_CONFIG)
 */
export function getActiveMealConfig(): MealConfigItem[] {
  if (typeof window === "undefined") {
    return DEFAULT_MEAL_CONFIG
  }
  try {
    const raw = localStorage.getItem(MEAL_CONFIG_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.error("Failed to parse custom meal config:", e)
  }
  return DEFAULT_MEAL_CONFIG
}

/**
 * Save active meal config to localStorage and dispatch custom event for instant re-render across components
 */
export function saveActiveMealConfig(config: MealConfigItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(MEAL_CONFIG_STORAGE_KEY, JSON.stringify(config))
  window.dispatchEvent(new Event("meal-config-changed"))
}

/**
 * Reset active meal config back to default
 */
export function resetActiveMealConfig(): MealConfigItem[] {
  if (typeof window !== "undefined") {
    localStorage.removeItem(MEAL_CONFIG_STORAGE_KEY)
    window.dispatchEvent(new Event("meal-config-changed"))
  }
  return DEFAULT_MEAL_CONFIG
}

/**
 * For backwards compatibility
 */
export const MEAL_CONFIG = DEFAULT_MEAL_CONFIG

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
 * Uses customConfig if passed, or reads from storage.
 * Returns null if outside all configured ranges (off-hours).
 */
export function getMealTypeFromTime(
  date: Date = new Date(),
  customConfig?: MealConfigItem[]
): string | null {
  const configList = customConfig ?? getActiveMealConfig()
  const { hour } = getBangkokParts(date)
  for (const config of configList) {
    if (hour >= config.startHour && hour < config.endHour) {
      return config.key
    }
  }
  return null
}

/**
 * Resolves meal key when saving a record, handling off-hours edge case:
 * If recording between off-hours, fallback to closest meal.
 */
export function resolveMealKeyForRecord(
  date: Date = new Date(),
  customConfig?: MealConfigItem[]
): string {
  const configList = customConfig ?? getActiveMealConfig()
  if (configList.length === 0) return "morning"

  const calculated = getMealTypeFromTime(date, configList)
  if (calculated) {
    return calculated
  }

  const { hour } = getBangkokParts(date)
  const firstMeal = configList[0]
  const lastMeal = configList[configList.length - 1]

  if (hour < firstMeal.startHour) {
    return firstMeal.key
  }
  return lastMeal.key
}

/**
 * Format timestamp into HH:mm (Asia/Bangkok).
 */
export function formatRecordedTime(dateOrIso: Date | string = new Date()): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso
  const { hour, minute } = getBangkokParts(date)
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function getMealConfig(mealKey: string, customConfig?: MealConfigItem[]): MealConfigItem {
  const configList = customConfig ?? getActiveMealConfig()
  const found = configList.find((m) => m.key === mealKey)
  return (
    found ??
    configList[0] ?? { key: mealKey, label: mealKey, startHour: 8, endHour: 12 }
  )
}

/**
 * Helper to determine a log's meal key (either stored in mealType or derived from log.at timestamp)
 */
export function getLogMealKey(
  log: { at: string; mealType?: string | null },
  customConfig?: MealConfigItem[]
): string {
  if (log.mealType) {
    return log.mealType
  }
  return resolveMealKeyForRecord(new Date(log.at), customConfig)
}

/**
 * Determine the status of a specific meal: "recorded" | "missed" | "pending"
 *
 * - "recorded": A record for this mealKey exists in targetDay logs
 * - "missed": No record AND current time is past (meal.endHour + GRACE_MINUTES)
 * - "pending": No record AND current time is before (meal.endHour + GRACE_MINUTES)
 */
export function getMealStatus(
  mealKey: string,
  dayLogs: Array<{ at: string; mealType?: string | null }>,
  targetDate: Date,
  now: Date = new Date(),
  customConfig?: MealConfigItem[]
): MealDisplayStatus {
  // 1. Check if recorded
  const hasRecord = dayLogs.some((l) => getLogMealKey(l, customConfig) === mealKey)
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
  const config = getMealConfig(mealKey, customConfig)
  const currentMinutes = nowParts.hour * 60 + nowParts.minute
  const cutoffMinutes = config.endHour * 60 + GRACE_MINUTES

  if (currentMinutes >= cutoffMinutes) {
    return "missed"
  }

  return "pending"
}
