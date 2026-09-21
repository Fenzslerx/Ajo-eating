"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { flushQueuedLogs, queueLog } from "@/lib/offline-queue";
import { DOG_PROFILE_STORAGE_KEY } from "@/lib/meal-utils";
import type { AppNotification, Dog, DogInvite, DogMember, MealLog, Profile, Schedule } from "./types";
import { captureSupabaseError } from "@/lib/sentry-reporter";

type Store = {
  currentUserId: string;
  currentUserEmail: string;
  profiles: Profile[];
  dogs: Dog[];
  schedules: Schedule[];
  logs: MealLog[];
  members: DogMember[];
  notifications: AppNotification[];
  pendingCount: number;
  isOnline: boolean;
  isLoading: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  load: () => Promise<void>;
  signOut: () => Promise<void>;
  addLog: (x: Omit<MealLog, "id" | "by">) => void;
  updateLog: (id: string, x: Partial<MealLog>) => void;
  removeLog: (id: string) => Promise<void>;
  addDog: (name: string, photo?: string | null, breed?: string | null, birthdate?: string | null) => Promise<Dog | null>;
  updateDog: (id: string, updates: Partial<Dog>) => Promise<void>;
  removeDog: (id: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  addSchedule: (x: Omit<Schedule, "id">) => void;
  removeSchedule: (id: string) => void;
  addMember: (dogId: string, email: string) => void;
  removeMember: (dogId: string, userId: string) => Promise<void>;
  setMemberRole: (dogId: string, userId: string, role: "caretaker" | "viewer") => Promise<void>;
  profileFor: (id: string) => Profile | undefined;
  markNotificationAsRead: (id: string) => Promise<void>;
  getUserRole: (dogId: string) => "owner" | "caretaker" | "viewer" | null;
  createInviteLink: (dogId: string, role: "caretaker" | "viewer") => Promise<string>;
  revokeInvite: (inviteId: string) => Promise<void>;
  getPendingInvites: (dogId: string) => Promise<DogInvite[]>;
  acceptInvite: (token: string) => Promise<Dog>;
};

const Context = createContext<Store | null>(null);

// ─── helpers ──────────────────────────────────────────────────────────────────

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function getCachedSignedUrl(
  client: ReturnType<typeof createClient>,
  bucket: "dog-photos" | "meal-photos",
  storagePath: string | null
): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://") || storagePath.startsWith("data:")) {
    return storagePath;
  }

  const cacheKey = `${bucket}:${storagePath}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      const altBucket = bucket === "dog-photos" ? "meal-photos" : "dog-photos";
      const altResult = await client.storage.from(altBucket).createSignedUrl(storagePath, 3600);
      if (altResult.data?.signedUrl) {
        signedUrlCache.set(cacheKey, { url: altResult.data.signedUrl, expiresAt: now + 3500000 });
        return altResult.data.signedUrl;
      }
      return null;
    }

    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: now + 3500000 });
    return data.signedUrl;
  } catch (err) {
    captureSupabaseError(err, { operation: "storage", targetName: bucket });
    return null;
  }
}

/** Map a raw DB log row to a MealLog, injecting signed photo URL. */
const mapLog = (row: any, photo: string | null): MealLog => ({
  ...row,
  photo_before: null,
  photo_after: photo,
});

/** Read custom profile attributes from local storage fallback */
function getLocalDogProfiles(): Record<string, { breed?: string | null; birthdate?: string | null; photo?: string | null; name?: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DOG_PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ─── provider ─────────────────────────────────────────────────────────────────

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [members, setMembers] = useState<DogMember[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Debounce ref for realtime reload
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 8000);
    try {
      const s = createClient();
      const { data: { session } } = await s.auth.getSession();
      if (!session || !session.user) {
        setIsLoading(false);
        clearTimeout(timeout);
        return;
      }

      const user = session.user;
      setUserId(user.id);
      setUserEmail(user.email || "");

      const [d, sc, l, notifRes] = await Promise.all([
        s.from("dogs").select("*"),
        s.from("schedules").select("id,dog_id,label,time"),
        s.from("logs").select("*").order("at", { ascending: false }),
        s.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      if (d.error) {
        captureSupabaseError(d.error, { operation: "select", targetName: "dogs", userId: user.id });
      }
      if (sc.error) {
        captureSupabaseError(sc.error, { operation: "select", targetName: "schedules", userId: user.id });
      }
      if (l.error) {
        captureSupabaseError(l.error, { operation: "select", targetName: "logs", userId: user.id });
      }
      if (notifRes.error) {
        captureSupabaseError(notifRes.error, { operation: "select", targetName: "notifications", userId: user.id });
      }

      const localProfiles = getLocalDogProfiles();
      const rawDogs = (d.data ?? []) as any[];

      // Generate cached signed URLs for dog profile photos
      const dogSigned = await Promise.all(
        rawDogs.map((dog) => getCachedSignedUrl(s, "dog-photos", dog.photo))
      );

      // Map DB dogs merged with localProfiles
      const seenDogIds = new Set<string>();
      const dogRows: Dog[] = rawDogs.map((dog, idx) => {
        seenDogIds.add(dog.id);
        const stored = localProfiles[dog.id] || {};
        return {
          id: dog.id,
          name: stored.name || dog.name,
          photo: stored.photo || dogSigned[idx] || null,
          owner_id: dog.owner_id,
          breed: stored.breed ?? dog.breed ?? null,
          birthdate: stored.birthdate ?? dog.birthdate ?? null,
        };
      });

      // If local profiles contain newly added dog not yet returned by DB query
      Object.entries(localProfiles).forEach(([id, stored]) => {
        if (!seenDogIds.has(id) && stored.name) {
          dogRows.push({
            id,
            name: stored.name,
            photo: stored.photo || null,
            owner_id: user.id,
            breed: stored.breed ?? null,
            birthdate: stored.birthdate ?? null,
          });
        }
      });

      setDogs(dogRows);
      setSchedules(sc.data ?? []);
      setNotifications(notifRes.data ?? []);
      const logRows = l.data ?? [];

      // Generate cached signed URLs in parallel for meal photos
      const signed = await Promise.all(
        logRows.map((row: any) => getCachedSignedUrl(s, "meal-photos", row.photo ?? null))
      );
      setLogs(logRows.map((row: any, i: number) => mapLog(row, signed[i])));

      if (dogRows.length > 0) {
        const groups = await Promise.all(
          dogRows.map(async (dog) => {
            const res = await s.rpc("get_dog_members", { target_dog_id: dog.id });
            return (res.data ?? []) as any[];
          })
        );
        const all = groups.flatMap((group, i) =>
          group.map((member: any) => ({ ...member, dog_id: dogRows[i]?.id }))
        );
        setMembers(all);

        const profileMap = new Map<string, Profile>();
        // Add current user profile
        if (user.id) {
          profileMap.set(user.id, {
            id: user.id,
            name: user.email ? user.email.split("@")[0] : "ฉัน",
            email: user.email || "",
          });
        }
        all.forEach((member: any) => {
          if (member.user_id) {
            profileMap.set(member.user_id, {
              id: member.user_id,
              name: member.email ? member.email.split("@")[0] : (member.name || "Member"),
              email: member.email || "",
            });
          }
        });
        setProfiles(Array.from(profileMap.values()));
      } else {
        setMembers([]);
        setProfiles(user.id ? [{
          id: user.id,
          name: user.email ? user.email.split("@")[0] : "ฉัน",
          email: user.email || "",
        }] : []);
      }

      setLastSyncedAt(new Date());
      setSyncError(null);
    } catch (err: unknown) {
      console.error("Failed to load store data:", err);
      const errMessage = err instanceof Error ? err.message : String(err);
      setSyncError(errMessage || "เกิดข้อผิดพลาดในการโหลดข้อมูลจากเซิร์ฟเวอร์");
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, []);

  /** Debounced reload — prevents rapid-fire realtime events from hammering DB */
  const debouncedLoad = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void load(), 500);
  }, [load]);

  // Listen to Supabase auth state change: when SIGNED_IN or TOKEN_REFRESHED, trigger load() immediately
  useEffect(() => {
    const s = createClient();
    const { data: { subscription } } = s.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void load();
      } else if (event === "SIGNED_OUT") {
        setDogs([]);
        setSchedules([]);
        setLogs([]);
        setMembers([]);
        setProfiles([]);
        setUserId("");
        setUserEmail("");
        setIsLoading(false);
      }
    });

    // Initial load call
    void load();

    return () => {
      subscription.unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    setOnline(navigator.onLine);

    const up = () => {
      setOnline(true);
      void flushQueuedLogs().then(load);
    };
    const down = () => setOnline(false);
    addEventListener("online", up);
    addEventListener("offline", down);

    const onProfileChanged = () => {
      debouncedLoad();
    };
    addEventListener("dog-profile-changed", onProfileChanged);

    // Handle Safari / Chrome Back-Forward Cache restoration
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        debouncedLoad();
      }
    };
    addEventListener("pageshow", onPageShow);

    const s = createClient();
    const ch = s
      .channel("dogmeal-ui")
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "dogs" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "dog_members" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "dog_invites" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, debouncedLoad)
      .subscribe();

    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
      removeEventListener("dog-profile-changed", onProfileChanged);
      removeEventListener("pageshow", onPageShow);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      s.removeChannel(ch);
    };
  }, [load, debouncedLoad]);

  // ─── mutations ──────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    const s = createClient();
    await s.auth.signOut();
    setDogs([]);
    setSchedules([]);
    setLogs([]);
    setMembers([]);
    setNotifications([]);
    setProfiles([]);
    setUserId("");
    setUserEmail("");
    window.location.href = "/login";
  }, []);

  const addLog = useCallback(
    (x: Omit<MealLog, "id" | "by">) => {
      const save = async () => {
        const s = createClient();
        const payload: any = {
          dog_id: x.dog_id,
          schedule_id: x.schedule_id,
          at: x.at,
          status: x.status,
          amount_g: x.amount_g,
          food: x.food,
          note: x.note,
        };

        const preview = x.photo_after;
        if (preview?.startsWith("blob:") || preview?.startsWith("data:")) {
          try {
            const blob = await fetch(preview).then((r) => r.blob());
            const path = `${x.dog_id}/${crypto.randomUUID()}.jpg`;
            const { error: uploadErr } = await s.storage
              .from("meal-photos")
              .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
            if (!uploadErr) {
              payload.photo = path;
            } else {
              captureSupabaseError(uploadErr, { operation: "storage", targetName: "meal-photos" });
            }
          } catch (storageErr) {
            captureSupabaseError(storageErr, { operation: "storage", targetName: "meal-photos" });
          }
        }

        const { error: insertErr } = await s.from("logs").insert(payload);
        if (insertErr) {
          captureSupabaseError(insertErr, { operation: "insert", targetName: "logs" });
        }
        await load();
      };

      if (!navigator.onLine) {
        setPending((v) => v + 1);
        void queueLog({
          dog_id: x.dog_id,
          schedule_id: x.schedule_id,
          at: x.at,
          status: x.status,
          amount_g: x.amount_g,
          food: x.food,
          note: x.note,
        });
        return;
      }
      void save();
    },
    [load]
  );

  const updateLog = useCallback(
    (id: string, x: Partial<MealLog>) => {
      void (async () => {
        try {
          const s = createClient();
          const payload: any = {};
          if (x.dog_id !== undefined) payload.dog_id = x.dog_id;
          if (x.schedule_id !== undefined) payload.schedule_id = x.schedule_id;
          if (x.at !== undefined) payload.at = x.at;
          if (x.status !== undefined) payload.status = x.status;
          if (x.amount_g !== undefined) payload.amount_g = x.amount_g;
          if (x.food !== undefined) payload.food = x.food;
          if (x.note !== undefined) payload.note = x.note;

          // Optimistic local update so photo shows immediately without waiting for storage upload
          setLogs((prev) =>
            prev.map((l) => (l.id === id ? { ...l, ...payload, photo_after: x.photo_after ?? l.photo_after } : l))
          );

          if ((x.photo_after?.startsWith("blob:") || x.photo_after?.startsWith("data:")) && x.dog_id) {
            const blob = await fetch(x.photo_after).then((r) => r.blob());
            const path = `${x.dog_id}/${crypto.randomUUID()}.jpg`;
            const { error: uploadErr } = await s.storage
              .from("meal-photos")
              .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
            if (!uploadErr) {
              payload.photo = path;
            } else {
              captureSupabaseError(uploadErr, { operation: "storage", targetName: "meal-photos" });
            }
          } else if (x.photo_after === null) {
            payload.photo = null;
          }

          const { error: updateErr } = await s.from("logs").update(payload).eq("id", id);
          if (updateErr) {
            captureSupabaseError(updateErr, { operation: "update", targetName: "logs" });
          }
          await load();
        } catch (err) {
          captureSupabaseError(err, { operation: "update", targetName: "logs" });
        }
      })();
    },
    [load]
  );

  const removeLog = useCallback(
    async (id: string) => {
      try {
        const { error } = await createClient().from("logs").delete().eq("id", id);
        if (error) {
          captureSupabaseError(error, { operation: "delete", targetName: "logs" });
        }
        await load();
      } catch (err) {
        captureSupabaseError(err, { operation: "delete", targetName: "logs" });
      }
    },
    [load]
  );

  const addDog = useCallback(
    async (name: string, photo?: string | null, breed?: string | null, birthdate?: string | null): Promise<Dog | null> => {
      const cleanName = name.trim();
      if (!cleanName) {
        throw new Error("กรุณาระบุชื่อน้องหมา");
      }

      const s = createClient();
      const { data: sessionData } = await s.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) {
        console.warn("[saveDogProfile/addDog] No active session found");
        return null;
      }

      let storagePhotoPath: string | null = null;
      if (photo?.startsWith("blob:") || photo?.startsWith("data:")) {
        try {
          const blob = await fetch(photo).then((r) => r.blob());
          const uploadPath = `avatars/${crypto.randomUUID()}.jpg`;
          const { error: uploadErr } = await s.storage
            .from("dog-photos")
            .upload(uploadPath, blob, { contentType: blob.type || "image/jpeg", upsert: true });
          if (!uploadErr) {
            storagePhotoPath = uploadPath;
          } else {
            captureSupabaseError(uploadErr, { operation: "storage", targetName: "dog-photos" });
          }
        } catch (storageErr) {
          captureSupabaseError(storageErr, { operation: "storage", targetName: "dog-photos" });
        }
      } else if (photo) {
        storagePhotoPath = photo;
      }

      const { data: createdDogRecord, error: rpcError } = await s.rpc("create_dog", {
        dog_name: cleanName,
        dog_photo: storagePhotoPath ?? null,
      });

      if (rpcError) {
        captureSupabaseError(rpcError, { operation: "rpc", targetName: "create_dog" });
        throw new Error(`ไม่สามารถสร้างข้อมูลน้องหมาในระบบได้: ${rpcError.message}`);
      }

      const dogRow = (Array.isArray(createdDogRecord) ? createdDogRecord[0] : createdDogRecord) as {
        id?: string;
        name?: string;
        photo?: string | null;
        owner_id?: string;
      } | null;

      const dogId = dogRow?.id;
      if (!dogId) {
        throw new Error("ระบบไม่สามารถระบุ ID ของน้องหมาที่สร้างขึ้นได้");
      }

      const localProfiles = getLocalDogProfiles();
      localProfiles[dogId] = { name: cleanName, breed, birthdate, photo: storagePhotoPath };
      localStorage.setItem(DOG_PROFILE_STORAGE_KEY, JSON.stringify(localProfiles));

      const newDogEntity: Dog = {
        id: dogId,
        name: dogRow.name || cleanName,
        photo: dogRow.photo ?? storagePhotoPath ?? null,
        owner_id: dogRow.owner_id || currentUser.id,
        breed: breed || null,
        birthdate: birthdate || null,
      };

      setDogs((prevDogs) => [...prevDogs.filter((existingDog) => existingDog.id !== dogId), newDogEntity]);
      window.dispatchEvent(new CustomEvent("dog-profile-changed", { detail: { id: dogId, name: cleanName } }));

      await load();
      return newDogEntity;
    },
    [load]
  );

  const updateDog = useCallback(
    async (id: string, updates: Partial<Dog>) => {
      try {
        const s = createClient();
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;

        // Upload photo if new blob
        if (updates.photo?.startsWith("blob:") || updates.photo?.startsWith("data:")) {
          const blob = await fetch(updates.photo).then((r) => r.blob());
          const path = `avatars/${id}-${crypto.randomUUID()}.jpg`;
          const { error: uploadErr } = await s.storage
            .from("dog-photos")
            .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
          if (!uploadErr) {
            payload.photo = path;
          }
        } else if (updates.photo === null) {
          payload.photo = null;
        }

        // 1. Update in Supabase
        if (Object.keys(payload).length > 0) {
          const { error } = await s.from("dogs").update(payload).eq("id", id);
          if (error) console.error("updateDog Supabase error:", error.message);
        }

        // 2. Update local profile storage (dogProfile)
        const local = getLocalDogProfiles();
        local[id] = {
          ...local[id],
          name: updates.name ?? local[id]?.name,
          breed: updates.breed !== undefined ? updates.breed : local[id]?.breed,
          birthdate: updates.birthdate !== undefined ? updates.birthdate : local[id]?.birthdate,
          photo: updates.photo !== undefined ? updates.photo : local[id]?.photo,
        };
        localStorage.setItem(DOG_PROFILE_STORAGE_KEY, JSON.stringify(local));
        window.dispatchEvent(new CustomEvent("dog-profile-changed", { detail: { id, updates } }));

        // Optimistic UI state update immediately
        setDogs((prev) =>
          prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
        );

        await load();
      } catch (err) {
        console.error("updateDog exception:", err);
      }
    },
    [load]
  );

  const removeDog = useCallback(
    async (id: string) => {
      try {
        const { error } = await createClient().from("dogs").delete().eq("id", id);
        if (error) console.error("removeDog error:", error.message);

        const local = getLocalDogProfiles();
        delete local[id];
        localStorage.setItem(DOG_PROFILE_STORAGE_KEY, JSON.stringify(local));
        window.dispatchEvent(new CustomEvent("dog-profile-changed", { detail: { id, deleted: true } }));

        setDogs((prev) => prev.filter((d) => d.id !== id));
        await load();
      } catch (err) {
        console.error("removeDog exception:", err);
      }
    },
    [load]
  );

  const clearAllData = useCallback(async () => {
    try {
      const s = createClient();
      console.log("[clearAllData] Clearing logs, schedules, and dogs from Supabase...");
      await Promise.all([
        s.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        s.from("schedules").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        s.from("dogs").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);
      localStorage.removeItem(DOG_PROFILE_STORAGE_KEY);
      localStorage.removeItem("custom_meal_config");
      setDogs([]);
      setSchedules([]);
      setLogs([]);
      window.dispatchEvent(new CustomEvent("dog-profile-changed", { detail: { cleared: true } }));
      await load();
    } catch (err) {
      console.error("clearAllData exception:", err);
    }
  }, [load]);

  const addSchedule = useCallback(
    (x: Omit<Schedule, "id">) => {
      void (async () => {
        try {
          const { error } = await createClient().from("schedules").insert(x);
          if (error) console.error("addSchedule error:", error.message);
          await load();
        } catch (err) {
          console.error("addSchedule exception:", err);
        }
      })();
    },
    [load]
  );

  const removeSchedule = useCallback(
    (id: string) => {
      void (async () => {
        try {
          const { error } = await createClient().from("schedules").delete().eq("id", id);
          if (error) console.error("removeSchedule error:", error.message);
          await load();
        } catch (err) {
          console.error("removeSchedule exception:", err);
        }
      })();
    },
    [load]
  );

  const addMember = useCallback(
    (dogId: string, email: string) => {
      void (async () => {
        try {
          const { error } = await createClient().rpc("invite_dog_member", {
            target_dog_id: dogId,
            target_email: email,
          });
          if (error) console.error("addMember error:", error.message);
          await load();
        } catch (err) {
          console.error("addMember exception:", err);
        }
      })();
    },
    [load]
  );

  const removeMember = useCallback(
    async (dogId: string, targetUserId: string) => {
      const s = createClient();
      const { error: delErr } = await s.rpc("remove_dog_member", {
        target_dog_id: dogId,
        target_user_id: targetUserId,
      });
      if (delErr) {
        captureSupabaseError(delErr, { operation: "rpc", targetName: "remove_dog_member" });
        throw new Error(delErr.message || "ไม่สามารถลบสมาชิกได้");
      }
      await load();
    },
    [load]
  );

  const setMemberRole = useCallback(
    async (dogId: string, targetUserId: string, nextRole: "caretaker" | "viewer") => {
      const s = createClient();
      const { error: roleErr } = await s.rpc("set_dog_member_role", {
        target_dog_id: dogId,
        target_user_id: targetUserId,
        target_role: nextRole,
      });
      if (roleErr) {
        captureSupabaseError(roleErr, { operation: "rpc", targetName: "set_dog_member_role" });
        throw new Error(roleErr.message || "ไม่สามารถเปลี่ยนสิทธิ์ได้");
      }
      await load();
    },
    [load]
  );

  const getUserRole = useCallback(
    (dogId: string): "owner" | "caretaker" | "viewer" | null => {
      if (!userId) return null;
      const targetDog = dogs.find((d) => d.id === dogId);
      if (targetDog?.owner_id === userId) return "owner";
      const membership = members.find((m) => m.dog_id === dogId && m.user_id === userId);
      if (!membership) return null;
      if (membership.role === "owner") return "owner";
      if (membership.role === "viewer") return "viewer";
      return "caretaker";
    },
    [userId, dogs, members]
  );

  const createInviteLink = useCallback(async (dogId: string, role: "caretaker" | "viewer"): Promise<string> => {
    const s = createClient();
    const { data: generatedToken, error: inviteErr } = await s.rpc("create_invite_link", {
      dog_id_input: dogId,
      role_input: role,
    });
    if (inviteErr) {
      captureSupabaseError(inviteErr, { operation: "rpc", targetName: "create_invite_link" });
      throw new Error(inviteErr.message || "ไม่สามารถสร้างลิงก์เชิญได้");
    }
    return generatedToken as string;
  }, []);

  const revokeInvite = useCallback(async (inviteId: string): Promise<void> => {
    const s = createClient();
    const { error: revokeErr } = await s.rpc("revoke_invite", {
      invite_id_input: inviteId,
    });
    if (revokeErr) {
      captureSupabaseError(revokeErr, { operation: "rpc", targetName: "revoke_invite" });
      throw new Error(revokeErr.message || "ไม่สามารถยกเลิกคำเชิญได้");
    }
  }, []);

  const getPendingInvites = useCallback(async (dogId: string): Promise<DogInvite[]> => {
    const s = createClient();
    const { data: inviteRows, error: fetchErr } = await s.rpc("get_dog_invites", {
      target_dog_id: dogId,
    });
    if (fetchErr) {
      captureSupabaseError(fetchErr, { operation: "rpc", targetName: "get_dog_invites" });
      return [];
    }
    return (inviteRows ?? []) as DogInvite[];
  }, []);

  const acceptInvite = useCallback(
    async (token: string): Promise<Dog> => {
      const s = createClient();
      const { data: joinedDog, error: acceptErr } = await s.rpc("accept_invite", {
        token_input: token,
      });
      if (acceptErr) {
        captureSupabaseError(acceptErr, { operation: "rpc", targetName: "accept_invite" });
        throw new Error(acceptErr.message || "ไม่สามารถรับคำเชิญได้");
      }
      await load();
      return joinedDog as Dog;
    },
    [load]
  );

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const s = createClient();
      const { error } = await s
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) {
        captureSupabaseError(error, { operation: "update", targetName: "notifications" });
        return;
      }
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
      );
    } catch (err) {
      captureSupabaseError(err, { operation: "update", targetName: "notifications" });
    }
  }, []);

  // ─── context value ──────────────────────────────────────────────────────────

  const value = useMemo<Store>(
    () => ({
      currentUserId: userId,
      currentUserEmail: userEmail,
      profiles,
      dogs,
      schedules,
      logs,
      members,
      notifications,
      pendingCount: pending,
      isOnline: online,
      isLoading,
      lastSyncedAt,
      syncError,
      load,
      signOut,
      addLog,
      updateLog,
      removeLog,
      addDog,
      updateDog,
      removeDog,
      clearAllData,
      addSchedule,
      removeSchedule,
      addMember,
      removeMember,
      setMemberRole,
      markNotificationAsRead,
      getUserRole,
      createInviteLink,
      revokeInvite,
      getPendingInvites,
      acceptInvite,
      profileFor: (id) => profiles.find((p) => p.id === id),
    }),
    [
      userId, userEmail, profiles, dogs, schedules, logs, members, notifications,
      pending, online, isLoading, lastSyncedAt, syncError,
      load, signOut, addLog, updateLog, removeLog, addDog, updateDog, removeDog, clearAllData,
      addSchedule, removeSchedule, addMember, removeMember, setMemberRole, markNotificationAsRead,
      getUserRole, createInviteLink, revokeInvite, getPendingInvites, acceptInvite,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error("AppStoreProvider missing");
  return value;
}
