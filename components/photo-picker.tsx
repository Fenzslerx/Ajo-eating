"use client"

import { useRef } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PhotoPicker({
  value,
  onChange,
  label = "รูปมื้ออาหาร",
  id = "photo-picker",
}: {
  value: string | null
  onChange: (photo: string | null) => void
  label?: string
  id?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const labelId = `${id}-label`

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const MAX_SIDE = 1200
        let { width, height } = img
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.8))
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(URL.createObjectURL(file))
      }
      img.src = objectUrl
    })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    onChange(compressed)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground" id={labelId}>
        {label}
      </span>
      {value ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value || "/placeholder.svg"}
            alt={`${label}ที่เลือก`}
            className="size-28 rounded-xl border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`ลบ${label}`}
            className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-foreground text-background"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          aria-labelledby={labelId}
          className="h-28 w-28 flex-col gap-1 rounded-xl border-dashed bg-transparent"
        >
          <Camera className="size-5" aria-hidden="true" />
          <span className="text-xs">เพิ่มรูป</span>
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFile}
      />
    </div>
  )
}
