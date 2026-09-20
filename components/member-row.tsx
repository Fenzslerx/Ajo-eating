"use client"

import { MoreVertical } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MemberRole } from "@/lib/types"

export function MemberRow({
  name,
  email,
  role,
  canManage,
  onRemove,
}: {
  name: string
  email: string
  role: MemberRole
  canManage: boolean
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Avatar className="size-9">
        <AvatarFallback className="bg-secondary text-sm">
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </div>
      <Badge variant={role === "owner" ? "default" : "secondary"}>
        {role === "owner" ? "เจ้าของ" : "สมาชิก"}
      </Badge>
      {canManage && role !== "owner" && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`ตัวเลือกสำหรับ ${name}`}
              />
            }
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              ลบสมาชิก
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
