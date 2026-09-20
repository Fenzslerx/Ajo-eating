export type LogStatus = "finished" | "partial" | "none";

export type Dog = { id: string; name: string; photo: string | null };
export type Schedule = { id: string; dog_id: string; label: string; time: string };
export type MealLog = {
  id: string;
  dog_id: string;
  schedule_id: string | null;
  at: string;
  status: LogStatus;
  amount_g: number | null;
  food: string | null;
  note: string | null;
  photo: string | null;
};

export const statusLabel: Record<LogStatus, string> = {
  finished: "กินหมด",
  partial: "กินบางส่วน",
  none: "ไม่กิน"
};
