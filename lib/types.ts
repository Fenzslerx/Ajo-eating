export type Dog = {
  id: string
  name: string
  photo: string | null
  owner_id: string
}

export type Schedule = {
  id: string
  dog_id: string
  label: string
  time: string
}

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
}

export type MemberRole = "owner" | "member" | "editor" | "viewer"

export type DogMember = {
  dog_id: string
  user_id: string
  role: MemberRole
}

export type Profile = {
  id: string
  name: string
  email: string
}
