"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/offline-banner"

const NO_CHROME_ROUTES = ["/login"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showChrome = !NO_CHROME_ROUTES.some((route) => pathname.startsWith(route))

  if (!showChrome) {
    return <>{children}</>
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <OfflineBanner />
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}
