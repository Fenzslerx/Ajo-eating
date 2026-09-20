import { createClient } from "@/lib/supabase/client";
import { LogStatus } from "@/lib/types";

type PendingLog = {
  id: string;
  dog_id: string;
  schedule_id: string | null;
  at: string;
  status: LogStatus;
  amount_g: number | null;
  food: string | null;
  note: string | null;
  photo?: File;
};

const dbName = "dogmeal-offline";
const storeName = "log-queue";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueLog(payload: Omit<PendingLog, "id">) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put({ ...payload, id: crypto.randomUUID() });
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function queuedLogs(): Promise<PendingLog[]> {
  const db = await database();
  const logs = await new Promise<PendingLog[]>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as PendingLog[]); request.onerror = () => reject(request.error);
  });
  db.close(); return logs;
}

async function removeQueuedLog(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function flushQueuedLogs() {
  if (!navigator.onLine) return 0;
  let sent = 0;
  for (const log of await queuedLogs()) {
    const { id, photo, ...payload } = log;
    let photoPath: string | undefined;
    if (photo) {
      const extension = photo.name.split(".").pop() || "jpg";
      const path = `${payload.dog_id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await createClient().storage.from("dog-photos").upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadError) continue;
      photoPath = path;
    }
    const { error } = await createClient().from("logs").insert({ ...payload, ...(photoPath ? { photo: photoPath } : {}) });
    if (!error) { await removeQueuedLog(id); sent += 1; }
  }
  return sent;
}
