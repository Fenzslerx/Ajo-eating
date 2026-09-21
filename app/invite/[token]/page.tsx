"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, AlertCircle, ArrowRight, PawPrint } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAppStore } from "@/lib/app-store"
import { Button } from "@/components/ui/button"
import type { Dog } from "@/lib/types"

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const { acceptInvite } = useAppStore()
  const token = typeof params?.token === "string" ? params.token : ""

  const [statusState, setStatusState] = useState<"checking" | "accepting" | "success" | "error">("checking")
  const [joinedDog, setJoinedDog] = useState<Dog | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function processInvite() {
      if (!token) {
        setStatusState("error")
        setErrorMessage("ไม่พบรหัสคำเชิญในลิงก์")
        return
      }

      const s = createClient()
      const { data: sessionData } = await s.auth.getSession()
      const currentUser = sessionData?.session?.user

      if (!currentUser) {
        // Redirect to login preserving this invite route
        router.replace(`/login?redirect=/invite/${token}`)
        return
      }

      setStatusState("accepting")
      try {
        const dogEntity = await acceptInvite(token)
        if (isCancelled) return
        setJoinedDog(dogEntity)
        setStatusState("success")
      } catch (err: unknown) {
        if (isCancelled) return
        setStatusState("error")
        const desc = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรับคำเชิญ"
        setErrorMessage(desc)
      }
    }

    void processInvite()

    return () => {
      isCancelled = true
    }
  }, [token, acceptInvite, router])

  if (statusState === "checking" || statusState === "accepting") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <h2 className="text-base font-bold text-foreground">
            {statusState === "checking" ? "กำลังตรวจสอบการเข้าสู่ระบบ..." : "กำลังตอบรับคำเชิญเข้าร่วมดูแลน้องหมา..."}
          </h2>
          <p className="text-xs text-muted-foreground">กรุณารอสักครู่</p>
        </div>
      </main>
    )
  }

  if (statusState === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-md">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">เข้าร่วมดูแลเรียบร้อย!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            คุณได้เข้าร่วมเป็นผู้ดูแลน้อง <span className="font-bold text-foreground">{joinedDog?.name || "น้องหมา"}</span> เรียบร้อยแล้ว
          </p>

          <Button
            render={<Link href="/" />}
            className="mt-6 w-full rounded-2xl py-3 font-semibold"
          >
            <PawPrint className="size-4" />
            ไปหน้าวันนี้
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-md">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
          <AlertCircle className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">ไม่สามารถรับคำเชิญได้</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage || "ลิงก์คำเชิญนี้อาจหมดอายุ ถูกใช้งานแล้ว หรือถูกยกเลิก"}</p>

        <Button
          variant="outline"
          render={<Link href="/" />}
          className="mt-6 w-full rounded-2xl py-3"
        >
          กลับหน้าหลัก
        </Button>
      </div>
    </main>
  )
}
