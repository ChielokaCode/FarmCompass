"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Climate = {
  source: string;
  model: string;
  periodStart: string;
  periodEnd: string;
  years: number;
  averageAnnualRainfallMm: number;
  averageTemperatureC: number;
  monthly?: { month:number; rainfallMm:number|null; temperatureC:number|null }[];
  updatedAt?: string;
};
type WeatherDay = {
  date: string;
  weatherCode: number|null;
  temperatureMaxC: number|null;
  temperatureMinC: number|null;
  precipitationMm: number|null;
  precipitationProbability: number|null;
  evapotranspirationMm: number|null;
  windSpeedMaxKmh: number|null;
};
type Advisory = { id:string; level:"info"|"watch"|"important"; title:string; message:string };
type Payload = {
  farm:{state:string;lga:string;latitude:number;longitude:number};
  climate: Climate|null;
  forecast:{
    timezone:string;
    current:{time:string|null;temperatureC:number|null;apparentTemperatureC:number|null;precipitationMm:number|null;weatherCode:number|null;windSpeedKmh:number|null};
    daily:WeatherDay[];
    advisories:Advisory[];
    fetchedAt:string;
  };
};

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function weatherLabel(code:number|null) {
  if (code == null) return "Weather unavailable";
  if (code === 0) return "Clear";
  if ([1,2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45,48].includes(code)) return "Foggy";
  if ([51,53,55,56,57].includes(code)) return "Drizzle";
  if ([61,63,65,66,67,80,81,82].includes(code)) return "Rain";
  if ([95,96,99].includes(code)) return "Thunderstorm";
  return "Mixed weather";
}

function dayName(date:string) {
  return new Intl.DateTimeFormat("en-NG", { weekday:"short" }).format(new Date(`${date}T00:00:00Z`));
}

