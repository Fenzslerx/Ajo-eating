"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { flushQueuedLogs, queueLog } from "@/lib/offline-queue";
import type { Dog, DogMember, MealLog, Profile, Schedule } from "./types";

type Store = {
  currentUserId: string;
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
const mapLog = (row: any, photo?: string | null): MealLog => ({ ...row, photo_before: null, photo_after: photo ?? null });

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [members, setMembers] = useState<DogMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userId, setUserId] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setUserId(user.id);

      const [d, sc, l] = await Promise.all([
        s.from("dogs").select("id,name,photo,owner_id"),
        s.from("schedules").select("id,dog_id,label,time"),
        s.from("logs").select("*").order("at", { ascending: false }),
      ]);

      const dogRows = (d.data ?? []) as Dog[];
      setDogs(dogRows);
      setSchedules(sc.data ?? []);
      const logRows = l.data ?? [];

      const signed = await Promise.all(
        logRows.map(async (row: any) =>
          row.photo
            ? (await s.storage.from("dog-photos").createSignedUrl(row.photo, 3600)).data?.signedUrl ?? null
            : null
        )
      );
      setLogs(logRows.map((row: any, index: number) => mapLog(row, signed[index])));

      if (dogRows.length > 0) {
        const groups = await Promise.all(
          dogRows.map(async (dog) => {
            const res = await s.rpc("get_dog_members", { target_dog_id: dog.id });
            return res.data ?? [];
          })
        );
        const all = groups.flatMap((group, index) =>
          (group as any[]).map((member: any) => ({ ...member, dog_id: dogRows[index]?.id }))
        );
        setMembers(all);
        setProfiles(
          all.map((member: any) => ({
            id: member.user_id,
            name: member.email ? member.email.split("@")[0] : (member.name || "Member"),
            email: member.email || "",
          }))
        );
      } else {
        setMembers([]);
        setProfiles([]);
      }
    } catch (err) {
      console.error("Failed to load store data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, load)
      .subscribe();

    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
      s.removeChannel(ch);
    };
  }, [load]);

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
        } else if (!preview) {
          payload.photo = null;
        }
        await s.from("logs").insert(payload);
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
        const s = createClient();
        const payload: any = {};
        if (x.dog_id !== undefined) payload.dog_id = x.dog_id;
        if (x.schedule_id !== undefined) payload.schedule_id = x.schedule_id;
        if (x.at !== undefined) payload.at = x.at;
        if (x.status !== undefined) payload.status = x.status;
        if (x.amount_g !== undefined) payload.amount_g = x.amount_g;
        if (x.food !== undefined) payload.food = x.food;
        if (x.note !== undefined) payload.note = x.note;

        if (x.photo_after?.startsWith("blob:")) {
          const blob = await fetch(x.photo_after).then((r) => r.blob());
          const path = `${x.dog_id || "photos"}/${crypto.randomUUID()}.jpg`;
          const { error } = await s.storage
            .from("dog-photos")
            .upload(path, blob, { contentType: blob.type || "image/jpeg" });
          if (!error) payload.photo = path;
        } else if (x.photo_after === null) {
          payload.photo = null;
        }

        await s.from("logs").update(payload).eq("id", id);
        await load();
      })();
    },
    [load]
  );

  const removeLog = useCallback(
    (id: string) => {
      void createClient().from("logs").delete().eq("id", id).then(load);
    },
    [load]
  );

  const addDog = useCallback(
    (name: string) => {
      void createClient()
        .auth.getUser()
        .then(({ data }) => data.user && createClient().from("dogs").insert({ name, owner_id: data.user.id }).then(load));
    },
    [load]
  );

  const removeDog = useCallback(
    (id: string) => {
      void createClient().from("dogs").delete().eq("id", id).then(load);
    },
    [load]
  );

  const addSchedule = useCallback(
    (x: Omit<Schedule, "id">) => {
      void createClient().from("schedules").insert(x).then(load);
    },
    [load]
  );

  const removeSchedule = useCallback(
    (id: string) => {
      void createClient().from("schedules").delete().eq("id", id).then(load);
    },
    [load]
  );

  const addMember = useCallback(
    (dogId: string, email: string) => {
      void createClient().rpc("invite_dog_member", { target_dog_id: dogId, member_email: email }).then(load);
    },
    [load]
  );

  const removeMember = useCallback(
    (dogId: string, userId: string) => {
      void createClient().from("dog_members").delete().eq("dog_id", dogId).eq("user_id", userId).then(load);
    },
    [load]
  );

  const setMemberRole = useCallback(
    (dogId: string, userId: string, role: "member" | "editor" | "viewer") => {
      void createClient()
        .rpc("set_dog_member_role", { target_dog_id: dogId, target_user_id: userId, target_role: role })
        .then(load);
    },
    [load]
  );

  const value = useMemo<Store>(
    () => ({
      currentUserId: userId,
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
      userId,
      profiles,
      dogs,
      schedules,
      logs,
      members,
      pending,
      online,
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
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error("AppStoreProvider missing");
  return value;
}
