"use client";

import { useEffect } from "react";
import { Dog, MealLog, Schedule } from "@/lib/types";

const notificationKey = (scheduleId: string, date: string) => `dogmeal-notified:${scheduleId}:${date}`;

export function MealReminders({ dogs, schedules, logs }: { dogs: Dog[]; schedules: Schedule[]; logs: MealLog[] }) {
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const clock = now.toTimeString().slice(0, 5);
      schedules.forEach((schedule) => {
        const hasLog = logs.some((log) => log.schedule_id === schedule.id && new Date(log.at).toDateString() === now.toDateString());
        const key = notificationKey(schedule.id, date);
        if (schedule.time.slice(0, 5) <= clock && !hasLog && !localStorage.getItem(key)) {
          const dog = dogs.find((item) => item.id === schedule.dog_id);
          new Notification("DogMeal · ถึงเวลามื้ออาหาร", { body: `${dog?.name ?? "น้องหมา"} — ${schedule.label}` });
          localStorage.setItem(key, "1");
        }
      });
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [dogs, schedules, logs]);
  return null;
}
