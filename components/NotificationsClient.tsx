"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  readAt?: string | null;
  createdAt: string;
};

export default function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load notifications.");
      setItems(data.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function markRead(id?: string) {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true })
      });
      if (!response.ok) return;
      const now = new Date().toISOString();
      setItems(current => current.map(item => id && item.id !== id ? item : { ...item, readAt: now }));
      window.dispatchEvent(new Event("farmcompass:notifications-refresh"));
    } catch {
      // A failed read receipt should not block access to the task itself.
    }
  }

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Checking task notifications…</div>;

  return <div className="space-y-4">
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {items.length > 0 && <div className="flex justify-end"><button type="button" onClick={() => void markRead()} className="text-xs font-black text-emerald-800">Mark all as read</button></div>}
    {items.length ? items.map(item => <article key={item.id} className={`fc-card-flat p-4 ${item.readAt ? "opacity-70" : "ring-1 ring-amber-200"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.readAt ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}><AppIcon name="bell" className="h-4 w-4"/></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><h2 className="font-black">{item.title}</h2>{!item.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-600"/>}</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-400">{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(item.createdAt))}</span>
            <Link href={item.href} onClick={() => void markRead(item.id)} className="text-xs font-black text-emerald-800">Open task</Link>
          </div>
        </div>
      </div>
    </article>) : <section className="fc-card p-5 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="bell"/></span>
      <h2 className="mt-4 text-xl font-black">No task alerts</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">When an active task passes its completion window without being checked off, FarmCompass will place an in-app alert here.</p>
      <Link href="/tasks" className="fc-btn fc-btn-secondary mt-5 w-full">Open Tasks</Link>
    </section>}
  </div>;
}
