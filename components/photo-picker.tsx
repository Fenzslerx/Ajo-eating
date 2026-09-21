"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { compressToDataUrl } from "@/lib/image-utils"

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
  const [isCompressing, setIsCompressing] = useState(false)
  const labelId = `${id}-label`

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-selected
    e.target.value = ""
    setIsCompressing(true)
    try {
      const { dataUrl } = await compressToDataUrl(file, { maxSide: 1200, quality: 0.82 })
      onChange(dataUrl)
    } catch {
      // Fallback to uncompressed blob URL if canvas fails
      onChange(URL.createObjectURL(file))
    } finally {
      setIsCompressing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground" id={labelId}>
        {label}
      </span>

      {isCompressing ? (
        <div className="flex size-28 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-[10px] text-muted-foreground">กำลังบีบอัดรูป...</span>
        </div>
      ) : value ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
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
