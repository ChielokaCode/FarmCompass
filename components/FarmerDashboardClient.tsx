"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Profile={state:string;lga:string;farmSizeHa?:number;soilType?:string;pH?:number;irrigation:string;farmingGoal?:string;plantingMonth?:string};
type Rec={crop:{slug:string;name:string;scientificName:string};score:number;reasons:string[]};

export default function FarmerDashboardClient(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [recs,setRecs]=useState<Rec[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{fetch("/api/recommendations").then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{if(ok){setProfile(data.profile||null);setRecs(data.recommendations||[])}else setError(data.error||"Unable to load farm data")}).finally(()=>setLoading(false))},[]);

  return <div className="space-y-6">
    {error&&<div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    <section className="fc-card p-6">
      <p className="text-sm font-extrabold text-emerald-700">MY FARM PROFILE</p>
      <h2 className="mt-1 text-2xl font-extrabold">Farm details used for recommendations</h2>
      {loading?<p className="mt-5 fc-muted">Loading profile…</p>:profile?<><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["State",profile.state],["LGA",profile.lga],["Farm size",profile.farmSizeHa?`${profile.farmSizeHa} ha`:"Not recorded"],["Soil",profile.soilType||"Unknown"],["pH",profile.pH??"Unknown"],["Water",profile.irrigation],["Goal",profile.farmingGoal||"Not recorded"],["Planting month",profile.plantingMonth||"Not recorded"]].map(([a,b])=><div key={String(a)} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-extrabold uppercase text-slate-500">{a}</div><div className="mt-1 font-bold capitalize">{String(b)}</div></div>)}</div><Link className="fc-btn fc-btn-secondary mt-5" href="/profile">Edit my farm details</Link></>:<div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><b>Add your farm details to begin.</b><p className="mt-1 text-sm text-emerald-900">You create and update your own farm profile. FarmCompass uses it when you request a personalised recommendation.</p><Link className="fc-btn fc-btn-primary mt-4" href="/profile">Set up my farm</Link></div>}
    </section>
    {recs.length>0&&<section><p className="text-sm font-extrabold text-emerald-700">LATEST RESULT</p><h2 className="mt-1 text-2xl font-extrabold">Top crop matches</h2></section>}
  </div>;
}
