import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navigation } from "@/components/navigation";
import { TodayDashboard } from "@/components/today-dashboard";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8 pb-24">
      <p className="text-sm font-bold tracking-wide text-orange-600">DOGMEAL</p>
      <h1 className="mt-1 text-3xl font-bold">วันนี้กินดีไหม?</h1>
      <p className="mb-6 mt-2 text-sm text-stone-500">{new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
      <TodayDashboard />
      <Navigation active="home" />
    </main>
  );
}
