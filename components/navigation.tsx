import Link from "next/link";

export function Navigation({ active }: { active: "home" | "log" | "history" | "stats" | "settings" }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-orange-100 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around text-xs font-semibold">
        <Link className={active === "home" ? "text-orange-600" : "text-stone-400"} href="/">🏠<span className="ml-1">วันนี้</span></Link>
        <Link className={active === "log" ? "text-orange-600" : "text-stone-400"} href="/log">✍️<span className="ml-1">บันทึก</span></Link>
        <Link className={active === "history" ? "text-orange-600" : "text-stone-400"} href="/history">📚<span className="ml-1">ประวัติ</span></Link>
        <Link className={active === "stats" ? "text-orange-600" : "text-stone-400"} href="/stats">📊<span className="ml-1">สถิติ</span></Link>
        <Link className={active === "settings" ? "text-orange-600" : "text-stone-400"} href="/settings">⚙️<span className="ml-1">ตั้งค่า</span></Link>
      </div>
    </nav>
  );
}
