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
    const redirectParam = searchParams.get("redirect");
    const callbackUrl = new URL(`${location.origin}/auth/callback`);
    if (redirectParam && redirectParam.startsWith("/")) {
      callbackUrl.searchParams.set("next", redirectParam);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setLoading(false);
      setMessage("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo / header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary text-3xl shadow-lg mb-4">
            🐶
          </div>
          <h1 className="text-2xl font-black text-foreground">Dogmeal</h1>
          <p className="mt-1 text-sm text-muted-foreground">บันทึกมื้ออาหารน้องหมาได้ง่าย ๆ</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">

          {/* Feature list */}
          <div className="space-y-2.5">
            {[
              { icon: "📋", text: "บันทึกมื้ออาหารทุกมื้อ" },
              { icon: "📷", text: "ถ่ายรูปก่อน-หลังกิน" },
              { icon: "👨‍👩‍👧", text: "ใช้ร่วมกันหลายคนในบ้าน" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-foreground">
                <span className="size-8 flex items-center justify-center rounded-xl bg-secondary text-base shrink-0">{icon}</span>
                {text}
              </div>
            ))}
          </div>

          <div className="border-t border-border" />

          {/* Sign-in button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                กำลังพาไป Google...
              </>
            ) : (
              <>
                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" fillOpacity=".9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" fillOpacity=".75" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" fillOpacity=".6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="currentColor" fillOpacity=".85" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </>
            )}
          </button>

          {message && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
              ⚠️ {message}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Made with 🧡 for dog lovers
        </p>
      </div>
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
