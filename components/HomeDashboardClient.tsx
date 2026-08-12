"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Profile = { state:string; lga:string; farmSizeHa?:number; soilType?:string; pH?:number; irrigation:string; farmingGoal?:string; plantingMonth?:string; updatedAt?:string };
type Rec = { crop:{slug:string;name:string;scientificName:string;category:string}; score:number; reasons:string[] };

export default function HomeDashboardClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/recommendations").then(async r => ({ ok:r.ok, data:await r.json() })).then(({ok,data}) => {
      if (ok) { setProfile(data.profile || null); setRecs(data.recommendations || []); }
      else setError(data.error || "Unable to load farm data");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading your FarmCompass home…</div>;
  if (error) return <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;

  return <div className="space-y-6">
    {!profile ? <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><AppIcon name="farm"/></div><div className="flex-1"><h2 className="font-black text-emerald-950">Add your farm details</h2><p className="mt-1 text-sm leading-6 text-emerald-900">Create your farm profile yourself so FarmCompass knows which conditions to use for personalised crop recommendations.</p><Link href="/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-800">Set up my farm <AppIcon name="arrowRight" className="h-4 w-4"/></Link></div></div>
    </section> : <section className="fc-card-flat p-5">
      <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.11em] text-emerald-700">My farm</div><h2 className="mt-1 text-xl font-black">{profile.lga}, {profile.state}</h2></div><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><AppIcon name="farm"/></span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Size</div><div className="mt-1 text-sm font-black">{profile.farmSizeHa ? `${profile.farmSizeHa} ha` : "—"}</div></div><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Soil</div><div className="mt-1 truncate text-sm font-black">{profile.soilType || "Unknown"}</div></div><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Water</div><div className="mt-1 truncate text-sm font-black capitalize">{profile.irrigation}</div></div></div>
      <Link href="/profile" className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800">View or edit farm details <AppIcon name="arrowRight" className="h-4 w-4"/></Link>
    </section>}

    <section>
      <div className="flex items-end justify-between"><div><div className="fc-page-kicker">Quick actions</div><h2 className="mt-1 text-xl font-black">What do you want to do?</h2></div></div>
      <div className="fc-quick-grid mt-4">
        <Link href="/recommend" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="compass"/></span><div className="mt-4 font-black">Get recommendation</div><div className="mt-1 text-xs leading-5 text-slate-500">Rank crops for this farm</div></Link>
        <Link href="/crops" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="leaf"/></span><div className="mt-4 font-black">Crop library</div><div className="mt-1 text-xs leading-5 text-slate-500">Browse all 34 crops</div></Link>
        <Link href="/assistant" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="sparkles"/></span><div className="mt-4 font-black">Ask FarmCompass</div><div className="mt-1 text-xs leading-5 text-slate-500">Get a grounded explanation</div></Link>
        <Link href="/welcome?replay=1" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="book"/></span><div className="mt-4 font-black">App tour</div><div className="mt-1 text-xs leading-5 text-slate-500">Review how it works</div></Link>
      </div>
    </section>

    {recs[0] && <section className="fc-card p-5">
      <div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-[.11em] text-emerald-700">Latest top match</div><h2 className="mt-1 text-2xl font-black">{recs[0].crop.name}</h2><p className="text-xs italic text-slate-500">{recs[0].crop.scientificName}</p></div><div className="grid h-16 w-16 place-items-center rounded-[20px] bg-emerald-50 text-lg font-black text-emerald-800">{recs[0].score}%</div></div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{recs[0].reasons[0] || "Open the recommendation to see the factors behind this match."}</p>
      <Link href="/recommend" className="fc-btn fc-btn-secondary mt-5 w-full">View recommendations <AppIcon name="arrowRight"/></Link>
    </section>}
  </div>;
}
