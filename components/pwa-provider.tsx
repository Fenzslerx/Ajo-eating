"use client";

import { useEffect, useState } from "react";
import { flushQueuedLogs } from "@/lib/offline-queue";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

export function PwaProvider() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const flush = async () => {
      const count = await flushQueuedLogs();
      if (count) {
        setMessage(`ส่งบันทึกที่รอไว้แล้ว ${count} รายการ`);
        setTimeout(() => setMessage(""), 3500);
      }
    };

    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  return (
    <>
      <PwaInstallPrompt />
      {message ? (
        <p className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg">
          {message}
        </p>
      ) : null}
    </>
  );
}
