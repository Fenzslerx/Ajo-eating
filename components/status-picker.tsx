import { LogStatus, statusLabel } from "@/lib/types";

export function StatusPicker({ value, onChange }: { value: LogStatus; onChange: (value: LogStatus) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(statusLabel) as LogStatus[]).map((status) => (
        <button key={status} type="button" onClick={() => onChange(status)}
          className={`rounded-xl px-2 py-3 text-sm font-bold ${value === status ? "bg-orange-500 text-white" : "bg-orange-50 text-stone-600"}`}>
          {statusLabel[status]}
        </button>
      ))}
    </div>
  );
}
