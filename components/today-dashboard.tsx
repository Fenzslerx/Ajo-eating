"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Dog, MealLog, Schedule, statusLabel } from "@/lib/types";
import { QuickLog } from "./quick-log";
import { MealReminders } from "./meal-reminders";

const todayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

export function TodayDashboard() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const range = todayRange();
    const [dogsResult, schedulesResult, logsResult] = await Promise.all([
      supabase.from("dogs").select("id,name,photo").order("created_at"),
      supabase.from("schedules").select("id,dog_id,label,time").order("time"),
      supabase.from("logs").select("id,dog_id,schedule_id,at,status,amount_g,food,note,photo").gte("at", range.start).lt("at", range.end).order("at", { ascending: false })
    ]);
    const dogData = (dogsResult.data ?? []) as Dog[];
    const dogsWithPhotos = await Promise.all(dogData.map(async (dog) => {
      if (!dog.photo) return dog;
      const { data } = await supabase.storage.from("dog-photos").createSignedUrl(dog.photo, 60 * 60);
      return { ...dog, photo: data?.signedUrl ?? null };
    }));
    setDogs(dogsWithPhotos);
    setSchedules((schedulesResult.data ?? []) as Schedule[]);
    setLogs((logsResult.data ?? []) as MealLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dogmeal-today-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);
  const logsBySchedule = useMemo(() => new Map(logs.filter((log) => log.schedule_id).map((log) => [log.schedule_id!, log])), [logs]);

  if (loading) return <p className="py-16 text-center text-stone-500">กำลังโหลด...</p>;
  if (!dogs.length) return <section className="rounded-3xl bg-white p-6 text-center shadow-sm"><p className="text-3xl">🐶</p><h2 className="mt-3 text-xl font-bold">ยังไม่มีน้องหมา</h2><p className="mt-2 text-stone-600">เพิ่มโปรไฟล์น้องหมาได้ในหน้าตั้งค่า (เฟสถัดไป)</p></section>;

  return <><MealReminders dogs={dogs} schedules={schedules} logs={logs} /><div className="space-y-5">{dogs.map((dog) => {
    const meals = schedules.filter((schedule) => schedule.dog_id === dog.id);
    const unscheduled = logs.filter((log) => log.dog_id === dog.id && !log.schedule_id);
    return <section key={dog.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-orange-100">
      <div className="flex items-center gap-3 bg-orange-50 p-4">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white text-2xl">{dog.photo ? <img src={dog.photo} alt={dog.name} className="h-full w-full object-cover" /> : "🐕"}</div>
        <div><h2 className="text-xl font-bold">{dog.name}</h2><p className="text-sm text-stone-500">มื้ออาหารวันนี้</p></div>
      </div>
      <div className="space-y-3 p-4">
        {meals.map((meal) => {
          const log = logsBySchedule.get(meal.id);
          return <div key={meal.id} className="rounded-2xl border border-stone-100 p-3">
            <div className="mb-3 flex items-center justify-between"><span className="font-bold">{meal.label}</span><span className="text-sm text-stone-500">{meal.time.slice(0, 5)}</span></div>
            {log ? <Link href={`/log?edit=${log.id}`} className="block rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{statusLabel[log.status]} · แตะเพื่อแก้ไข</Link> : <QuickLog dogId={dog.id} scheduleId={meal.id} onSaved={load} />}
          </div>;
        })}
        {!meals.length && <QuickLog dogId={dog.id} onSaved={load} />}
        {unscheduled.length > 0 && <p className="text-xs text-stone-500">บันทึกเพิ่มเติม {unscheduled.length} รายการ</p>}
        <Link href={`/log?dog=${dog.id}`} className="block rounded-xl py-1 text-center text-sm font-bold text-orange-600">+ บันทึกรายละเอียด</Link>
      </div>
    </section>;
  })}</div></>;
}