export default function WeatherClient() {
  const [data,setData] = useState<Payload|null>(null);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [climateBusy,setClimateBusy] = useState(false);
  const [error,setError] = useState("");
  const [needsLocation,setNeedsLocation] = useState(false);

  async function load() {
    setRefreshing(true); setError(""); setNeedsLocation(false);
    try {
      const r = await fetch("/api/weather", { cache:"no-store" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Unable to load farm weather"); setNeedsLocation(Boolean(d.needsLocation)); return; }
      setData(d);
    } finally {
      setRefreshing(false); setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function refreshClimate() {
    setClimateBusy(true); setError("");
    const r = await fetch("/api/weather", { method:"POST" });
    const d = await r.json();
    setClimateBusy(false);
    if (!r.ok) { setError(d.error || "Unable to refresh climate averages"); return; }
    await load();
  }

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading your farm weather…</div>;

  if (needsLocation) return <section className="fc-card p-5">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><AppIcon name="mapPin"/></div>
    <h2 className="mt-4 text-xl font-black">Add the farm location first</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">FarmCompass needs the farm&apos;s GPS coordinates to retrieve climate averages and the local forecast. Capture the location while you are at the farm for the best result.</p>
    <Link href="/profile" className="fc-btn fc-btn-primary mt-5 w-full">Open My Farm <AppIcon name="arrowRight"/></Link>
  </section>;

  if (!data) return <div className="space-y-4">{error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}<button onClick={load} className="fc-btn fc-btn-secondary w-full">Try again</button></div>;

  const current = data.forecast.current;
  const today = data.forecast.daily[0];
  const climate = data.climate;

  return <div className="space-y-6">
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <section className="fc-weather-hero">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div><div className="text-sm font-bold text-blue-100">{data.farm.lga}, {data.farm.state}</div><div className="mt-2 flex items-end gap-2"><span className="text-5xl font-black tracking-[-.06em]">{current.temperatureC == null ? "—" : `${Math.round(current.temperatureC)}°`}</span><span className="pb-1 text-sm font-bold text-blue-100">{weatherLabel(current.weatherCode)}</span></div><p className="mt-3 text-sm text-blue-50">Feels like {current.apparentTemperatureC == null ? "—" : `${Math.round(current.apparentTemperatureC)}°C`} · Wind {current.windSpeedKmh == null ? "—" : `${Math.round(current.windSpeedKmh)} km/h`}</p></div>
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white"><AppIcon name="sun" className="h-8 w-8"/></span>
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white/12 p-3"><div className="text-[11px] font-bold text-blue-100">Rain probability</div><div className="mt-1 text-lg font-black">{today?.precipitationProbability == null ? "—" : `${Math.round(today.precipitationProbability)}%`}</div></div><div className="rounded-2xl bg-white/12 p-3"><div className="text-[11px] font-bold text-blue-100">Expected rain</div><div className="mt-1 text-lg font-black">{today?.precipitationMm == null ? "—" : `${today.precipitationMm.toFixed(1)} mm`}</div></div></div>
    </section>

    <section>
      <div className="flex items-end justify-between gap-3"><div><div className="fc-page-kicker"><AppIcon name="sun" className="h-4 w-4"/> 7-day forecast</div><h2 className="mt-1 text-xl font-black">What the week looks like</h2></div><button onClick={load} disabled={refreshing} className="text-xs font-black text-emerald-700">{refreshing ? "Refreshing…" : "Refresh"}</button></div>
      <div className="fc-horizontal-scroll mt-4">{data.forecast.daily.map(day => <article key={day.date} className="fc-weather-day-card">
        <div className="text-xs font-black text-slate-500">{dayName(day.date)}</div>
        <div className="mt-2 text-emerald-700"><AppIcon name={(day.precipitationProbability ?? 0) >= 50 ? "droplet" : "sun"} className="h-6 w-6"/></div>
        <div className="mt-3 text-sm font-black">{day.temperatureMaxC == null ? "—" : `${Math.round(day.temperatureMaxC)}°`} <span className="font-bold text-slate-400">/{day.temperatureMinC == null ? "—" : `${Math.round(day.temperatureMinC)}°`}</span></div>
        <div className="mt-2 text-[11px] font-bold text-blue-700">{day.precipitationProbability == null ? "—" : `${Math.round(day.precipitationProbability)}% rain`}</div>
        <div className="mt-1 text-[10px] text-slate-400">{day.precipitationMm == null ? "—" : `${day.precipitationMm.toFixed(1)} mm`}</div>
      </article>)}</div>
    </section>

    <section>
      <div className="fc-page-kicker"><AppIcon name="leaf" className="h-4 w-4"/> Farm advisory</div>
      <h2 className="mt-1 text-xl font-black">Weather-aware actions</h2>
      <div className="mt-4 space-y-3">{data.forecast.advisories.map(item => <article key={item.id} className={`rounded-[20px] border p-4 ${item.level === "important" ? "border-red-200 bg-red-50" : item.level === "watch" ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}><div className="font-black">{item.title}</div><p className="mt-1 text-sm leading-6 text-slate-700">{item.message}</p></article>)}</div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Forecasts can change. These advisories support timing decisions and do not replace product labels, local extension advice or field observation.</p>
    </section>

    <section className="fc-card p-5">
      <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Historical climate</div><h2 className="mt-1 text-xl font-black">Typical farm climate</h2></div><button onClick={refreshClimate} disabled={climateBusy} className="text-xs font-black text-emerald-700">{climateBusy ? "Updating…" : "Update"}</button></div>
      {climate ? <>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Average rainfall</div><div className="mt-1 text-xl font-black">{Math.round(climate.averageAnnualRainfallMm).toLocaleString()} mm</div><div className="mt-1 text-[10px] text-slate-400">per year</div></div><div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Average temperature</div><div className="mt-1 text-xl font-black">{climate.averageTemperatureC.toFixed(1)}°C</div><div className="mt-1 text-[10px] text-slate-400">daily mean</div></div></div>
        {climate.monthly?.length ? <div className="mt-5"><div className="text-xs font-black text-slate-500">Typical monthly rainfall</div><div className="fc-horizontal-scroll mt-3">{climate.monthly.map(month => <div key={month.month} className="min-w-[76px] rounded-2xl bg-slate-50 p-3 text-center"><div className="text-[10px] font-black text-slate-400">{monthNames[month.month-1]}</div><div className="mt-1 text-sm font-black">{month.rainfallMm == null ? "—" : `${Math.round(month.rainfallMm)} mm`}</div><div className="mt-1 text-[10px] text-slate-400">{month.temperatureC == null ? "—" : `${month.temperatureC.toFixed(1)}°C`}</div></div>)}</div></div> : null}
        <p className="mt-4 text-[11px] leading-5 text-slate-500">{climate.years}-year ERA5 baseline covering {climate.periodStart.slice(0,4)}–{climate.periodEnd.slice(0,4)}. FarmCompass uses these climate values when comparing your farm with crop rainfall and temperature ranges.</p>
      </> : <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Climate averages are not available yet. Tap <b>Update</b> to calculate them from the saved farm location.</div>}
    </section>

    <section className="fc-card-flat p-4 text-[11px] leading-5 text-slate-500"><b>Data source:</b> Open-Meteo forecast data and ERA5 historical reanalysis. Values represent the weather/climate grid around the saved farm coordinates and may differ from a physical sensor located directly on the field.</section>
  </div>;
}
