"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import AppIcon from "@/components/AppIcon";

const states = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara","FCT"
];
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Profile = {
  state: string;
  lga: string;
  farmSizeHa?: number | null;
  soilType?: string | null;
  pH?: number | null;
  irrigation: "rainfed" | "irrigated" | "mixed" | "unknown";
  farmingGoal?: string | null;
  plantingMonth?: string | null;
  averageRainfallMm?: number | null;
  averageTemperatureC?: number | null;
  notes?: string | null;
  updatedAt?: string;
};

type FormState = {
  state: string;
  lga: string;
  farmSizeHa: string;
  soilType: string;
  pH: string;
  irrigation: Profile["irrigation"];
  farmingGoal: string;
  plantingMonth: string;
  averageRainfallMm: string;
  averageTemperatureC: string;
  notes: string;
};

const emptyForm: FormState = {
  state: "",
  lga: "",
  farmSizeHa: "",
  soilType: "",
  pH: "",
  irrigation: "unknown",
  farmingGoal: "",
  plantingMonth: "",
  averageRainfallMm: "",
  averageTemperatureC: "",
  notes: ""
};

function toForm(profile: Profile | null): FormState {
  if (!profile) return emptyForm;
  return {
    state: profile.state || "",
    lga: profile.lga || "",
    farmSizeHa: profile.farmSizeHa == null ? "" : String(profile.farmSizeHa),
    soilType: profile.soilType || "",
    pH: profile.pH == null ? "" : String(profile.pH),
    irrigation: profile.irrigation || "unknown",
    farmingGoal: profile.farmingGoal || "",
    plantingMonth: profile.plantingMonth || "",
    averageRainfallMm: profile.averageRainfallMm == null ? "" : String(profile.averageRainfallMm),
    averageTemperatureC: profile.averageTemperatureC == null ? "" : String(profile.averageTemperatureC),
    notes: profile.notes || ""
  };
}

