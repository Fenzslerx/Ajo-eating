"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Home, NotebookPen, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "วันนี้", icon: Home },
  { href: "/log", label: "บันทึก", icon: NotebookPen },
  { href: "/stats", label: "สถิติ", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
