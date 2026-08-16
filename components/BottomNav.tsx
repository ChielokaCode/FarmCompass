"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon, { AppIconName } from "@/components/AppIcon";

const items: { href: string; label: string; icon: AppIconName; primary?: boolean }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/crops", label: "Crops", icon: "leaf" },
  { href: "/recommend", label: "Recommend", icon: "compass", primary: true },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/assistant", label: "Ask", icon: "sparkles" },
  { href: "/profile", label: "My Farm", icon: "farm" }
];

export default function BottomNav() {
  const pathname = usePathname();
  return <nav className="fc-bottom-nav" aria-label="Farmer navigation">
    <div className="fc-bottom-nav-inner">
      {items.map(item => {
        const active = pathname === item.href || (item.href === "/crops" && pathname.startsWith("/crops/")) || (item.href === "/dashboard" && pathname === "/weather");
        return <Link key={item.href} href={item.href} className={`fc-bottom-nav-item ${active ? "is-active" : ""} ${item.primary ? "is-primary" : ""}`}>
          <span className="fc-bottom-nav-icon"><AppIcon name={item.icon} className={item.primary ? "h-6 w-6" : "h-[21px] w-[21px]"}/></span>
          <span>{item.label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
