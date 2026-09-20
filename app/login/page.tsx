"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error")) {
      setMessage("เกิดข้อผิดพลาดในการยืนยันตัวตน กรุณาลองใหม่อีกครั้ง");
    }
  }, [searchParams]);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setLoading(false);
      setMessage("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a0a00] via-[#2d1200] to-[#1a0a00] px-5">

      {/* Background decorative paws */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        <span className="absolute -top-4 -left-4 text-[180px] opacity-5 rotate-[-20deg]">🐾</span>
        <span className="absolute top-10 right-0 text-[120px] opacity-5 rotate-[30deg]">🐾</span>
        <span className="absolute bottom-16 -left-6 text-[100px] opacity-5 rotate-[10deg]">🐾</span>
        <span className="absolute bottom-0 right-4 text-[150px] opacity-5 rotate-[-15deg]">🐾</span>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[350px] opacity-[0.03]">🐾</span>
      </div>

      {/* Card */}
      <section className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* Top banner */}
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 px-7 py-9 text-white">
          {/* Small paw accent */}
          <span className="absolute right-5 top-4 text-5xl opacity-20 select-none">🐾</span>
          <span className="absolute right-14 bottom-2 text-3xl opacity-10 select-none">🐾</span>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🐶</span>
            <p className="text-xs font-black tracking-[0.3em] uppercase opacity-90">Dogmeal</p>
          </div>
          <h1 className="text-3xl font-black leading-tight">
            มื้ออาหาร<br />น้องหมา
          </h1>
          <p className="mt-2 text-sm text-orange-100 font-medium">
            บันทึกง่าย ดูแลน้องได้ทุกมื้อ 🍖
          </p>
        </div>

        {/* Body */}
        <div className="px-7 py-8">

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-7">
            {["📋 บันทึกมื้ออาหาร", "📷 ถ่ายรูปน้อง", "🔔 แจ้งเตือน"].map((f) => (
              <span
                key={f}
                className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-100"
              >
                {f}
              </span>
            ))}
          </div>

          {/* Google Sign-in Button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-4 font-bold text-white shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:shadow-orange-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100"
          >
            {loading ? (
              <>
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>กำลังพาไป Google...</span>
              </>
            ) : (
              <>
                {/* Google logo SVG */}
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="rgba(255,255,255,0.85)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="rgba(255,255,255,0.7)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>เข้าสู่ระบบด้วย Google</span>
              </>
            )}
          </button>

          {message && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
              <span>⚠️</span>
              <span>{message}</span>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-stone-400">
            ลงชื่อเข้าใช้แล้ว คุณยอมรับ<br />นโยบายความเป็นส่วนตัวของเรา
          </p>
        </div>
      </section>

      {/* Bottom tagline */}
      <p className="relative z-10 mt-8 text-center text-sm text-orange-200/50 font-medium">
        Made with 🧡 for dog lovers
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
