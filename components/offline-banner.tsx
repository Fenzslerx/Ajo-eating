"use client"

import { CloudOff } from "lucide-react"
import { useAppStore } from "@/lib/app-store"

export function OfflineBanner() {
  const { isOnline } = useAppStore()

  if (isOnline) return null

  return (
    <div className="sticky top-0 z-30 flex justify-center bg-background/95 px-4 pt-3 backdrop-blur">
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <CloudOff className="size-3.5" aria-hidden="true" />
        ออฟไลน์ · บันทึกจะส่งอัตโนมัติ
      </span>
    </div>
  )
}
