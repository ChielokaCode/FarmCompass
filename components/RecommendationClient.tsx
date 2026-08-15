"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Profile = {
  state:string; lga:string; farmSizeHa?:number; soilType?:string; pH?:number; irrigation:string;
  farmingGoal?:string; plantingMonth?:string; latitude?:number|null; longitude?:number|null;
  averageRainfallMm?:number|null; averageTemperatureC?:number|null;
  soilIntelligence?: { pH?:number|null; soilType?:string|null } | null
};
type Rec = { crop:{slug:string;name:string;scientificName:string;category:string}; score:number; reasons:string[] };

export default function RecommendationClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/recommendations");
    const d = await r.json();
    setLoading(false);
    if (r.ok) { setProfile(d.profile || null); setRecs(d.recommendations || []); }
    else setError(d.error || "Unable to load your recommendation data");
  }
  useEffect(() => { void load(); }, []);

  async function recommend() {
    setWorking(true); setError("");
    const r = await fetch("/api/recommendations", { method:"POST" });
    const d = await r.json();
    setWorking(false);
    if (!r.ok) { setError(d.error || "Unable to generate recommendation"); return; }
    setProfile(d.profile || profile);
    setRecs(d.recommendations || []);
  }

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading recommendation workspace…</div>;

  const effectiveSoilType = profile?.soilType || profile?.soilIntelligence?.soilType || null;
  const effectivePH = profile?.pH ?? profile?.soilIntelligence?.pH ?? null;

  return <div className="space-y-6">
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    {!profile ? <section className="fc-card p-5">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700"><AppIcon name="clock"/></div>
      <h2 className="mt-4 text-xl font-black">Add your farm profile first</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Add your farm details first so FarmCompass has enough context to rank crops for your farm.</p>
      <Link href="/profile" className="fc-btn fc-btn-secondary mt-5 w-full">Add farm details</Link>
    </section> : <>
      <section className="fc-card-flat p-5">
        <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Recommendation context</div><h2 className="mt-1 font-black">{profile.lga}, {profile.state}</h2></div><Link href="/profile" className="text-xs font-extrabold text-emerald-700">View farm</Link></div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="fc-stat-chip"><span className="text-xs text-slate-500">Soil</span><div className="mt-1 font-extrabold">{effectiveSoilType || "Unknown"}</div></div><div className="fc-stat-chip"><span className="text-xs text-slate-500">pH</span><div className="mt-1 font-extrabold">{effectivePH ?? "Unknown"}</div></div><div className="fc-stat-chip"><span className="text-xs text-slate-500">Water</span><div className="mt-1 font-extrabold capitalize">{profile.irrigation}</div></div><div className="fc-stat-chip"><span className="text-xs text-slate-500">Planting</span><div className="mt-1 font-extrabold">{profile.plantingMonth || "Not set"}</div></div></div>
        {profile.averageRainfallMm != null && profile.averageTemperatureC != null ? <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-blue-50 p-3"><div className="text-[11px] font-bold text-blue-700">Climate rainfall</div><div className="mt-1 text-sm font-black text-blue-950">{Math.round(profile.averageRainfallMm).toLocaleString()} mm/year</div></div><div className="rounded-2xl bg-blue-50 p-3"><div className="text-[11px] font-bold text-blue-700">Climate temperature</div><div className="mt-1 text-sm font-black text-blue-950">{profile.averageTemperatureC.toFixed(1)}°C</div></div></div> : <Link href="/profile" className="mt-3 flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-900"><span>Add farm GPS to include automatic rainfall and temperature matching.</span><AppIcon name="arrowRight" className="h-4 w-4 shrink-0"/></Link>}
        <button onClick={recommend} disabled={working} className="fc-btn fc-btn-primary mt-5 w-full"><AppIcon name="compass"/>{working ? "Comparing crops…" : recs.length ? "Refresh recommendation" : "Find crops for my farm"}</button>
        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">FarmCompass ranks crops using the farm factors that are available. The percentage is a suitability aid, not a yield guarantee.</p>
      </section>

      {recs.length > 0 && <section>
        <div className="flex items-end justify-between gap-3"><div><div className="fc-page-kicker">Your matches</div><h2 className="mt-1 text-2xl font-black">Top recommended crops</h2></div><span className="text-xs font-bold text-slate-500">{recs.length} results</span></div>
        <div className="mt-4 space-y-3">{recs.map((r, i) => <article key={r.crop.slug} className="fc-card p-5">
          <div className="flex items-start gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${i === 0 ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"}`}>#{i + 1}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">{r.crop.name}</h3><p className="mt-0.5 truncate text-xs italic text-slate-500">{r.crop.scientificName}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-800">{r.score}%</span></div></div></div>
          <ul className="mt-4 space-y-2">{r.reasons.slice(0,5).map(reason => <li key={reason} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><AppIcon name="check" className="h-3 w-3"/></span><span>{reason}</span></li>)}</ul>
          <div className="mt-5 grid grid-cols-2 gap-2"><Link href={`/crops/${r.crop.slug}`} className="fc-btn fc-btn-secondary !min-h-11 !py-2 text-sm">Crop guide</Link><Link href={`/assistant?crop=${r.crop.slug}`} className="fc-btn fc-btn-primary !min-h-11 !py-2 text-sm">Ask about it</Link></div>
        </article>)}</div>
      </section>}
    </>}
  </div>;
}
