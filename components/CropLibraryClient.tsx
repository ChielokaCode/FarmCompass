"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Crop = { slug:string; name:string; scientificName:string; category:string; pH:{min:number|null;optimal:number|null;max:number|null}; suitableStates:string[] };

export default function CropLibraryClient({ crops }: { crops:Crop[] }) {
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("All");
  const categories = useMemo(() => ["All", ...Array.from(new Set(crops.map(c => c.category || "Other"))).sort()], [crops]);
  const filtered = useMemo(() => crops.filter(c => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q);
    const matchesCategory = category === "All" || (c.category || "Other") === category;
    return matchesQuery && matchesCategory;
  }), [crops,query,category]);

  return <>
    <div className="sticky top-16 z-30 -mx-4 bg-[var(--fc-bg)] px-4 pb-3 pt-2">
      <label className="relative block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><AppIcon name="leaf" className="h-4 w-4"/></span><input value={query} onChange={e=>setQuery(e.target.value)} className="fc-input !pl-11" placeholder="Search crops"/></label>
      <div className="fc-horizontal-scroll mt-3">{categories.map(c => <button key={c} onClick={()=>setCategory(c)} className={`fc-filter-pill ${category===c?"is-active":""}`}>{c}</button>)}</div>
    </div>
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{filtered.length} crop{filtered.length===1?"":"s"}</span><span>Tap a crop to open guidance</span></div>
    <div className="fc-crop-list mt-3">{filtered.map(c => <Link href={`/crops/${c.slug}`} key={c.slug} className="fc-crop-card">
      <span className="fc-crop-avatar"><AppIcon name="leaf" className="h-6 w-6"/></span>
      <div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[.1em] text-emerald-700">{c.category || "Crop"}</div><h2 className="mt-0.5 truncate text-lg font-black">{c.name}</h2><p className="truncate text-xs italic text-slate-500">{c.scientificName}</p><div className="mt-2 text-xs font-semibold text-slate-600">pH {c.pH.min ?? "—"}–{c.pH.max ?? "—"} · {c.suitableStates.length || "—"} states listed</div></div>
      <AppIcon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300"/>
    </Link>)}</div>
    {filtered.length===0 && <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No crop matches your search.</div>}
  </>;
}
