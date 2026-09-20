"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dog, Schedule } from "@/lib/types";
import { Navigation } from "@/components/navigation";

type Member = { user_id: string; email: string; role: "owner" | "member" };

export default function SettingsPage() {
  const [dogs, setDogs] = useState<(Dog & { owner_id: string })[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dogId, setDogId] = useState("");
  const [newDog, setNewDog] = useState("");
  const [newName, setNewName] = useState("");
  const [dogPhoto, setDogPhoto] = useState<File | null>(null);
  const [meal, setMeal] = useState(""); const [time, setTime] = useState("08:00");
  const [email, setEmail] = useState(""); const [message, setMessage] = useState("");
  const selected = dogs.find((dog) => dog.id === dogId);
  const notify = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(""), 3000); };

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: dogData } = await supabase.from("dogs").select("id,name,photo,owner_id").order("created_at");
    const loadedDogs = (dogData ?? []) as (Dog & { owner_id: string })[];
    setDogs(loadedDogs);
    const active = loadedDogs.some((dog) => dog.id === dogId) ? dogId : loadedDogs[0]?.id ?? "";
    if (active !== dogId) setDogId(active);
    if (!active) { setSchedules([]); setMembers([]); return; }
    const [scheduleResult, memberResult] = await Promise.all([
      supabase.from("schedules").select("id,dog_id,label,time").eq("dog_id", active).order("time"),
      supabase.rpc("get_dog_members", { target_dog_id: active })
    ]);
    setSchedules((scheduleResult.data ?? []) as Schedule[]);
    setMembers((memberResult.data ?? []) as Member[]);
  }, [dogId]);
  useEffect(() => { load(); }, [load]);

  async function addDog(event: FormEvent) {
    event.preventDefault(); if (!newDog.trim()) return;
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return notify("กรุณาเข้าสู่ระบบอีกครั้ง");
    const { data, error } = await supabase.from("dogs").insert({ name: newDog.trim(), owner_id: user.id }).select("id").single();
    if (error) return notify("เพิ่มน้องหมาไม่สำเร็จ");
    setNewDog(""); setDogId(data.id); notify("เพิ่มน้องหมาแล้ว");
  }
  async function renameDog() {
    if (!dogId || (!newName.trim() && !dogPhoto)) return;
    const supabase = createClient(); let photoPath: string | undefined;
    if (dogPhoto) {
      const extension = dogPhoto.name.split(".").pop() || "jpg";
      const path = `${dogId}/profile-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("dog-photos").upload(path, dogPhoto, { contentType: dogPhoto.type, upsert: false });
      if (uploadError) return notify("อัปโหลดรูปไม่สำเร็จ");
      photoPath = path;
    }
    const { error } = await supabase.from("dogs").update({ ...(newName.trim() ? { name: newName.trim() } : {}), ...(photoPath ? { photo: photoPath } : {}) }).eq("id", dogId);
    if (error) notify("บันทึกโปรไฟล์ได้เฉพาะเจ้าของ"); else { setNewName(""); setDogPhoto(null); notify("บันทึกโปรไฟล์แล้ว"); load(); }
  }
  async function deleteDog() {
    if (!dogId || !confirm(`ลบ ${selected?.name} และข้อมูลทั้งหมดใช่ไหม?`)) return;
    const { error } = await createClient().from("dogs").delete().eq("id", dogId);
    if (error) notify("ลบได้เฉพาะเจ้าของ"); else { setDogId(""); notify("ลบน้องหมาแล้ว"); load(); }
  }
  async function addSchedule(event: FormEvent) {
    event.preventDefault(); if (!dogId || !meal.trim()) return;
    const { error } = await createClient().from("schedules").insert({ dog_id: dogId, label: meal.trim(), time });
    if (error) notify("เพิ่มมื้อไม่สำเร็จ"); else { setMeal(""); notify("เพิ่มมื้อแล้ว"); load(); }
  }
  async function removeSchedule(id: string) { await createClient().from("schedules").delete().eq("id", id); load(); }
  async function invite(event: FormEvent) {
    event.preventDefault(); if (!dogId || !email.trim()) return;
    const { error } = await createClient().rpc("invite_dog_member", { target_dog_id: dogId, member_email: email.trim() });
    if (error) notify("เชิญไม่สำเร็จ: ผู้รับต้องสมัครก่อน"); else { setEmail(""); notify("เพิ่มสมาชิกแล้ว"); load(); }
  }
  async function removeMember(userId: string) {
    if (!dogId || !confirm("นำสมาชิกออกใช่ไหม?")) return;
    const { error } = await createClient().from("dog_members").delete().eq("dog_id", dogId).eq("user_id", userId);
    if (error) notify("นำสมาชิกออกไม่สำเร็จ"); else { notify("นำสมาชิกออกแล้ว"); load(); }
  }

  return <main className="mx-auto min-h-screen max-w-md px-4 pt-6 pb-24">
    <header className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-orange-500">DOGMEAL</p><h1 className="mt-1 text-2xl font-bold">ตั้งค่า</h1></div>{selected && <button onClick={deleteDog} className="rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-600">ลบ {selected.name}</button>}</header>
    <section className="mt-5 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm"><h2 className="font-bold">น้องหมา</h2><div className="mt-3 flex gap-2 overflow-x-auto">{dogs.map((dog) => <button key={dog.id} onClick={() => setDogId(dog.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${dog.id === dogId ? "bg-orange-500 text-white" : "bg-orange-50 text-stone-600"}`}>🐕 {dog.name}</button>)}</div><form onSubmit={addDog} className="mt-4 flex gap-2"><input value={newDog} onChange={(e) => setNewDog(e.target.value)} placeholder="ชื่อน้องหมา" className="min-w-0 flex-1 rounded-xl border border-orange-100 px-3 py-2.5 text-sm"/><button className="rounded-xl bg-orange-500 px-4 text-sm font-bold text-white">เพิ่ม</button></form>{selected && <div className="mt-3 space-y-2"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`เปลี่ยนชื่อ ${selected.name}`} className="w-full rounded-xl border border-orange-100 px-3 py-2.5 text-sm"/><input type="file" accept="image/*" onChange={(e) => setDogPhoto(e.target.files?.[0] ?? null)} className="block w-full text-xs text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-bold file:text-orange-700"/><button type="button" onClick={renameDog} className="w-full rounded-xl bg-orange-50 py-2.5 text-sm font-bold text-orange-700">บันทึกโปรไฟล์</button></div>}</section>
    {selected && <><section className="mt-4 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm"><h2 className="font-bold">ตารางมื้ออาหาร</h2><div className="mt-3 space-y-2">{schedules.map((item) => <div key={item.id} className="flex items-center rounded-2xl bg-orange-50 px-3 py-2.5"><div className="flex-1"><p className="text-sm font-bold">{item.label}</p><p className="text-xs text-stone-500">{item.time.slice(0, 5)} น.</p></div><button onClick={() => removeSchedule(item.id)} className="text-sm font-bold text-red-500">ลบ</button></div>)}</div><form onSubmit={addSchedule} className="mt-3 grid grid-cols-[1fr_95px] gap-2"><input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="ชื่อมื้อ" className="rounded-xl border border-orange-100 px-3 py-2.5 text-sm"/><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border border-orange-100 px-2 py-2.5 text-sm"/><button className="col-span-2 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white">+ เพิ่มมื้ออาหาร</button></form></section>
      <section className="mt-4 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm"><h2 className="font-bold">สมาชิกที่ดูแล {selected.name}</h2><div className="mt-3 space-y-2">{members.map((member) => <div key={member.user_id} className="flex items-center rounded-2xl bg-orange-50 px-3 py-2.5"><div className="flex-1"><p className="text-sm font-bold">{member.email}</p><p className="text-xs text-stone-500">{member.role === "owner" ? "เจ้าของ" : "สมาชิก"}</p></div>{member.role !== "owner" && <button onClick={() => removeMember(member.user_id)} className="text-sm font-bold text-red-500">นำออก</button>}</div>)}</div><form onSubmit={invite} className="mt-3 flex gap-2"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมลสมาชิก" className="min-w-0 flex-1 rounded-xl border border-orange-100 px-3 py-2.5 text-sm"/><button className="rounded-xl bg-orange-500 px-4 text-sm font-bold text-white">เชิญ</button></form><p className="mt-2 text-xs text-stone-500">ผู้รับต้องเคยเข้าสู่ DogMeal ด้วยอีเมลนี้ก่อน</p></section></>}
    {message && <p className="fixed inset-x-5 bottom-20 z-30 mx-auto max-w-md rounded-xl bg-stone-800 px-4 py-3 text-center text-sm font-bold text-white">{message}</p>}<Navigation active="settings" />
  </main>;
}
