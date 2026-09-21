"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Link as LinkIcon, Plus, Shield, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAppStore } from "@/lib/app-store"
import type { Dog, DogInvite } from "@/lib/types"

const ROLE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  owner: { label: "เจ้าของ (Owner)", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  caretaker: { label: "ผู้ดูแล (Caretaker)", badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  viewer: { label: "ดูอย่างเดียว (Viewer)", badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
}

export function MemberManager({ dog }: { dog: Dog }) {
  const {
    members,
    currentUserId,
    getUserRole,
    createInviteLink,
    revokeInvite,
    getPendingInvites,
    setMemberRole,
    removeMember,
  } = useAppStore()

  const [invites, setInvites] = useState<DogInvite[]>([])
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<"caretaker" | "viewer">("caretaker")
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const userRole = getUserRole(dog.id)
  const isOwner = userRole === "owner"
  const dogMembers = members.filter((m) => m.dog_id === dog.id)

  const reloadInvites = useCallback(async () => {
    if (!isOwner) return
    const rows = await getPendingInvites(dog.id)
    setInvites(rows)
  }, [dog.id, isOwner, getPendingInvites])

  useEffect(() => {
    void reloadInvites()
  }, [reloadInvites])

  async function handleCreateLink() {
    setIsCreating(true)
    try {
      const token = await createInviteLink(dog.id, selectedRole)
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const fullUrl = `${origin}/invite/${token}`
      setCreatedUrl(fullUrl)
      await reloadInvites()
      toast.success("สร้างลิงก์เชิญสำเร็จ")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setIsCreating(false)
    }
  }

  function handleCopy(textToCopy: string, tokenKey: string) {
    void navigator.clipboard.writeText(textToCopy)
    setCopiedToken(tokenKey)
    toast.success("คัดลอกลิงก์แล้ว")
    setTimeout(() => setCopiedToken(null), 2500)
  }

  async function handleRevoke(inviteId: string) {
    try {
      await revokeInvite(inviteId)
      await reloadInvites()
      toast.success("ยกเลิกคำเชิญแล้ว")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    }
  }

  async function handleChangeRole(targetUserId: string, nextRole: "caretaker" | "viewer") {
    try {
      await setMemberRole(dog.id, targetUserId, nextRole)
      toast.success(`ปรับสิทธิ์เป็น ${ROLE_LABELS[nextRole]?.label || nextRole} เรียบร้อย`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถเปลี่ยนสิทธิ์ได้"
      toast.error(msg)
    }
  }

  async function handleRemove(targetUserId: string, memberLabel: string) {
    if (!confirm(`ต้องการนำคุณ "${memberLabel}" ออกจากการดูแลน้องหมาหรือไม่?`)) return
    try {
      await removeMember(dog.id, targetUserId)
      toast.success("นำสมาชิกออกแล้ว")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถนำสมาชิกออกได้"
      toast.error(msg)
    }
  }

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border border-border p-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">จัดการสมาชิกและสิทธิ์</h2>
        </div>
        {userRole && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_LABELS[userRole]?.badgeClass || "bg-secondary"}`}>
            สิทธิ์ของคุณ: {ROLE_LABELS[userRole]?.label || userRole}
          </span>
        )}
      </div>

      {/* สมาชิกปัจจุบัน */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">สมาชิกปัจจุบัน ({dogMembers.length} คน)</span>
          {isOwner && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={() => {
                setCreatedUrl(null)
                setIsInviteOpen(true)
              }}
            >
              <Plus className="size-3.5" />
              สร้างลิงก์เชิญ
            </Button>
          )}
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {dogMembers.map((member) => {
            const isSelf = member.user_id === currentUserId
            const displayTitle = member.email || "สมาชิก"
            const roleConfig = ROLE_LABELS[member.role] || { label: member.role, badgeClass: "bg-secondary" }

            return (
              <div key={member.user_id} className="flex items-center justify-between p-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{displayTitle}</span>
                    {isSelf && <span className="text-[10px] text-muted-foreground font-mono">(คุณ)</span>}
                  </div>
                  {member.created_at && (
                    <span className="text-[11px] text-muted-foreground">
                      เข้าร่วมเมื่อ {new Date(member.created_at).toLocaleDateString("th-TH")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && !isSelf && member.role !== "owner" ? (
                    <>
                      <select
                        aria-label="เปลี่ยนสิทธิ์สมาชิก"
                        value={member.role === "viewer" ? "viewer" : "caretaker"}
                        onChange={(e) => handleChangeRole(member.user_id, e.target.value as "caretaker" | "viewer")}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                      >
                        <option value="caretaker">ผู้ดูแล (Caretaker)</option>
                        <option value="viewer">ดูอย่างเดียว (Viewer)</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20"
                        onClick={() => handleRemove(member.user_id, displayTitle)}
                        title="นำสมาชิกออก"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${roleConfig.badgeClass}`}>
                      {roleConfig.label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* รายการลิงก์เชิญที่ยังไม่ถูกใช้ (Pending Invites) */}
      {isOwner && invites.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <span className="text-xs font-semibold text-foreground">ลิงก์เชิญที่ยังรอการตอบรับ ({invites.length})</span>
          <div className="flex flex-col gap-2">
            {invites.map((invite) => {
              const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${invite.token}`
              const isCopied = copiedToken === invite.token

              return (
                <div key={invite.id} className="flex items-center justify-between rounded-xl bg-secondary/40 p-2.5 text-xs">
                  <div className="flex flex-col gap-0.5 max-w-[65%] truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{ROLE_LABELS[invite.role]?.label || invite.role}</span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate">{invite.token.slice(0, 8)}...</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      หมดอายุ {new Date(invite.expires_at).toLocaleDateString("th-TH")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => handleCopy(fullUrl, invite.token)}
                    >
                      {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      {isCopied ? "คัดลอกแล้ว" : "คัดลอก"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal: สร้างลิงก์เชิญ */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>สร้างลิงก์เชิญผู้ดูแล</DialogTitle>
          </DialogHeader>

          {!createdUrl ? (
            <div className="flex flex-col gap-4 pt-1">
              <p className="text-xs text-muted-foreground">
                เลือกระดับสิทธิ์สำหรับผู้ที่รับลิงก์เชิญนี้ (ลิงก์มีอายุ 7 วัน และใช้ได้ 1 บัญชี):
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole("caretaker")}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                    selectedRole === "caretaker"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">ผู้ดูแล (Caretaker)</span>
                  <span className="text-[10px] leading-snug">บันทึกอาหารและปรับตารางได้ แต่จัดการสมาชิกไม่ได้</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole("viewer")}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                    selectedRole === "viewer"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">ดูอย่างเดียว (Viewer)</span>
                  <span className="text-[10px] leading-snug">ดูสถิติและประวัติได้ทั้งหมด แต่บันทึกอะไรไม่ได้เลย</span>
                </button>
              </div>

              <Button
                type="button"
                onClick={handleCreateLink}
                disabled={isCreating}
                className="w-full rounded-xl py-2.5 font-semibold mt-1"
              >
                {isCreating ? "กำลังสร้างลิงก์..." : "สร้างลิงก์เชิญ"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  สร้างลิงก์เชิญสิทธิ์ {ROLE_LABELS[selectedRole]?.label} สำเร็จ!
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">
                  คัดลอกลิงก์นี้ส่งให้เพื่อนหรือคนในบ้านได้ทันที
                </p>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 p-2 text-xs font-mono">
                <span className="truncate flex-1 px-1">{createdUrl}</span>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 rounded-lg shrink-0"
                  onClick={() => handleCopy(createdUrl, "newly_created")}
                >
                  {copiedToken === "newly_created" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedToken === "newly_created" ? "คัดลอกแล้ว" : "คัดลอก"}
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setIsInviteOpen(false)}
              >
                เสร็จสิ้น
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
