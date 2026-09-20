"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` }
    });
    if (error) { setLoading(false); setMessage("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่"); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm ring-1 ring-orange-100">
        <p className="text-sm font-bold tracking-widest text-orange-600">DOGMEAL</p>
        <h1 className="mt-2 text-3xl font-bold">มื้อของน้องหมา</h1>
        <p className="mt-2 text-stone-600">บันทึกมื้ออาหารน้องหมาได้ง่าย ๆ</p>
        <button onClick={signInWithGoogle} disabled={loading} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 font-bold text-stone-700 shadow-sm disabled:opacity-50">
          <span className="text-xl" aria-hidden="true">G</span>{loading ? "กำลังพาไป Google..." : "เข้าสู่ระบบด้วย Google"}
        </button>
        {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}
      </section>
    </main>
  );
}
