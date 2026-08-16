"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setCount(Number(data.unreadCount || 0));
    } catch {
      // Keep navigation usable if the notification endpoint is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("farmcompass:notifications-refresh", onRefresh as EventListener);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("farmcompass:notifications-refresh", onRefresh as EventListener);
    };
  }, [refresh]);

  return <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-emerald-900/10 bg-white text-emerald-800" aria-label={`${count} unread notifications`}>
    <AppIcon name="bell" className="h-5 w-5"/>
    {count > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white">{count > 99 ? "99+" : count}</span>}
  </Link>;
}
