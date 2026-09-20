"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dog, LogStatus, MealLog, Schedule, statusLabel } from "@/lib/types";
import { Navigation } from "@/components/navigation";

type Range = "today" | "7d" | "30d";

const startFor = (range: Range) => {
  const date = new Date(); date.setHours(0, 0, 0, 0);
  if (range === "7d") date.setDate(date.getDate() - 6);
  if (range === "30d") date.setDate(date.getDate() - 29);
  return date.toISOString();
};

export default function HistoryPage() {
  const [range, setRange] = useState<Range>("7d");
  const [dogId, setDogId] = useState("all");
  const [status, setStatus] = useState<LogStatus | "all">("all");
  const [dogs, setDogs] = useState<Dog[]>([]); const [schedules, setSchedules] = useState<Schedule[]>([]); const [logs, setLogs] = useState<MealLog[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [dogResult, scheduleResult, logResult] = await Promise.all([
      supabase.from("dogs").select("id,name,photo").order("created_at"),
      supabase.from("schedules").select("id,dog_id,label,time"),
      supabase.from("logs").select("id,dog_id,schedule_id,at,status,amount_g,food,note,photo").gte("at", startFor(range)).order("at", { ascending: false })
    ]);
    setDogs((dogResult.data ?? []) as Dog[]); setSchedules((scheduleResult.data ?? []) as Schedule[]); setLogs((logResult.data ?? []) as MealLog[]);
  }, [range]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => logs.filter((log) => (dogId === "all" || log.dog_id === dogId) && (status === "all" || log.status === status)), [logs, dogId, status]);

  return <main className="mx-auto min-h-screen max-w-md px-4 pt-6 pb-24"><header><p className="text-xs font-bold tracking-[.2em] text-orange-500">DOGMEAL</p><h1 className="mt-1 text-2xl font-bold">ประวัติ</h1></header>
    <div className="mt-5 flex gap-2 rounded-2xl bg-orange-100/70 p-1">{(["today", "7d", "30d"] as Range[]).map((item) => <button key={item} onClick={() => setRange(item)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${range === item ? "bg-white text-orange-600 shadow-sm" : "text-stone-500"}`}>{item === "today" ? "วันนี้" : item === "7d" ? "7 วัน" : "30 วัน"}</button>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2"><select value={dogId} onChange={(e) => setDogId(e.target.value)} className="rounded-xl border border-orange-100 bg-white px-3 py-3 text-sm"><option value="all">น้องหมาทุกตัว</option>{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value as LogStatus | "all")} className="rounded-xl border border-orange-100 bg-white px-3 py-3 text-sm"><option value="all">ทุกสถานะ</option>{(Object.keys(statusLabel) as LogStatus[]).map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}</select></div>
    <div className="mt-5 space-y-2">{filtered.map((log) => <article key={log.id} className="flex items-center justify-between rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><div><p className="font-bold">{dogs.find((dog) => dog.id === log.dog_id)?.name ?? "น้องหมา"} · {schedules.find((schedule) => schedule.id === log.schedule_id)?.label ?? "มื้อเพิ่มเติม"}</p><p className="mt-1 text-xs text-stone-500">{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(log.at))}{log.amount_g ? ` · ${log.amount_g} กรัม` : ""}</p>{log.note && <p className="mt-2 text-sm text-stone-600">{log.note}</p>}</div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${log.status === "finished" ? "bg-emerald-100 text-emerald-700" : log.status === "partial" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>{statusLabel[log.status]}</span></article>)}{!filtered.length && <p className="py-16 text-center text-sm text-stone-500">ไม่พบบันทึกที่ตรงกับตัวกรอง</p>}</div>
    <Navigation active="history" />
  </main>;
}
