"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MemberRow } from "@/components/member-row"
import { useAppStore } from "@/lib/app-store"

export default function SettingsPage() {
  const {
    dogs,
    schedules,
    members,
    profiles,
    currentUserId,
    addDog,
    removeDog,
    addSchedule,
    removeSchedule,
    addMember,
    removeMember,
    profileFor,
  } = useAppStore()

  const [newDogName, setNewDogName] = useState("")
  const [dogDialogOpen, setDogDialogOpen] = useState(false)
  const [activeDogId, setActiveDogId] = useState(dogs[0]?.id ?? "")
  const [scheduleLabel, setScheduleLabel] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [memberEmail, setMemberEmail] = useState("")
  const [deleteDogOpen, setDeleteDogOpen] = useState(false)
  useEffect(() => { if (!activeDogId && dogs[0]) setActiveDogId(dogs[0].id) }, [activeDogId, dogs])

  function handleAddDog(e: React.FormEvent) {
    e.preventDefault()
    if (!newDogName.trim()) return
    addDog(newDogName.trim())
    setNewDogName("")
    setDogDialogOpen(false)
    toast.success("เพิ่มน้องหมาแล้ว")
  }

  function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!activeDogId || !scheduleLabel.trim() || !scheduleTime) return
    addSchedule({ dog_id: activeDogId, label: scheduleLabel.trim(), time: scheduleTime })
    setScheduleLabel("")
    setScheduleTime("")
    toast.success("เพิ่มมื้ออาหารแล้ว")
  }

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!activeDogId || !memberEmail.trim()) return
    addMember(activeDogId, memberEmail.trim())
    setMemberEmail("")
    toast.success("เชิญสมาชิกแล้ว")
  }

  const activeDog = dogs.find((d) => d.id === activeDogId)
  const activeDogSchedules = schedules.filter((s) => s.dog_id === activeDogId)
  const activeDogMembers = members
    .filter((m) => m.dog_id === activeDogId)
    .map((m) => ({ ...m, profile: profileFor(m.user_id) }))
    .filter((m) => m.profile)
  const canManage = activeDog?.owner_id === currentUserId

  function handleRemoveDog() {
    if (!activeDog) return
    const remaining = dogs.filter((d) => d.id !== activeDog.id)
    removeDog(activeDog.id)
    setActiveDogId(remaining[0]?.id ?? "")
    setDeleteDogOpen(false)
    toast.success(`ลบ${activeDog.name}แล้ว`)
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-foreground">ตั้งค่า</h1>
        <Dialog open={dogDialogOpen} onOpenChange={setDogDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="rounded-full" />}>
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มน้องหมา
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มน้องหมา</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleAddDog}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-dog-name">ชื่อน้องหมา</Label>
                <Input
                  id="new-dog-name"
                  value={newDogName}
                  onChange={(e) => setNewDogName(e.target.value)}
                  placeholder="เช่น มะม่วง"
                  autoFocus
                />
              </div>
              <Button type="submit" className="rounded-full">
                บันทึก
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="เลือกน้องหมา">
        {dogs.map((dog) => (
          <button
            key={dog.id}
            type="button"
            role="tab"
            aria-selected={activeDogId === dog.id}
            onClick={() => setActiveDogId(dog.id)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
              activeDogId === dog.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary/50"
            }`}
          >
            {dog.name}
          </button>
        ))}
      </div>

      {activeDog && (
        <>
          {canManage && (
            <Dialog open={deleteDogOpen} onOpenChange={setDeleteDogOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit self-end rounded-full text-destructive hover:text-destructive"
                  />
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
                ลบ{activeDog.name}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>ลบ{activeDog.name}?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  ประวัติมื้ออาหาร มื้อ และสมาชิกของ{activeDog.name}จะถูกลบทั้งหมด และไม่สามารถกู้คืนได้
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => setDeleteDogOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-full"
                    onClick={handleRemoveDog}
                  >
                    ลบเลย
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">มื้ออาหารของ{activeDog.name}</h2>
            <div className="flex flex-col gap-2">
              {activeDogSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{schedule.label}</span>
                    <span className="text-xs text-muted-foreground">{schedule.time} น.</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    aria-label={`ลบมื้อ${schedule.label}`}
                    onClick={() => removeSchedule(schedule.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              {activeDogSchedules.length === 0 && (
                <p className="text-sm text-muted-foreground">ยังไม่มีมื้ออาหาร</p>
              )}
            </div>
            <Card className="flex flex-col gap-3 rounded-xl border-dashed p-3">
              <form className="flex flex-col gap-3" onSubmit={handleAddSchedule}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="schedule-label-input">ชื่อมื้อ</Label>
                    <Input
                      id="schedule-label-input"
                      value={scheduleLabel}
                      onChange={(e) => setScheduleLabel(e.target.value)}
                      placeholder="เช่น เช้า"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="schedule-time-input">เวลา</Label>
                    <Input
                      id="schedule-time-input"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" variant="secondary" size="sm" className="rounded-full">
                  <Plus className="size-4" aria-hidden="true" />
                  เพิ่มมื้ออาหาร
                </Button>
              </form>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">สมาชิกที่ดูแล{activeDog.name}</h2>
            <div className="flex flex-col gap-2">
              {activeDogMembers.map((m) => (
                <MemberRow
                  key={m.user_id}
                  name={m.profile!.name}
                  email={m.profile!.email}
                  role={m.role}
                  canManage={canManage}
                  onRemove={() => removeMember(activeDogId, m.user_id)}
                />
              ))}
            </div>
            {canManage && (
              <Card className="flex flex-col gap-3 rounded-xl border-dashed p-3">
                <form className="flex gap-2" onSubmit={handleAddMember}>
                  <div className="flex-1">
                    <Label htmlFor="member-email-input" className="sr-only">
                      อีเมลสมาชิก
                    </Label>
                    <Input
                      id="member-email-input"
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="อีเมลของสมาชิก"
                    />
                  </div>
                  <Button type="submit" variant="secondary" className="rounded-full">
                    เชิญ
                  </Button>
                </form>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
