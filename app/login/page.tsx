"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    });
    setLoading(false);
    setMessage(error ? "ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่" : "ส่งลิงก์สำหรับเข้าสู่ระบบไปที่อีเมลแล้ว" );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm ring-1 ring-orange-100">
        <p className="text-sm font-bold tracking-widest text-orange-600">DOGMEAL</p>
        <h1 className="mt-2 text-3xl font-bold">มื้อของน้องหมา</h1>
        <p className="mt-2 text-stone-600">เข้าสู่ระบบด้วยลิงก์ในอีเมล</p>
        <label className="mt-7 block text-sm font-medium">อีเมล</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-500" />
        <button disabled={loading} className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white disabled:opacity-50">{loading ? "กำลังส่ง..." : "ส่งลิงก์เข้าสู่ระบบ"}</button>
        {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}
      </form>
    </main>
  );
}
