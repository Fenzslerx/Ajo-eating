"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dog, MealLog } from "@/lib/types";
import { Navigation } from "@/components/navigation";

type Period = 7 | 30;
type Day = { key: string; label: string; finished: number; total: number };

function dayKey(date: Date) { return date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); }
function rangeDays(period: Period): Day[] {
  const days: Day[] = [];
  for (let offset = period - 1; offset >= 0; offset--) {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - offset);
    days.push({ key: dayKey(date), label: new Intl.DateTimeFormat("th-TH", { day: "numeric", month: period === 30 ? "short" : undefined }).format(date), finished: 0, total: 0 });
  }
  return days;
}

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>(7);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [dogId, setDogId] = useState("all");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0);
    const supabase = createClient();
    const [dogResult, logResult] = await Promise.all([
      supabase.from("dogs").select("id,name,photo").order("created_at"),
      supabase.from("logs").select("id,dog_id,schedule_id,at,status,amount_g,food,note,photo").gte("at", since.toISOString()).order("at")
    ]);
    setDogs((dogResult.data ?? []) as Dog[]); setLogs((logResult.data ?? []) as MealLog[]); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    const result = rangeDays(period);
    const byKey = new Map(result.map((day) => [day.key, day]));
    logs.filter((log) => dogId === "all" || log.dog_id === dogId).forEach((log) => {
      const day = byKey.get(dayKey(new Date(log.at)));
      if (day) { day.total += 1; if (log.status === "finished") day.finished += 1; }
    });
    return result;
  }, [dogId, logs, period]);
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const finished = days.reduce((sum, day) => sum + day.finished, 0);
  const percentage = total ? Math.round((finished / total) * 100) : 0;
  const maxLabelStep = period === 30 ? 5 : 1;

  return <main className="mx-auto min-h-screen max-w-md px-5 py-8 pb-24"><p className="text-sm font-bold tracking-wide text-orange-600">DOGMEAL</p><h1 className="mt-1 text-3xl font-bold">สถิติการกิน</h1>
    <div className="mt-6 flex rounded-xl bg-orange-50 p-1"><button onClick={() => setPeriod(7)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${period === 7 ? "bg-white text-orange-600 shadow-sm" : "text-stone-500"}`}>7 วัน</button><button onClick={() => setPeriod(30)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${period === 30 ? "bg-white text-orange-600 shadow-sm" : "text-stone-500"}`}>30 วัน</button></div>
    <label className="mt-4 block text-sm font-bold">น้องหมา<select value={dogId} onChange={(event) => setDogId(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"><option value="all">น้องหมาทุกตัว</option>{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select></label>
    {loading ? <p className="py-16 text-center text-stone-500">กำลังโหลด...</p> : <><section className="mt-5 rounded-3xl bg-orange-500 p-6 text-white"><p className="text-sm font-semibold text-orange-100">กินหมดใน {period} วันที่ผ่านมา</p><p className="mt-1 text-5xl font-black">{percentage}%</p><p className="mt-2 text-sm text-orange-100">{finished} จาก {total} มื้อที่บันทึก</p></section>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100"><h2 className="text-lg font-bold">เปอร์เซ็นต์กินหมดรายวัน</h2><div className="mt-6 flex h-44 items-end gap-1.5">{days.map((day, index) => { const value = day.total ? Math.round(day.finished / day.total * 100) : 0; return <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col justify-end"><p className="mb-1 text-center text-[10px] font-bold text-orange-600">{value || ""}</p><div title={`${day.label}: ${value}%`} className="rounded-t-md bg-orange-400 transition-all" style={{ height: `${value}%`, minHeight: value ? "5px" : "0" }} /><p className="mt-2 truncate text-center text-[9px] text-stone-500">{index % maxLabelStep === 0 ? day.label : ""}</p></div>; })}</div><div className="mt-3 flex justify-between border-t border-stone-100 pt-3 text-xs text-stone-500"><span>0%</span><span>100%</span></div></section>
      <section className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-stone-500">กินหมด</p><p className="mt-1 text-2xl font-black text-emerald-600">{finished}</p></div><div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-stone-500">บันทึกทั้งหมด</p><p className="mt-1 text-2xl font-black text-stone-700">{total}</p></div></section></>}
    <Navigation active="stats" />
  </main>;
}
