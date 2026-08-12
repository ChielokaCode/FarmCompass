"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Request failed"); return; }
    if (data.user.role === "ADMIN") router.push("/admin");
    else router.push(data.user.onboardingCompleted ? "/dashboard" : "/welcome");
    router.refresh();
  }

  return <form onSubmit={submit} className="space-y-4">
    {mode === "register" && <div><label className="fc-label">Full name</label><input name="name" required className="fc-input" placeholder="Your full name" autoComplete="name"/></div>}
    <div><label className="fc-label">Email address</label><input type="email" name="email" required className="fc-input" placeholder="name@example.com" autoComplete="email" inputMode="email"/></div>
    {mode === "register" && <div><label className="fc-label">Phone number <span className="font-medium text-slate-400">(optional)</span></label><input name="phone" className="fc-input" placeholder="080..." autoComplete="tel" inputMode="tel"/></div>}
    <div><label className="fc-label">Password</label><input type="password" name="password" required minLength={8} className="fc-input" autoComplete={mode === "login" ? "current-password" : "new-password"}/></div>
    {error && <div className="rounded-2xl bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</div>}
    <button disabled={busy} className="fc-btn fc-btn-primary w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in to FarmCompass" : "Create farmer account"}</button>
  </form>;
}
