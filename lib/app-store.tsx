"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { flushQueuedLogs, queueLog } from "@/lib/offline-queue";
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
  addLog: (x: Omit<MealLog, "id" | "by">) => void;
  updateLog: (id: string, x: Partial<MealLog>) => void;
  removeLog: (id: string) => void;
  addDog: (name: string) => void;
  removeDog: (id: string) => void;
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
    // Safety timeout — force isLoading=false after 8s no matter what
    const timeout = setTimeout(() => setIsLoading(false), 8000);
    try {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) {
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email || "");

      const [d, sc, l] = await Promise.all([
        s.from("dogs").select("id,name,photo,owner_id"),
        s.from("schedules").select("id,dog_id,label,time"),
        s.from("logs").select("*").order("at", { ascending: false }),
      ]);

      const dogRows = (d.data ?? []) as Dog[];
      setDogs(dogRows);
      setSchedules(sc.data ?? []);
      const logRows = l.data ?? [];

      // Generate signed URLs in parallel
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

  useEffect(() => {
    void load();
    setOnline(navigator.onLine);

    const up = () => {
      setOnline(true);
      void flushQueuedLogs().then(load);
    };
    const down = () => setOnline(false);
    addEventListener("online", up);
    addEventListener("offline", down);

    const s = createClient();
    const ch = s
      .channel("dogmeal-ui")
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, debouncedLoad)
      .subscribe();

    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      s.removeChannel(ch);
    };
  }, [load, debouncedLoad]);

  // ─── mutations ──────────────────────────────────────────────────────────────

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
        if (preview?.startsWith("blob:")) {
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

          if (x.photo_after?.startsWith("blob:") && x.dog_id) {
            // Only upload if we have a valid dog_id (required by RLS policy)
            const blob = await fetch(x.photo_after).then((r) => r.blob());
            const path = `${x.dog_id}/${crypto.randomUUID()}.jpg`;
            const { error } = await s.storage
              .from("dog-photos")
              .upload(path, blob, { contentType: blob.type || "image/jpeg" });
            if (!error) payload.photo = path;
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
    (id: string) => {
      void (async () => {
        try {
          const { error } = await createClient().from("logs").delete().eq("id", id);
          if (error) console.error("removeLog error:", error.message);
          await load();
        } catch (err) {
          console.error("removeLog exception:", err);
        }
      })();
    },
    [load]
  );

  const addDog = useCallback(
    (name: string) => {
      void (async () => {
        try {
          const s = createClient();
          const { data } = await s.auth.getUser();
          if (!data.user) return;
          const { error } = await s.from("dogs").insert({ name, owner_id: data.user.id });
          if (error) console.error("addDog error:", error.message);
          await load();
        } catch (err) {
          console.error("addDog exception:", err);
        }
      })();
    },
    [load]
  );

  const removeDog = useCallback(
    (id: string) => {
      void (async () => {
        try {
          const { error } = await createClient().from("dogs").delete().eq("id", id);
          if (error) console.error("removeDog error:", error.message);
          await load();
        } catch (err) {
          console.error("removeDog exception:", err);
        }
      })();
    },
    [load]
  );

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
            member_email: email,
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
          const { error } = await createClient()
            .from("dog_members")
            .delete()
            .eq("dog_id", dogId)
            .eq("user_id", uid);
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
      addLog,
      updateLog,
      removeLog,
      addDog,
      removeDog,
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
      addLog, updateLog, removeLog, addDog, removeDog,
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
