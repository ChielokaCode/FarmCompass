import Link from "next/link";
import { notFound } from "next/navigation";
import { getCropBySlug } from "@/lib/crops";
import AppIcon from "@/components/AppIcon";

function Metric({ label, value, icon }: { label:string; value:React.ReactNode; icon:"flask"|"droplet"|"sun"|"clock" }) {
  return <div className="min-w-[145px] rounded-[20px] border border-emerald-900/10 bg-white p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><AppIcon name={icon} className="h-4 w-4"/></span><div className="mt-3 text-[10px] font-black uppercase tracking-[.1em] text-slate-400">{label}</div><div className="mt-1 text-sm font-black">{value || "Not specified"}</div></div>;
}

function Guide({ title, text }: { title:string; text:string }) {
  if (!text) return null;
  return <details className="fc-card-flat group overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-black"><span>{title}</span><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700 transition group-open:rotate-90"><AppIcon name="arrowRight" className="h-4 w-4"/></span></summary><div className="border-t border-slate-100 px-5 pb-5 pt-4"><div className="fc-prose text-sm">{text}</div></div></details>;
}

export default async function CropDetail({ params }:{ params:Promise<{slug:string}> }) {
  const { slug } = await params;
  const c = await getCropBySlug(slug);
  if (!c) notFound();

  return <main className="fc-mobile-page">
    <Link href="/crops" className="inline-flex items-center gap-2 text-sm font-extrabold text-emerald-800"><AppIcon name="arrowLeft" className="h-4 w-4"/> Crop Library</Link>

    <section className="fc-app-hero mt-5">
      <div className="relative z-10"><span className="inline-flex rounded-full bg-white/14 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em]">{c.category || "Crop"}</span><h1 className="mt-4 text-[35px] font-black leading-none tracking-[-.045em]">{c.name}</h1><p className="mt-2 text-sm italic text-emerald-100">{c.scientificName}</p><p className="mt-5 text-sm leading-6 text-emerald-50">{c.description || `Agronomic profile for ${c.name}, structured from the supplied Nigerian extension crop database.`}</p></div>
    </section>

    <div className="fc-horizontal-scroll mt-4">
      <Metric icon="flask" label="Soil pH" value={`${c.pH.min ?? "—"}–${c.pH.max ?? "—"}`} />
      <Metric icon="droplet" label="Rainfall" value={c.rainfallMm.min ? `${c.rainfallMm.min}–${c.rainfallMm.max} mm` : "See guidance"} />
      <Metric icon="sun" label="Temperature" value={c.temperatureC.min ? `${c.temperatureC.min}–${c.temperatureC.max} °C` : "See guidance"} />
      <Metric icon="clock" label="Duration" value={c.growthDuration || "See guidance"} />
    </div>

    <section className="fc-card-flat mt-5 p-5">
      <div className="fc-page-kicker">Suitability overview</div>
      <div className="mt-4 space-y-4 text-sm">
        <div><div className="font-black">States mentioned in source</div><p className="mt-1 leading-6 text-slate-600">{c.suitableStates.join(", ") || "Not explicitly extracted"}</p></div>
        <div><div className="font-black">Soil types</div><p className="mt-1 leading-6 text-slate-600">{c.soilTypes.join(", ") || "See source profile"}</p></div>
        <div><div className="font-black">Planting season</div><p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{c.plantingSeason || "See source profile"}</p></div>
        <div><div className="font-black">Irrigation</div><p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{c.irrigation || "See source profile"}</p></div>
      </div>
    </section>

    <section className="mt-6">
      <div className="fc-page-kicker">Production guidance</div>
      <h2 className="mt-1 text-2xl font-black">What you need to know</h2>
      <div className="mt-4 space-y-3">
        <Guide title="Farmer tips" text={c.sections.farmerTips}/>
        <Guide title="Fertiliser and nutrition" text={c.sections.fertiliser}/>
        <Guide title="Pests and diseases" text={c.sections.pestDisease}/>
        <Guide title="Varieties" text={c.sections.varieties}/>
        <Guide title="Planting guide" text={c.sections.plantingGuide}/>
        <Guide title="Harvest and storage" text={c.sections.harvestStorage}/>
      </div>
    </section>

    <div className="mt-6 grid grid-cols-2 gap-3"><Link href="/recommend" className="fc-btn fc-btn-secondary">Recommend</Link><Link href={`/assistant?crop=${c.slug}`} className="fc-btn fc-btn-primary">Ask about {c.name}</Link></div>
  </main>;
}
