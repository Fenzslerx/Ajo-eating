"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogStatus, statusLabel } from "@/lib/types";
import { queueLog } from "@/lib/offline-queue";

export function QuickLog({ dogId, scheduleId, onSaved }: { dogId: string; scheduleId?: string; onSaved: () => void }) {
  const [saving, setSaving] = useState<LogStatus | null>(null);

  async function save(status: LogStatus) {
    setSaving(status);
    if (!navigator.onLine) {
      await queueLog({ dog_id: dogId, schedule_id: scheduleId ?? null, at: new Date().toISOString(), status, amount_g: null, food: null, note: null });
      setSaving(null); onSaved(); return;
    }
    const { error } = await createClient().from("logs").insert({ dog_id: dogId, schedule_id: scheduleId ?? null, status });
    setSaving(null);
    if (!error) onSaved();
  }

  return <div className="flex gap-2">{(Object.keys(statusLabel) as LogStatus[]).map((status) => (
    <button key={status} disabled={saving !== null} onClick={() => save(status)} className="flex-1 rounded-xl bg-orange-50 px-2 py-2 text-xs font-bold text-orange-700 disabled:opacity-50">
      {saving === status ? "กำลังบันทึก" : statusLabel[status]}
    </button>
  ))}</div>;
}
