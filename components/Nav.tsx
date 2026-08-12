import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import BottomNav from "@/components/BottomNav";
import AppIcon from "@/components/AppIcon";

function Logo() {
  return <Link href="/" className="flex items-center gap-2.5" aria-label="FarmCompass home">
    <span className="grid h-10 w-10 place-items-center rounded-[15px] bg-emerald-700 text-white shadow-sm"><AppIcon name="compass" className="h-5 w-5"/></span>
    <div className="leading-tight"><div className="text-[17px] font-black tracking-[-.02em]">FarmCompass</div><div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">Nigeria</div></div>
  </Link>;
}

export default async function Nav() {
  const user = await getSessionUser();

  if (user?.role === "FARMER") {
    const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
    return <>
      <header className="fc-app-topbar">
        <div className="fc-app-width flex h-16 items-center justify-between px-4">
          <Logo />
          <Link href="/profile" className="grid h-10 w-10 place-items-center rounded-full border border-emerald-900/10 bg-emerald-50 text-xs font-black text-emerald-800" aria-label="Open my farm profile">{initials || "FC"}</Link>
        </div>
      </header>
      <BottomNav />
    </>;
  }

  if (user?.role === "ADMIN") {
    return <header className="sticky top-0 z-50 border-b border-emerald-900/10 bg-white/95 backdrop-blur">
      <div className="fc-container flex min-h-16 items-center justify-between gap-4 py-2">
        <Logo />
        <div className="flex items-center gap-4 text-sm"><Link href="/admin" className="font-extrabold text-emerald-800">Admin workspace</Link><span className="hidden text-slate-500 sm:inline">{user.name}</span><LogoutButton /></div>
      </div>
    </header>;
  }

  return <header className="fc-public-topbar">
    <div className="fc-app-width flex h-16 items-center justify-between px-4"><Logo /><Link href="/login" className="text-sm font-extrabold text-emerald-800">Sign in</Link></div>
  </header>;
}
