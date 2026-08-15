"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Profile = {
  state:string; lga:string; farmSizeHa?:number; soilType?:string; pH?:number; irrigation:string;
  farmingGoal?:string; plantingMonth?:string; latitude?:number|null; longitude?:number|null;
  averageRainfallMm?:number|null; averageTemperatureC?:number|null;
  soilIntelligence?:{pH?:number|null;soilType?:string|null;source?:string}|null; updatedAt?:string
};
type Rec = { crop:{slug:string;name:string;scientificName:string;category:string}; score:number; reasons:string[] };
type Weather = {
  current:{temperatureC:number|null;weatherCode:number|null};
  daily:{precipitationProbability:number|null;precipitationMm:number|null;temperatureMaxC:number|null;temperatureMinC:number|null}[];
  advisories:{title:string;message:string}[];
};

function weatherLabel(code:number|null) {
  if (code == null) return "Weather unavailable";
  if (code === 0) return "Clear";
  if ([1,2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return "Rain";
  if ([95,96,99].includes(code)) return "Thunderstorm";
  return "Mixed weather";
}

export default function HomeDashboardClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/recommendations").then(async r => ({ ok:r.ok, data:await r.json() })).then(async ({ok,data}) => {
      if (ok) {
        const nextProfile = data.profile || null;
        setProfile(nextProfile);
        setRecs(data.recommendations || []);
        if (nextProfile?.latitude != null && nextProfile?.longitude != null) {
          try {
            const weatherResponse = await fetch("/api/weather", { cache:"no-store" });
            const weatherData = await weatherResponse.json();
            if (weatherResponse.ok) setWeather(weatherData.forecast || null);
          } catch { /* Home remains usable when forecast service is unavailable. */ }
        }
      } else setError(data.error || "Unable to load farm data");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading your FarmCompass home…</div>;
  if (error) return <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;

  const today = weather?.daily?.[0];

  return <div className="space-y-6">
    {!profile ? <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><AppIcon name="farm"/></div><div className="flex-1"><h2 className="font-black text-emerald-950">Add your farm details</h2><p className="mt-1 text-sm leading-6 text-emerald-900">Create your farm profile yourself so FarmCompass knows which conditions to use for personalised crop recommendations.</p><Link href="/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-800">Set up my farm <AppIcon name="arrowRight" className="h-4 w-4"/></Link></div></div>
    </section> : <section className="fc-card-flat p-5">
      <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.11em] text-emerald-700">My farm</div><h2 className="mt-1 text-xl font-black">{profile.lga}, {profile.state}</h2></div><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><AppIcon name="farm"/></span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Size</div><div className="mt-1 text-sm font-black">{profile.farmSizeHa ? `${profile.farmSizeHa} ha` : "—"}</div></div><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Soil pH</div><div className="mt-1 truncate text-sm font-black">{profile.pH ?? profile.soilIntelligence?.pH ?? "—"}</div></div><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Water</div><div className="mt-1 truncate text-sm font-black capitalize">{profile.irrigation}</div></div></div>
      {profile.averageRainfallMm != null && profile.averageTemperatureC != null && <div className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-900">Climate from farm GPS: {Math.round(profile.averageRainfallMm).toLocaleString()} mm/year · {profile.averageTemperatureC.toFixed(1)}°C average.</div>}
      {profile.soilIntelligence?.pH != null && <div className="mt-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-900">Soil intelligence from farm GPS: estimated pH {profile.soilIntelligence.pH.toFixed(1)}{profile.soilIntelligence.soilType ? ` · ${profile.soilIntelligence.soilType}` : ""}. A measured soil test takes priority if available.</div>}
      <Link href="/profile" className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800">View or edit farm details <AppIcon name="arrowRight" className="h-4 w-4"/></Link>
    </section>}

    {profile && weather && <Link href="/weather" className="block fc-weather-mini-card">
      <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.1em] text-blue-700">Farm weather now</div><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-black">{weather.current.temperatureC == null ? "—" : `${Math.round(weather.current.temperatureC)}°C`}</span><span className="text-sm font-bold text-slate-500">{weatherLabel(weather.current.weatherCode)}</span></div></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><AppIcon name={(today?.precipitationProbability ?? 0) >= 50 ? "droplet" : "sun"}/></span></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><div className="fc-stat-chip"><div className="text-[11px] text-slate-500">Rain chance today</div><div className="mt-1 font-black">{today?.precipitationProbability == null ? "—" : `${Math.round(today.precipitationProbability)}%`}</div></div><div className="fc-stat-chip"><div className="text-[11px] text-slate-500">Expected rain</div><div className="mt-1 font-black">{today?.precipitationMm == null ? "—" : `${today.precipitationMm.toFixed(1)} mm`}</div></div></div>
      {weather.advisories?.[0] && <p className="mt-3 text-xs leading-5 text-slate-600"><b>{weather.advisories[0].title}:</b> {weather.advisories[0].message}</p>}
      <div className="mt-3 flex items-center justify-end gap-1 text-xs font-black text-blue-700">Open 7-day farm weather <AppIcon name="arrowRight" className="h-4 w-4"/></div>
    </Link>}

    <section>
      <div className="flex items-end justify-between"><div><div className="fc-page-kicker">Quick actions</div><h2 className="mt-1 text-xl font-black">What do you want to do?</h2></div></div>
      <div className="fc-quick-grid mt-4">
        <Link href="/recommend" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="compass"/></span><div className="mt-4 font-black">Get recommendation</div><div className="mt-1 text-xs leading-5 text-slate-500">Rank crops for this farm</div></Link>
        <Link href="/weather" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="sun"/></span><div className="mt-4 font-black">Farm weather</div><div className="mt-1 text-xs leading-5 text-slate-500">Climate + 7-day advisory</div></Link>
        <Link href="/crops" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="leaf"/></span><div className="mt-4 font-black">Crop library</div><div className="mt-1 text-xs leading-5 text-slate-500">Browse all 34 crops</div></Link>
        <Link href="/assistant" className="fc-quick-card"><span className="fc-quick-icon"><AppIcon name="sparkles"/></span><div className="mt-4 font-black">Ask FarmCompass</div><div className="mt-1 text-xs leading-5 text-slate-500">Get a grounded explanation</div></Link>
      </div>
    </section>

    {profile && profile.latitude == null && <section className="rounded-[22px] border border-blue-100 bg-blue-50 p-5"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-blue-700"><AppIcon name="mapPin"/></span><div><h3 className="font-black text-blue-950">Improve recommendations with farm GPS</h3><p className="mt-1 text-sm leading-6 text-blue-900">Add the farm location once and FarmCompass can automatically calculate long-term rainfall and temperature, show local weather, and request location-based soil pH/context.</p><Link href="/profile" className="mt-3 inline-flex items-center gap-1 text-sm font-black text-blue-800">Add farm location <AppIcon name="arrowRight" className="h-4 w-4"/></Link></div></div></section>}

    {recs[0] && <section className="fc-card p-5">
      <div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-[.11em] text-emerald-700">Latest top match</div><h2 className="mt-1 text-2xl font-black">{recs[0].crop.name}</h2><p className="text-xs italic text-slate-500">{recs[0].crop.scientificName}</p></div><div className="grid h-16 w-16 place-items-center rounded-[20px] bg-emerald-50 text-lg font-black text-emerald-800">{recs[0].score}%</div></div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{recs[0].reasons[0] || "Open the recommendation to see the factors behind this match."}</p>
      <Link href="/recommend" className="fc-btn fc-btn-secondary mt-5 w-full">View recommendations <AppIcon name="arrowRight"/></Link>
    </section>}
  </div>;
}
