"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-lg font-bold text-foreground">เกิดข้อผิดพลาด</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        {error?.message || "ไม่สามารถโหลดแอปได้ กรุณาลองใหม่"}
      </p>
      {error?.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Code: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground"
      >
        ลองใหม่
      </button>
    </div>
  )
}
