export type Dog = {
  id: string
  name: string
  photo: string | null
  owner_id: string
  breed?: string | null
  birthdate?: string | null
}

export type Schedule = {
  id: string
  dog_id: string
  label: string
  time: string
}

export type MealType = "morning" | "noon" | "evening" | string

export type MealStatus = "finished" | "partial" | "none"
export type LogStatus = MealStatus
export const statusLabel: Record<MealStatus, string> = { finished: "กินหมด", partial: "กินบางส่วน", none: "ไม่กิน" }

export type MealLog = {
  id: string
  dog_id: string
  schedule_id: string | null
  at: string
  status: MealStatus
  amount_g: number | null
  food: string | null
  note: string | null
  photo_before: string | null
  photo_after: string | null
  by: string
  mealType?: MealType
  recordedAt?: string
}

export type MemberRole = "owner" | "caretaker" | "viewer" | "member" | "editor"

export type DogMember = {
  dog_id: string
  user_id: string
  role: MemberRole
  email?: string
  created_at?: string
}

export type DogInvite = {
  id: string
  dog_id: string
  token: string
  role: "caretaker" | "viewer"
  status: "pending" | "accepted" | "revoked" | "expired"
  expires_at: string
  created_at: string
}

export type Profile = {
  id: string
  name: string
  email: string
}

export type AppNotification = {
  id: string
  dog_id: string
  user_id: string
  meal_key: string
  schedule_id: string | null
  message: string
  is_read: boolean
  created_at: string
}
