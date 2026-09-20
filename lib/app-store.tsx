"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { flushQueuedLogs, queueLog } from "@/lib/offline-queue";
import { DOG_PROFILE_STORAGE_KEY } from "@/lib/meal-utils";
import type { Dog, DogMember, MealLog, Profile, Schedule } from "./types";

type Store = {
  currentUserId: string;
  currentUserEmail: string;
  profiles: Profile[];
  dogs: Dog[];
  schedules: Schedule[];
  logs: MealLog[];
  members: DogMember[];
  pendingCount: number;
  isOnline: boolean;
  isLoading: boolean;
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
  removeMember: (dogId: string, userId: string) => void;
  setMemberRole: (dogId: string, userId: string, role: "member" | "editor" | "viewer") => void;
  profileFor: (id: string) => Profile | undefined;
};

const Context = createContext<Store | null>(null);

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a signed URL for a storage path (1-hour TTL). */
async function signedUrl(s: ReturnType<typeof createClient>, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await s.storage.from("dog-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce ref for realtime reload
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 8000);
    try {
      const s = createClient();
      // Use getSession() so we verify the active session and token immediately
      const { data: { session } } = await s.auth.getSession();
      if (!session || !session.user) {
        // No session yet: keep state clean and stop
        setIsLoading(false);
        clearTimeout(timeout);
        return;
      }

      const user = session.user;
      setUserId(user.id);
      setUserEmail(user.email || "");

      const [d, sc, l] = await Promise.all([
        s.from("dogs").select("*"),
        s.from("schedules").select("id,dog_id,label,time"),
        s.from("logs").select("*").order("at", { ascending: false }),
      ]);

      const localProfiles = getLocalDogProfiles();
      const rawDogs = (d.data ?? []) as any[];
      console.log("[getDogProfile/load]", {
        user: user.id,
        rawDogsCount: rawDogs.length,
        rawDogs,
        localProfiles,
        dogsError: d.error?.message,
      });

      // Generate signed URLs for dog photos
      const dogSigned = await Promise.all(
        rawDogs.map((dog) => {
          if (dog.photo && !dog.photo.startsWith("http") && !dog.photo.startsWith("data:")) {
            return signedUrl(s, dog.photo);
          }
          return Promise.resolve(dog.photo);
        })
      );

      const dogRows: Dog[] = rawDogs.map((dog, idx) => {
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

      setDogs(dogRows);
      setSchedules(sc.data ?? []);
      const logRows = l.data ?? [];

      // Generate signed URLs in parallel for meal logs
      const signed = await Promise.all(
        logRows.map((row: any) => signedUrl(s, row.photo ?? null))
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
    } catch (err) {
      console.error("Failed to load store data:", err);
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

    const s = createClient();
    const ch = s
      .channel("dogmeal-ui")
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "dogs" }, debouncedLoad)
      .subscribe();

    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
      removeEventListener("dog-profile-changed", onProfileChanged);
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
          const blob = await fetch(preview).then((r) => r.blob());
          const path = `${x.dog_id}/${crypto.randomUUID()}.jpg`;
          const { error } = await s.storage
            .from("dog-photos")
            .upload(path, blob, { contentType: blob.type || "image/jpeg" });
          if (!error) payload.photo = path;
        }

        const { error } = await s.from("logs").insert(payload);
        if (error) console.error("addLog insert error:", error.message);
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
            const { error } = await s.storage
              .from("dog-photos")
              .upload(path, blob, { contentType: blob.type || "image/jpeg" });
            if (!error) {
              payload.photo = path;
            } else {
              console.error("Storage upload error:", error);
            }
          } else if (x.photo_after === null) {
            payload.photo = null;
          }

          const { error } = await s.from("logs").update(payload).eq("id", id);
          if (error) console.error("updateLog error:", error.message);
          await load();
        } catch (err) {
          console.error("updateLog exception:", err);
        }
      })();
    },
    [load]
  );

  const removeLog = useCallback(
    async (id: string) => {
      try {
        const { error } = await createClient().from("logs").delete().eq("id", id);
        if (error) console.error("removeLog error:", error.message);
        await load();
      } catch (err) {
        console.error("removeLog exception:", err);
      }
    },
    [load]
  );

  const addDog = useCallback(
    async (name: string, photo?: string | null, breed?: string | null, birthdate?: string | null): Promise<Dog | null> => {
      try {
        const s = createClient();
        const { data: { session } } = await s.auth.getSession();
        if (!session?.user) {
          console.warn("[saveDogProfile/addDog] No active session found");
          return null;
        }

        const newDogId = crypto.randomUUID();
        console.log("[saveDogProfile/addDog] Creating dog with id:", newDogId, {
          name,
          owner_id: session.user.id,
        });

        // 1. Insert into Supabase dogs table with explicit ID
        const { data: insertedList, error } = await s
          .from("dogs")
          .insert({
            id: newDogId,
            name,
            photo: photo || null,
            owner_id: session.user.id,
          })
          .select();

        if (error) {
          console.error("[saveDogProfile/addDog] Supabase insert error:", error.message, error);
        } else {
          console.log("[saveDogProfile/addDog] Supabase insert success:", insertedList);
        }

        const effectiveId = insertedList?.[0]?.id || newDogId;

        // 2. Persist extended profile in localStorage (dogProfile)
        const local = getLocalDogProfiles();
        local[effectiveId] = { name, breed, birthdate, photo };
        localStorage.setItem(DOG_PROFILE_STORAGE_KEY, JSON.stringify(local));
        window.dispatchEvent(new CustomEvent("dog-profile-changed", { detail: { id: effectiveId, name } }));

        // 3. Optimistically add to state immediately
        const newDogObj: Dog = {
          id: effectiveId,
          name,
          photo: photo || null,
          owner_id: session.user.id,
          breed: breed || null,
          birthdate: birthdate || null,
        };
        setDogs((prev) => [...prev.filter((d) => d.id !== effectiveId), newDogObj]);

        // 4. Reload all store data to sync
        await load();
        return newDogObj;
      } catch (err) {
        console.error("[saveDogProfile/addDog] Exception:", err);
        return null;
      }
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
    (dogId: string, uid: string) => {
      void (async () => {
        try {
          const { error } = await createClient().rpc("remove_dog_member", {
            target_dog_id: dogId,
            target_user_id: uid,
          });
          if (error) console.error("removeMember error:", error.message);
          await load();
        } catch (err) {
          console.error("removeMember exception:", err);
        }
      })();
    },
    [load]
  );

  const setMemberRole = useCallback(
    (dogId: string, uid: string, role: "member" | "editor" | "viewer") => {
      void (async () => {
        try {
          const { error } = await createClient().rpc("set_dog_member_role", {
            target_dog_id: dogId,
            target_user_id: uid,
            target_role: role,
          });
          if (error) console.error("setMemberRole error:", error.message);
          await load();
        } catch (err) {
          console.error("setMemberRole exception:", err);
        }
      })();
    },
    [load]
  );

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
      pendingCount: pending,
      isOnline: online,
      isLoading,
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
      profileFor: (id) => profiles.find((p) => p.id === id),
    }),
    [
      userId, userEmail, profiles, dogs, schedules, logs, members,
      pending, online, isLoading,
      load, signOut, addLog, updateLog, removeLog, addDog, updateDog, removeDog, clearAllData,
      addSchedule, removeSchedule, addMember, removeMember, setMemberRole,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error("AppStoreProvider missing");
  return value;
}
