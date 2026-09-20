"use client"

import { useEffect, useState } from "react"
import { Bell, Check, Clock, Utensils } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/lib/app-store"
import { NOTIFICATIONS_STORAGE_KEY } from "@/lib/meal-utils"
import type { AppNotification } from "@/lib/types"

export function NotificationCenter() {
  const { notifications, markNotificationAsRead } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true
    const val = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    return val !== null ? val === "true" : true
  })

  useEffect(() => {
    const handleStorage = () => {
      const val = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      setNotificationsEnabled(val !== null ? val === "true" : true)
    }
    window.addEventListener("storage", handleStorage)
    window.addEventListener("notifications-toggled", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("notifications-toggled", handleStorage)
    }
  }, [])

  const unreadList = notifications.filter((item: AppNotification) => !item.is_read)

  // Toast unread alerts on app launch if enabled
  useEffect(() => {
    if (!notificationsEnabled || unreadList.length === 0) return
    const firstUnread = unreadList[0]
    const toastKey = `notif_toast_${firstUnread.id}`
    if (sessionStorage.getItem(toastKey)) return

    sessionStorage.setItem(toastKey, "shown")
    toast.warning("แจ้งเตือนมื้ออาหารที่พลาด", {
      description: firstUnread.message,
      action: {
        label: "ไปบันทึก",
        onClick: () => {
          window.location.href = `/log?dog=${firstUnread.dog_id}`
        },
      },
      duration: 7000,
    })
  }, [unreadList, notificationsEnabled])

  if (!notificationsEnabled) return null

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="การแจ้งเตือน"
            className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary"
          />
        }
      >
        <Bell className="size-4" />
        {unreadList.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadList.length > 9 ? "9+" : unreadList.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">การแจ้งเตือน</h3>
          </div>
          {unreadList.length > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-500">
              ยังไม่อ่าน {unreadList.length}
            </span>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-center text-xs text-muted-foreground">
              <Check className="size-6 text-emerald-500 mb-1" />
              <span>ไม่มีการแจ้งเตือน</span>
              <span>บันทึกมื้ออาหารครบถ้วน</span>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3 transition-colors ${
                  item.is_read ? "bg-card opacity-70" : "bg-secondary/40 font-medium"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-foreground leading-snug">{item.message}</p>
                  {!item.is_read && (
                    <button
                      type="button"
                      title="ทำเครื่องหมายว่าอ่านแล้ว"
                      onClick={() => markNotificationAsRead(item.id)}
                      className="text-[11px] text-muted-foreground hover:text-primary shrink-0"
                    >
                      อ่านแล้ว
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(item.created_at).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Link
                    href={`/log?dog=${item.dog_id}`}
                    onClick={() => {
                      markNotificationAsRead(item.id)
                      setIsOpen(false)
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <Utensils className="size-3" />
                    ไปบันทึก
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
