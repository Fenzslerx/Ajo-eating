"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="th">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center font-sans">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาดร้ายแรง</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          {error?.message || "ระบบพบปัญหา กรุณาลองโหลดใหม่อีกครั้ง"}
        </p>
        <button
          onClick={reset}
          className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
        >
          ลองใหม่อีกครั้ง
        </button>
      </body>
    </html>
  )
}