export default function FarmProfileClient({ email }: { email: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/farm-profile")
      .then(async r => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "Unable to load your farm profile");
          return;
        }
        const next = data.profile || null;
        setProfile(next);
        setForm(toForm(next));
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const numberOrNull = (value: string) => value.trim() === "" ? null : Number(value);
    const textOrNull = (value: string) => value.trim() === "" ? null : value.trim();
    const body = {
      state: form.state,
      lga: form.lga,
      farmSizeHa: numberOrNull(form.farmSizeHa),
      soilType: textOrNull(form.soilType),
      pH: numberOrNull(form.pH),
      irrigation: form.irrigation,
      farmingGoal: textOrNull(form.farmingGoal),
      plantingMonth: textOrNull(form.plantingMonth),
      averageRainfallMm: numberOrNull(form.averageRainfallMm),
      averageTemperatureC: numberOrNull(form.averageTemperatureC),
      notes: textOrNull(form.notes)
    };

    const r = await fetch("/api/farm-profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    setSaving(false);

    if (!r.ok) {
      setError(data.error || "Unable to save your farm profile");
      return;
    }

    setProfile(data.profile || null);
    setForm(toForm(data.profile || null));
    setMessage(profile ? "Farm details updated. New recommendations will use these values." : "Farm profile created. You can now get a personalised recommendation.");
  }

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading your farm profile…</div>;

  return <div className="space-y-5">
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">{message}</div>}

    {!profile && <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><AppIcon name="farm"/></span>
        <div><h2 className="font-black text-emerald-950">Set up your farm</h2><p className="mt-1 text-sm leading-6 text-emerald-900">Add the details you know about your farm. You can leave pH, rainfall and temperature blank if you do not know them, and you can edit the profile later.</p></div>
      </div>
    </section>}

    <form onSubmit={save} className="space-y-5">
      <section className="fc-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Farm location</div><h2 className="mt-1 text-xl font-black">Where is your farm?</h2></div>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="mapPin"/></span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">State</label><select required className="fc-input" value={form.state} onChange={e => update("state", e.target.value)}><option value="">Select state</option>{states.map(state => <option key={state}>{state}</option>)}</select></div>
          <div><label className="fc-label">LGA</label><input required className="fc-input" value={form.lga} onChange={e => update("lga", e.target.value)} placeholder="Local Government Area"/></div>
          <div><label className="fc-label">Farm size (hectares)</label><input className="fc-input" type="number" min="0" step="0.01" value={form.farmSizeHa} onChange={e => update("farmSizeHa", e.target.value)} placeholder="e.g. 1.5"/></div>
          <div><label className="fc-label">Water source/context</label><select className="fc-input" value={form.irrigation} onChange={e => update("irrigation", e.target.value as Profile["irrigation"])}><option value="unknown">I am not sure</option><option value="rainfed">Rainfed</option><option value="irrigated">Irrigated</option><option value="mixed">Rainfall + irrigation</option></select></div>
        </div>
      </section>

      <section className="fc-card p-5">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Soil</div><h2 className="mt-1 text-xl font-black">What do you know about the soil?</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="flask"/></span></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Do not guess. Unknown values are allowed; FarmCompass will use the factors that are available.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">Soil type</label><select className="fc-input" value={form.soilType} onChange={e => update("soilType", e.target.value)}><option value="">Unknown</option><option>Sandy loam</option><option>Loam</option><option>Clay loam</option><option>Clay</option><option>Sandy soil</option><option>Alluvial soil</option><option>Laterite</option></select></div>
          <div><label className="fc-label">Soil pH (if known)</label><input className="fc-input" type="number" min="3" max="10" step="0.1" value={form.pH} onChange={e => update("pH", e.target.value)} placeholder="Leave blank if unknown"/></div>
        </div>
      </section>

      <section className="fc-card p-5">
        <div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Farming plan</div>
        <h2 className="mt-1 text-xl font-black">What are you planning?</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">Farming goal</label><select className="fc-input" value={form.farmingGoal} onChange={e => update("farmingGoal", e.target.value)}><option value="">Not specified</option><option value="food crop">Food crop</option><option value="cash crop">Cash crop</option><option value="vegetable">Vegetable</option><option value="fruit">Fruit crop</option><option value="short duration">Short-duration crop</option><option value="perennial">Perennial crop</option></select></div>
          <div><label className="fc-label">Planned planting month</label><select className="fc-input" value={form.plantingMonth} onChange={e => update("plantingMonth", e.target.value)}><option value="">Not specified</option>{months.map(month => <option key={month}>{month}</option>)}</select></div>
        </div>
      </section>

      <details className="fc-card-flat p-5">
        <summary className="cursor-pointer font-black">Optional advanced climate details</summary>
        <p className="mt-2 text-xs leading-5 text-slate-500">Only enter these values if you have a reliable source for your farm or area.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">Average rainfall (mm/year)</label><input className="fc-input" type="number" min="0" step="1" value={form.averageRainfallMm} onChange={e => update("averageRainfallMm", e.target.value)}/></div>
          <div><label className="fc-label">Average temperature (°C)</label><input className="fc-input" type="number" min="-10" max="60" step="0.1" value={form.averageTemperatureC} onChange={e => update("averageTemperatureC", e.target.value)}/></div>
          <div className="sm:col-span-2"><label className="fc-label">Personal farm notes</label><textarea className="fc-input" rows={3} maxLength={500} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Optional notes for your own farm profile"/></div>
        </div>
      </details>

      <button disabled={saving} className="fc-btn fc-btn-primary w-full"><AppIcon name="check"/>{saving ? "Saving farm details…" : profile ? "Save changes" : "Create my farm profile"}</button>
      {profile && <p className="text-center text-[11px] leading-5 text-slate-500">Last saved {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "recently"}. Changes affect future recommendations; previous saved recommendation results are not rewritten.</p>}
    </form>

    {profile && <Link href="/recommend" className="fc-btn fc-btn-secondary w-full"><AppIcon name="compass"/>Get recommendation from these details</Link>}

    <section className="fc-card-flat p-5"><div className="text-xs font-black uppercase tracking-[.1em] text-slate-400">Account</div><div className="mt-2 text-sm font-bold text-slate-700">{email}</div><div className="mt-4 flex flex-wrap gap-3"><Link href="/welcome?replay=1" className="fc-btn fc-btn-secondary !min-h-11 text-sm">Replay app tour</Link><div className="fc-btn fc-btn-secondary !min-h-11 text-sm"><LogoutButton/></div></div></section>
  </div>;
}
