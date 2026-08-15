"use client";

import { useEffect, useMemo, useState } from "react";
import AppIcon from "@/components/AppIcon";

type Profile = {
  state: string;
  lga: string;
  farmSizeHa?: number | null;
  soilType?: string | null;
  pH?: number | null;
  irrigation?: string;
  farmingGoal?: string | null;
  plantingMonth?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
  averageRainfallMm?: number | null;
  averageTemperatureC?: number | null;
  climateBaseline?: { model?: string; periodStart?: string; periodEnd?: string; years?: number } | null;
  soilIntelligence?: { source?: string; pH?: number | null; soilType?: string | null; attributes?: Record<string, string | number | boolean | null>; fetchedAt?: string } | null;
  notes?: string | null;
  updatedAt?: string;
};
type Farmer = { id: string; name: string; email: string; phone?: string; profile?: Profile | null };

export default function AdminClient() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/farmers")
      .then(async r => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!ok) { setError(data.error || "Unable to load farmer profiles"); return; }
        const list = data.farmers || [];
        setFarmers(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return farmers;
    return farmers.filter(f => [f.name, f.email, f.phone, f.profile?.state, f.profile?.lga].some(v => String(v || "").toLowerCase().includes(q)));
  }, [farmers, query]);
  const selected = farmers.find(f => f.id === selectedId) || null;

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading farmer profiles…</div>;
  if (error) return <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;

  return <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
    <section className="fc-card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><h2 className="text-xl font-extrabold">Farmer profiles</h2><p className="mt-1 text-sm leading-6 text-slate-500">Read-only visibility of farmer accounts and the farm details they entered.</p><div className="relative mt-4"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><AppIcon name="search" className="h-4 w-4"/></span><input className="fc-input pl-10" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search farmer, state or LGA"/></div></div>
      <div className="max-h-[650px] overflow-auto p-2">{filtered.length ? filtered.map(f => <button onClick={() => setSelectedId(f.id)} key={f.id} className={`w-full rounded-2xl p-4 text-left ${selectedId === f.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}><div className="font-extrabold">{f.name}</div><div className="mt-1 text-xs text-slate-500">{f.email}</div><div className={`mt-2 text-xs font-bold ${f.profile ? "text-emerald-700" : "text-amber-700"}`}>{f.profile ? `${f.profile.state} • ${f.profile.lga}` : "No farm profile yet"}</div></button>) : <div className="p-6 text-center text-sm text-slate-500">No farmers match your search.</div>}</div>
    </section>

    <section className="fc-card p-6">
      {selected ? <>
        <div className="flex items-start justify-between gap-4"><div><div className="text-sm font-extrabold text-emerald-700">FARMER PROFILE · READ ONLY</div><h2 className="mt-1 text-2xl font-extrabold">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.email}{selected.phone ? ` • ${selected.phone}` : ""}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600"><AppIcon name="eye"/></span></div>

        {!selected.profile ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="font-black text-amber-950">No farm profile has been added</div><p className="mt-1 text-sm leading-6 text-amber-900">This farmer has not yet created their farm details. Administrators can view profiles after farmers add them, but do not create or edit those profiles.</p></div> : <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ["State", selected.profile.state],
            ["LGA", selected.profile.lga],
            ["Farm size", selected.profile.farmSizeHa == null ? "Not recorded" : `${selected.profile.farmSizeHa} ha`],
            ["Soil type", selected.profile.soilType || selected.profile.soilIntelligence?.soilType || "Unknown"],
            ["Soil pH", selected.profile.pH ?? selected.profile.soilIntelligence?.pH ?? "Unknown"],
            ["Soil pH source", selected.profile.pH != null ? "Farmer-provided measured value" : selected.profile.soilIntelligence?.pH != null ? "Kaegro location estimate" : "Not available"],
            ["Soil data source", selected.profile.soilIntelligence?.source || "Not calculated"],
            ["Water context", selected.profile.irrigation || "Unknown"],
            ["Farming goal", selected.profile.farmingGoal || "Not recorded"],
            ["Planting month", selected.profile.plantingMonth || "Not recorded"],
            ["Farm GPS", selected.profile.latitude == null || selected.profile.longitude == null ? "Not recorded" : `${selected.profile.latitude.toFixed(5)}, ${selected.profile.longitude.toFixed(5)}`],
            ["GPS accuracy", selected.profile.locationAccuracyM == null ? "Not recorded" : `about ${Math.round(selected.profile.locationAccuracyM)} m`],
            ["Average rainfall", selected.profile.averageRainfallMm == null ? "Not recorded" : `${Math.round(selected.profile.averageRainfallMm).toLocaleString()} mm/year`],
            ["Average temperature", selected.profile.averageTemperatureC == null ? "Not recorded" : `${selected.profile.averageTemperatureC.toFixed(1)} °C`],
            ["Climate source", selected.profile.climateBaseline ? `${selected.profile.climateBaseline.model || "ERA5"} historical baseline` : "Not calculated"],
            ["Climate period", selected.profile.climateBaseline?.periodStart && selected.profile.climateBaseline?.periodEnd ? `${selected.profile.climateBaseline.periodStart.slice(0,4)}–${selected.profile.climateBaseline.periodEnd.slice(0,4)}` : "Not recorded"]
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{String(label)}</div><div className="mt-1 font-extrabold capitalize text-slate-800">{String(value)}</div></div>)}
          {selected.profile.soilIntelligence?.attributes && Object.keys(selected.profile.soilIntelligence.attributes).length > 0 && <div className="sm:col-span-2 rounded-2xl bg-emerald-50 p-4"><div className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Additional Kaegro soil attributes</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(selected.profile.soilIntelligence.attributes).filter(([label]) => !/latitude|longitude/i.test(label)).slice(0, 8).map(([label, value]) => <div key={label} className="rounded-xl bg-white px-3 py-2"><span className="text-[10px] font-bold uppercase text-slate-400">{label}</span><div className="text-xs font-extrabold text-slate-700">{String(value)}</div></div>)}</div></div>}
          {selected.profile.notes && <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-4"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Farmer notes</div><p className="mt-1 text-sm leading-6 text-slate-700">{selected.profile.notes}</p></div>}
          <div className="sm:col-span-2 text-xs text-slate-400">Last updated {selected.profile.updatedAt ? new Date(selected.profile.updatedAt).toLocaleString() : "not available"}</div>
        </div>}

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><b>Privacy boundary:</b> this administrator view does not expose the farmer&apos;s crop recommendations, recommendation history, or AI conversation history.</div>
      </> : <div className="grid min-h-96 place-items-center text-center text-slate-500"><div><div className="text-5xl">👩🏾‍🌾</div><p className="mt-3">Select a farmer to view their profile.</p></div></div>}
    </section>
  </div>;
}
