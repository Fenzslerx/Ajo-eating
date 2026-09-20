"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dog, LogStatus, MealLog, Schedule } from "@/lib/types";
import { StatusPicker } from "@/components/status-picker";
import { Navigation } from "@/components/navigation";
import { queueLog } from "@/lib/offline-queue";

type FormState = { dogId: string; scheduleId: string; at: string; status: LogStatus; amount: string; food: string; note: string };
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function LogPageContent() {
  const router = useRouter(); const params = useSearchParams(); const editId = params.get("edit");
  const [dogs, setDogs] = useState<Dog[]>([]); const [schedules, setSchedules] = useState<Schedule[]>([]); const [history, setHistory] = useState<MealLog[]>([]);
  const [form, setForm] = useState<FormState>({ dogId: params.get("dog") ?? "", scheduleId: "", at: localNow(), status: "finished", amount: "", food: "", note: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((old) => ({ ...old, [key]: value }));

  const load = useCallback(async () => {
    const supabase = createClient();
    const [dogResult, scheduleResult, logResult] = await Promise.all([
      supabase.from("dogs").select("id,name,photo").order("created_at"),
      supabase.from("schedules").select("id,dog_id,label,time").order("time"),
      supabase.from("logs").select("id,dog_id,schedule_id,at,status,amount_g,food,note,photo").order("at", { ascending: false }).limit(20)
    ]);
    const loadedDogs = (dogResult.data ?? []) as Dog[]; setDogs(loadedDogs); setSchedules((scheduleResult.data ?? []) as Schedule[]); setHistory((logResult.data ?? []) as MealLog[]);
    if (!form.dogId && loadedDogs[0]) set("dogId", loadedDogs[0].id);
    if (editId && logResult.data) {
      const log = (logResult.data as MealLog[]).find((item) => item.id === editId);
      if (log) setForm({ dogId: log.dog_id, scheduleId: log.schedule_id ?? "", at: new Date(log.at).toISOString().slice(0, 16), status: log.status, amount: log.amount_g?.toString() ?? "", food: log.food ?? "", note: log.note ?? "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dogmeal-log-editor")
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);
  const dogSchedules = schedules.filter((item) => item.dog_id === form.dogId);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!form.dogId) return;
    setSaving(true); setMessage("");
    if (!navigator.onLine && editId) { setSaving(false); setMessage("การแก้ไขบันทึกต้องเชื่อมต่ออินเทอร์เน็ต"); return; }
    const basePayload = { dog_id: form.dogId, schedule_id: form.scheduleId || null, at: new Date(form.at).toISOString(), status: form.status, amount_g: form.amount ? Number(form.amount) : null, food: form.food || null, note: form.note || null };
    if (!navigator.onLine) {
      await queueLog({ ...basePayload, photo: photo ?? undefined });
      setSaving(false); setMessage("บันทึกและรูปถูกเก็บไว้ในเครื่องแล้ว จะส่งเมื่อออนไลน์");
      setForm((old) => ({ ...old, amount: "", food: "", note: "", at: localNow() })); setPhoto(null);
      return;
    }
    let photoPath: string | undefined;
    if (photo) {
      const extension = photo.name.split(".").pop() || "jpg";
      const path = `${form.dogId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await createClient().storage.from("dog-photos").upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadError) { setSaving(false); setMessage("อัปโหลดรูปไม่สำเร็จ"); return; }
      photoPath = path;
    }
    const payload = { ...basePayload, ...(photoPath ? { photo: photoPath } : {}) };
    const query = editId ? createClient().from("logs").update(payload).eq("id", editId) : createClient().from("logs").insert(payload);
    const { error } = await query; setSaving(false);
    if (error) setMessage("บันทึกไม่สำเร็จ กรุณาลองใหม่"); else { setMessage("บันทึกแล้ว"); router.replace("/log"); load(); }
  }
  async function remove() { if (!editId || !confirm("ลบบันทึกนี้ใช่ไหม?")) return; await createClient().from("logs").delete().eq("id", editId); router.replace("/log"); load(); }

  return <main className="mx-auto min-h-screen max-w-md px-5 py-8 pb-24"><p className="text-sm font-bold tracking-wide text-orange-600">DOGMEAL</p><h1 className="mt-1 text-3xl font-bold">{editId ? "แก้ไขบันทึก" : "บันทึกมื้ออาหาร"}</h1>
    <form onSubmit={submit} className="mt-6 space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
      <label className="block text-sm font-bold">น้องหมา<select required value={form.dogId} onChange={(e) => { set("dogId", e.target.value); set("scheduleId", ""); }} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"><option value="">เลือกน้องหมา</option>{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select></label>
      <label className="block text-sm font-bold">มื้ออาหาร<select value={form.scheduleId} onChange={(e) => set("scheduleId", e.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"><option value="">มื้อเพิ่มเติม</option>{dogSchedules.map((meal) => <option key={meal.id} value={meal.id}>{meal.label} ({meal.time.slice(0, 5)})</option>)}</select></label>
      <div><p className="mb-2 text-sm font-bold">กินแค่ไหน</p><StatusPicker value={form.status} onChange={(status) => set("status", status)} /></div>
      <label className="block text-sm font-bold">วันและเวลา<input type="datetime-local" value={form.at} onChange={(e) => set("at", e.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">ปริมาณ (กรัม)<input inputMode="decimal" min="0" type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3" /></label><label className="block text-sm font-bold">อาหาร<input value={form.food} onChange={(e) => set("food", e.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-3" /></label></div>
      <label className="block text-sm font-bold">โน้ต<textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-stone-200 px-3 py-3" /></label>
      <label className="block text-sm font-bold">รูปอาหาร<input accept="image/*" type="file" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-bold file:text-orange-700" /></label>
      <button disabled={saving || !form.dogId} className="w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>{editId && <button type="button" onClick={remove} className="w-full py-1 text-sm font-bold text-red-500">ลบบันทึกนี้</button>}{message && <p className="text-center text-sm text-stone-600">{message}</p>}
    </form>
    {!editId && history.length > 0 && <section className="mt-7"><h2 className="text-lg font-bold">บันทึกล่าสุด</h2><div className="mt-3 space-y-2">{history.map((log) => <button onClick={() => router.push(`/log?edit=${log.id}`)} key={log.id} className="flex w-full justify-between rounded-xl bg-white px-4 py-3 text-left shadow-sm"><span>{dogs.find((dog) => dog.id === log.dog_id)?.name ?? "น้องหมา"}</span><span className="font-semibold text-orange-600">{log.status === "finished" ? "กินหมด" : log.status === "partial" ? "กินบางส่วน" : "ไม่กิน"}</span></button>)}</div></section>}
    <Navigation active="log" />
  </main>;
}

export default function LogPage() {
  return <Suspense fallback={<main className="mx-auto min-h-screen max-w-md px-5 py-16 text-center text-stone-500">กำลังโหลด...</main>}><LogPageContent /></Suspense>;
}
