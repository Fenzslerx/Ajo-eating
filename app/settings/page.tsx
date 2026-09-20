"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Info,
  LogOut,
  PawPrint,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PhotoPicker } from "@/components/photo-picker"
import { useAppStore } from "@/lib/app-store"
import {
  DEFAULT_MEAL_CONFIG,
  getActiveMealConfig,
  saveActiveMealConfig,
  resetActiveMealConfig,
  NOTIFICATIONS_STORAGE_KEY,
  type MealConfigItem,
} from "@/lib/meal-utils"
import { createClient } from "@/lib/supabase/client"

export default function SettingsPage() {
  const {
    dogs,
    logs,
    updateDog,
    addDog,
    removeDog,
    clearAllData,
    isOnline,
    isLoading,
    signOut,
  } = useAppStore()

  // 1. Profile State
  const [selectedDogId, setSelectedDogId] = useState(dogs[0]?.id ?? "")
  useEffect(() => {
    if (!selectedDogId && dogs[0]) setSelectedDogId(dogs[0].id)
  }, [selectedDogId, dogs])

  const activeDog = dogs.find((d) => d.id === selectedDogId) ?? dogs[0]

  const [dogName, setDogName] = useState("")
  const [dogBreed, setDogBreed] = useState("")
  const [dogBirthdate, setDogBirthdate] = useState("")
  const [dogPhoto, setDogPhoto] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [newDogOpen, setNewDogOpen] = useState(false)
  const [newDogNameInput, setNewDogNameInput] = useState("")
  const [isAddingDog, setIsAddingDog] = useState(false)

  useEffect(() => {
    if (activeDog) {
      setDogName(activeDog.name || "")
      setDogBreed(activeDog.breed || "")
      setDogBirthdate(activeDog.birthdate || "")
      setDogPhoto(activeDog.photo || null)
    }
  }, [activeDog])

  async function handleSaveDogProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!activeDog || !dogName.trim()) return
    setIsSavingProfile(true)
    try {
      await updateDog(activeDog.id, {
        name: dogName.trim(),
        breed: dogBreed.trim() || null,
        birthdate: dogBirthdate || null,
        photo: dogPhoto,
      })
      toast.success("บันทึกข้อมูลน้องหมาแล้ว")
    } catch {
      toast.error("เกิดข้อผิดพลาดในการบันทึก")
    } finally {
      setIsSavingProfile(false)
    }
  }

  // 2. Meal Schedule State
  const [mealConfigs, setMealConfigs] = useState<MealConfigItem[]>(() => getActiveMealConfig())

  function handleSaveMealConfigs(newConfigs: MealConfigItem[]) {
    setMealConfigs(newConfigs)
    saveActiveMealConfig(newConfigs)
    toast.success("บันทึกการตั้งค่าช่วงเวลามื้ออาหารแล้ว")
  }

  function handleUpdateMealTime(index: number, startHour: number, endHour: number) {
    const updated = [...mealConfigs]
    updated[index] = { ...updated[index], startHour, endHour }
    handleSaveMealConfigs(updated)
  }

  function handleAddMeal() {
    const newKey = `meal_${Date.now()}`
    const updated = [
      ...mealConfigs,
      { key: newKey, label: "มื้อพิเศษ", startHour: 14, endHour: 16 },
    ]
    handleSaveMealConfigs(updated)
  }

  function handleRemoveMeal(index: number) {
    if (mealConfigs.length <= 1) {
      toast.error("ต้องมีมื้ออาหารอย่างน้อย 1 มื้อ")
      return
    }
    const updated = mealConfigs.filter((_, i) => i !== index)
    handleSaveMealConfigs(updated)
  }

  function handleResetMealSchedule() {
    const defaults = resetActiveMealConfig()
    setMealConfigs(defaults)
    toast.success("คืนค่าเริ่มต้นช่วงเวลามื้ออาหารแล้ว")
  }

  // 3. Notification Toggle State
  const [notifyOnMissed, setNotifyOnMissed] = useState(() => {
    if (typeof window === "undefined") return true
    const val = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    return val !== null ? val === "true" : true
  })

  function handleToggleNotification() {
    const nextVal = !notifyOnMissed
    setNotifyOnMissed(nextVal)
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(nextVal))
    toast.success(nextVal ? "เปิดการแจ้งเตือนแล้ว" : "ปิดการแจ้งเตือนแล้ว")
  }

  // 4. Data Management: Export & Clear Data
  function handleExportData() {
    if (logs.length === 0) {
      toast.error("ยังไม่มีข้อมูลบันทึกให้ Export")
      return
    }

    const exportObject = {
      exportDate: new Date().toISOString(),
      dog: activeDog ? { id: activeDog.id, name: activeDog.name, breed: activeDog.breed } : null,
      mealConfigs,
      recordsCount: logs.length,
      logs: logs.map((l) => ({
        id: l.id,
        at: l.at,
        recordedAt: l.recordedAt,
        mealType: l.mealType,
        status: l.status,
        food: l.food,
        amount_g: l.amount_g,
        note: l.note,
      })),
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `dogmeal-export-${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success("ดาวน์โหลดไฟล์ข้อมูล JSON แล้ว")
  }

  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false)
  const [confirmDeleteText, setConfirmDeleteText] = useState("")
  const [isClearing, setIsClearing] = useState(false)

  async function handleConfirmClearAll() {
    if (confirmDeleteText !== "DELETE") return
    setIsClearing(true)
    try {
      await clearAllData()
      setClearDataDialogOpen(false)
      setConfirmDeleteText("")
      toast.success("ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว")
    } catch {
      toast.error("เกิดข้อผิดพลาดในการล้างข้อมูล")
    } finally {
      setIsClearing(false)
    }
  }

  // 5. System Status (Supabase read-only check)
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking")

  useEffect(() => {
    async function checkBackend() {
      try {
        const client = createClient()
        const { error } = await client.from("dogs").select("id").limit(1)
        if (error) {
          setBackendStatus("disconnected")
        } else {
          setBackendStatus("connected")
        }
      } catch {
        setBackendStatus("disconnected")
      }
    }
    void checkBackend()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">กำลังโหลดการตั้งค่า...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-14">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-foreground">ตั้งค่า</h1>
        <p className="text-sm text-muted-foreground">จัดการข้อมูลน้องหมา ช่วงเวลามื้ออาหาร และระบบ</p>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          1. ข้อมูลน้องหมา (Profile)
      ───────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 rounded-2xl border border-border p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <PawPrint className="size-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">ข้อมูลน้องหมา (Profile)</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1 text-xs"
            onClick={() => setNewDogOpen(true)}
          >
            <Plus className="size-3.5" />
            เพิ่มตัวใหม่
          </Button>
        </div>

        {/* Tab switcher if multiple dogs */}
        {dogs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="เลือกน้องหมา">
            {dogs.map((dog) => (
              <button
                key={dog.id}
                type="button"
                role="tab"
                aria-selected={selectedDogId === dog.id}
                onClick={() => setSelectedDogId(dog.id)}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                  selectedDogId === dog.id
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                🐶 {dog.name}
              </button>
            ))}
          </div>
        )}

        {activeDog ? (
          <form className="flex flex-col gap-4" onSubmit={handleSaveDogProfile}>
            {/* Photo Picker */}
            <PhotoPicker
              id="dog-profile-photo"
              label="รูปโปรไฟล์น้องหมา"
              value={dogPhoto}
              onChange={setDogPhoto}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dog-name-input">ชื่อน้องหมา *</Label>
                <Input
                  id="dog-name-input"
                  value={dogName}
                  onChange={(e) => setDogName(e.target.value)}
                  placeholder="เช่น มะม่วง, อาจู"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dog-breed-input">สายพันธุ์ (ไม่บังคับ)</Label>
                <Input
                  id="dog-breed-input"
                  value={dogBreed}
                  onChange={(e) => setDogBreed(e.target.value)}
                  placeholder="เช่น โกลเด้น, ปอมเมอเรเนียน"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dog-birthdate-input">วันเกิด / วันรับเลี้ยง (ไม่บังคับ)</Label>
              <Input
                id="dog-birthdate-input"
                type="date"
                value={dogBirthdate}
                onChange={(e) => setDogBirthdate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
              <span className="text-[11px] text-muted-foreground">
                ระบบจะคำนวณอายุและแสดงที่หน้า &quot;วันนี้&quot; ให้อัตโนมัติ
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              {dogs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`คุณต้องการลบ ${activeDog.name} ใช่หรือไม่?`)) {
                      removeDog(activeDog.id)
                      setSelectedDogId(dogs.find((d) => d.id !== activeDog.id)?.id ?? "")
                      toast.success(`ลบ ${activeDog.name} แล้ว`)
                    }
                  }}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  ลบโปรไฟล์นี้
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                className="ml-auto rounded-full font-semibold"
                disabled={isSavingProfile || !dogName.trim()}
              >
                {isSavingProfile ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีน้องหมา กด &quot;เพิ่มตัวใหม่&quot; ด้านบนเพื่อเริ่มต้น
          </div>
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          2. ตั้งค่าช่วงเวลามื้ออาหาร (Meal Schedule)
      ───────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 rounded-2xl border border-border p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-foreground">ช่วงเวลามื้ออาหาร (Meal Schedule)</h2>
            <span className="text-xs text-muted-foreground">
              กำหนดเวลาคำนวณมื้ออัตโนมัติ (แทนที่ค่า default เดิม)
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleResetMealSchedule}
          >
            <RotateCcw className="size-3.5" />
            คืนค่าเริ่มต้น
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {mealConfigs.map((meal, index) => (
            <div
              key={meal.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-28 text-xs font-semibold"
                  value={meal.label}
                  onChange={(e) => {
                    const updated = [...mealConfigs]
                    updated[index] = { ...updated[index], label: e.target.value }
                    handleSaveMealConfigs(updated)
                  }}
                  placeholder="ชื่อมื้อ"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">เริ่ม</span>
                <input
                  type="time"
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium"
                  value={`${String(meal.startHour).padStart(2, "0")}:00`}
                  onChange={(e) => {
                    const hour = parseInt(e.target.value.split(":")[0], 10) || 0
                    handleUpdateMealTime(index, hour, meal.endHour)
                  }}
                />
                <span className="text-muted-foreground">- สิ้นสุด</span>
                <input
                  type="time"
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium"
                  value={`${String(meal.endHour).padStart(2, "0")}:00`}
                  onChange={(e) => {
                    const hour = parseInt(e.target.value.split(":")[0], 10) || 0
                    handleUpdateMealTime(index, meal.startHour, hour)
                  }}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveMeal(index)}
                  title="ลบมื้อนี้"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={handleAddMeal}
          >
            <Plus className="size-3.5 mr-1" />
            เพิ่มช่วงเวลามื้ออาหาร
          </Button>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          3. การแจ้งเตือน (Notifications UI)
      ───────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Bell className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">การแจ้งเตือน (Notifications)</h2>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">เตือนเมื่อถึงเวลาแต่ยังไม่ได้บันทึก</span>
            <span className="text-xs text-muted-foreground">
              แจ้งเตือนเมื่อหมดช่วงเวลาของมื้อนั้น (+15 นาที grace period)
            </span>
          </div>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={handleToggleNotification}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              notifyOnMissed ? "bg-primary" : "bg-muted"
            }`}
            role="switch"
            aria-checked={notifyOnMissed}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                notifyOnMissed ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {/* Comment for future push notification service integration */}
        {/* TODO: Connect Web Push / ServiceWorker notification service here */}
        <p className="text-[11px] text-muted-foreground/80 italic">
          * รองรับการเปิด/ปิดสวิตช์ในระบบเบื้องต้น ระบบแจ้งเตือน Push Notification บนมือถือจะเชื่อมต่อในระยะถัดไป
        </p>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          4. การจัดการข้อมูล (Data Management)
      ───────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Database className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">การจัดการข้อมูล (Data Management)</h2>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">Export ข้อมูลย้อนหลัง</span>
              <span className="text-[11px] text-muted-foreground">ดาวน์โหลดข้อมูลทั้งหมด ({logs.length} มื้อ) เป็นไฟล์ JSON</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full gap-1 text-xs"
              onClick={handleExportData}
            >
              <Download className="size-3.5" />
              ดาวน์โหลด JSON
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-rose-200/50 bg-rose-50/30 p-3 dark:border-rose-900/30 dark:bg-rose-950/10">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">ล้างข้อมูลทั้งหมด</span>
              <span className="text-[11px] text-muted-foreground">ลบประวัติมื้ออาหารและบันทึกทั้งหมดอย่างถาวร</span>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-full gap-1 text-xs"
              onClick={() => {
                setConfirmDeleteText("")
                setClearDataDialogOpen(true)
              }}
            >
              <Trash2 className="size-3.5" />
              ล้างข้อมูล
            </Button>
          </div>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          5. สถานะระบบ (System Status) — Read-Only
      ───────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">สถานะระบบ (System Status)</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1 rounded-xl bg-secondary/40 p-3">
            <span className="text-muted-foreground">การเชื่อมต่อฐานข้อมูล Supabase</span>
            <div className="flex items-center gap-1.5 pt-0.5">
              {backendStatus === "connected" ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">เชื่อมต่อแล้ว</span>
                </>
              ) : backendStatus === "checking" ? (
                <>
                  <div className="size-3 animate-spin rounded-full border border-primary border-t-transparent" />
                  <span className="font-semibold text-muted-foreground">กำลังตรวจสอบ...</span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-rose-500" />
                  <span className="font-semibold text-rose-600">ไม่ได้เชื่อมต่อ</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-xl bg-secondary/40 p-3">
            <span className="text-muted-foreground">สถานะเครือข่ายอินเทอร์เน็ต</span>
            <div className="flex items-center gap-1.5 pt-0.5">
              {isOnline ? (
                <>
                  <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-foreground">ออนไลน์ (Online)</span>
                </>
              ) : (
                <>
                  <span className="size-2.5 rounded-full bg-amber-500" />
                  <span className="font-semibold text-amber-600">ออฟไลน์ (Offline)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="size-3.5 text-muted-foreground" />
          <span>การตั้งค่าเชื่อมต่อถูกป้องกันผ่าน environment variable ปลอดภัยต่อการใช้งาน</span>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          6. เกี่ยวกับแอป (About)
      ───────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-2.5 rounded-2xl border border-border p-4 shadow-xs text-xs text-muted-foreground">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <span className="font-semibold text-foreground">แอปติดตามอาหารน้องหมา (DogMeal)</span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 font-bold text-foreground">v0.2.0</span>
        </div>
        <p className="leading-relaxed">
          พัฒนาขึ้นเพื่อช่วยให้คุณพ่อคุณแม่น้องหมาสามารถดูแลบันทึกมื้ออาหาร สุขภาพ และพฤติกรรมการกินได้อย่างสะดวกและแม่นยำ
        </p>
        <div className="flex items-center justify-between pt-1 text-[11px]">
          <span>รายงานปัญหา / ข้อเสนอแนะ</span>
          <a
            href="mailto:support@dogmeal.app"
            className="font-medium text-primary hover:underline"
          >
            support@dogmeal.app
          </a>
        </div>
      </Card>

      {/* Logout button */}
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-2xl border-border py-6 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors gap-2"
        onClick={() => {
          if (confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
            void signOut()
          }
        }}
      >
        <LogOut className="size-4" />
        ออกจากระบบ
      </Button>

      {/* Modal: เพิ่มน้องหมาตัวใหม่ */}
      <Dialog open={newDogOpen} onOpenChange={setNewDogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มน้องหมาตัวใหม่</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-3.5"
            onSubmit={async (e) => {
              e.preventDefault()
              const nameToCreate = newDogNameInput.trim()
              if (!nameToCreate || isAddingDog) return
              setIsAddingDog(true)
              try {
                const created = await addDog(nameToCreate)
                if (created?.id) {
                  setSelectedDogId(created.id)
                }
                setNewDogNameInput("")
                setNewDogOpen(false)
                toast.success(`เพิ่มน้องหมา "${nameToCreate}" แล้ว`)
              } catch (err) {
                console.error("Error adding dog:", err)
                toast.error("เกิดข้อผิดพลาดในการเพิ่มน้องหมา")
              } finally {
                setIsAddingDog(false)
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-dog-name">ชื่อน้องหมา</Label>
              <Input
                id="add-dog-name"
                value={newDogNameInput}
                onChange={(e) => setNewDogNameInput(e.target.value)}
                placeholder="เช่น บัวขาว, ชาเขียว"
                autoFocus
                required
                disabled={isAddingDog}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={isAddingDog}
                onClick={() => setNewDogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" className="rounded-full font-semibold" disabled={isAddingDog}>
                {isAddingDog ? "กำลังเพิ่ม..." : "เพิ่มน้องหมา"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: ยืนยันล้างข้อมูลทั้งหมด 2 ชั้น */}
      <Dialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />
              ยืนยันการล้างข้อมูลทั้งหมด
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-xs text-muted-foreground">
            <p>
              การกระทำนี้จะล้างประวัติการกินข้าว ข้อมูลน้องหมา และการตั้งค่าทั้งหมดออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้
            </p>
            <p className="font-semibold text-foreground">
              พิมพ์คำว่า <span className="font-mono text-destructive underline font-bold">DELETE</span> เพื่อยืนยัน:
            </p>
            <Input
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
              placeholder="พิมพ์ DELETE เพื่อยืนยัน"
              className="font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setClearDataDialogOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full font-semibold"
              disabled={confirmDeleteText !== "DELETE" || isClearing}
              onClick={handleConfirmClearAll}
            >
              {isClearing ? "กำลังล้างข้อมูล..." : "ยืนยันล้างข้อมูล"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
