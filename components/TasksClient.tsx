"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Cycle = {
  id: string;
  cropSlug: string;
  cropName: string;
  startDate: string;
  projectedEndDate: string;
  recommendationScore?: number | null;
};

type Task = {
  id: string;
  cycleId: string;
  cropSlug: string;
  cropName: string;
  title: string;
  description: string;
  scheduledDate: string;
  windowStart: string;
  windowEnd: string;
  dueAt: string;
  estimatedMinutes: number;
  priority: "NORMAL" | "IMPORTANT" | "CRITICAL";
  sourceSection: string;
  status: "PENDING" | "COMPLETED" | "SKIPPED";
  completedAt?: string | null;
};

function prettyDate(value: string) {
  const date = new Date(`${value}T12:00:00+01:00`);
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(date);
}

function durationText(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function TaskCard({ task, overdue, onToggle, busy }: { task: Task; overdue?: boolean; onToggle: (task: Task) => void; busy: boolean }) {
  const completed = task.status === "COMPLETED";
  return <article className={`fc-card-flat p-4 ${overdue && !completed ? "ring-1 ring-red-200" : ""}`}>
    <div className="flex items-start gap-3">
      <button type="button" disabled={busy} onClick={() => onToggle(task)} className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${completed ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-transparent"}`} aria-label={completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}>
        <AppIcon name="check" className="h-4 w-4"/>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.1em] text-emerald-700">{task.cropName} · {task.sourceSection}</div>
            <h3 className={`mt-1 font-black leading-5 ${completed ? "text-slate-400 line-through" : "text-slate-900"}`}>{task.title}</h3>
          </div>
          {overdue && !completed ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-700">Overdue</span> : task.priority !== "NORMAL" ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">{task.priority}</span> : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
          <span className="rounded-full bg-slate-50 px-2.5 py-1">{prettyDate(task.scheduledDate)}</span>
          <span className="rounded-full bg-slate-50 px-2.5 py-1">{task.windowStart}–{task.windowEnd}</span>
          <span className="rounded-full bg-slate-50 px-2.5 py-1">Est. {durationText(task.estimatedMinutes)}</span>
        </div>
        {completed && task.completedAt && <p className="mt-2 text-[11px] font-semibold text-emerald-700">Completed {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(task.completedAt))}</p>}
      </div>
    </div>
  </article>;
}

export default function TasksClient() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [today, setToday] = useState("");
  const [cropFilter, setCropFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load farm tasks.");
      setCycles(data.cycles || []);
      setTasks(data.tasks || []);
      setToday(data.today || "");
      window.dispatchEvent(new Event("farmcompass:notifications-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load farm tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(task: Task) {
    setBusyId(task.id);
    setError("");
    try {
      const completed = task.status !== "COMPLETED";
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update task.");
      setTasks(current => current.map(item => item.id === task.id ? { ...item, status: data.task.status, completedAt: data.task.completedAt } : item));
      window.dispatchEvent(new Event("farmcompass:notifications-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => cropFilter === "all" ? tasks : tasks.filter(task => task.cropSlug === cropFilter), [tasks, cropFilter]);
  const now = Date.now();
  const overdue = visible.filter(task => task.status === "PENDING" && new Date(task.dueAt).getTime() <= now);
  const todayPending = visible.filter(task => task.status === "PENDING" && task.scheduledDate === today && new Date(task.dueAt).getTime() > now);
  const upcoming = visible.filter(task => task.status === "PENDING" && task.scheduledDate > today);
  const completed = visible.filter(task => task.status === "COMPLETED").sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading your farm task plan…</div>;

  if (!cycles.length) return <section className="fc-card p-5">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="tasks"/></div>
    <h2 className="mt-4 text-xl font-black">No active crop task plan yet</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Generate crop recommendations and use the <strong>Select crop</strong> toggle. FarmCompass will turn the selected crop guidance into an AI-assisted operations schedule.</p>
    <Link href="/recommend" className="fc-btn fc-btn-primary mt-5 w-full">Choose from recommendations</Link>
  </section>;

  return <div className="space-y-6">
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <section className="fc-card-flat p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="fc-page-kicker">Accountability partner</div><h2 className="mt-1 text-xl font-black">Your active crop plans</h2></div>
        <span className="fc-badge">{cycles.length} active</span>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setCropFilter("all")} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${cropFilter === "all" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"}`}>All crops</button>
        {cycles.map(cycle => <button type="button" key={cycle.id} onClick={() => setCropFilter(cycle.cropSlug)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${cropFilter === cycle.cropSlug ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"}`}>{cycle.cropName}</button>)}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Task times and work durations are planning estimates. Follow the crop guide, product labels and field conditions. FarmCompass only creates in-app overdue alerts while you are using the application; no web-push or scheduled server job is used.</p>
    </section>

    {overdue.length > 0 && <section>
      <div className="flex items-end justify-between"><div><div className="text-xs font-black uppercase tracking-[.1em] text-red-700">Needs attention</div><h2 className="mt-1 text-2xl font-black">Overdue</h2></div><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{overdue.length}</span></div>
      <div className="mt-3 space-y-3">{overdue.map(task => <TaskCard key={task.id} task={task} overdue onToggle={toggle} busy={busyId === task.id}/>)}</div>
    </section>}

    <section>
      <div className="flex items-end justify-between"><div><div className="fc-page-kicker">Today</div><h2 className="mt-1 text-2xl font-black">Tasks for today</h2></div><span className="text-xs font-bold text-slate-500">{todayPending.length} pending</span></div>
      <div className="mt-3 space-y-3">{todayPending.length ? todayPending.map(task => <TaskCard key={task.id} task={task} onToggle={toggle} busy={busyId === task.id}/>) : <div className="fc-card-flat p-5 text-sm leading-6 text-slate-500">No additional pending tasks are scheduled for today.</div>}</div>
    </section>

    {upcoming.length > 0 && <section>
      <div className="fc-page-kicker">Coming up</div><h2 className="mt-1 text-2xl font-black">Upcoming work</h2>
      <div className="mt-3 space-y-3">{upcoming.slice(0, 30).map(task => <TaskCard key={task.id} task={task} onToggle={toggle} busy={busyId === task.id}/>)}</div>
    </section>}

    {completed.length > 0 && <details className="fc-card-flat group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-black"><span>Completed tasks ({completed.length})</span><AppIcon name="arrowRight" className="h-4 w-4 transition group-open:rotate-90"/></summary>
      <div className="space-y-3 border-t border-slate-100 p-4">{completed.slice(0, 50).map(task => <TaskCard key={task.id} task={task} onToggle={toggle} busy={busyId === task.id}/>)}</div>
    </details>}
  </div>;
}
