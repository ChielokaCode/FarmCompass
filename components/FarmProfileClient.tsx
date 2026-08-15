"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useGeolocated } from "@/hooks/useGeolocated";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import AppIcon from "@/components/AppIcon";

const states = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara","FCT"
];
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Climate = {
  source: string;
  model: string;
  periodStart: string;
  periodEnd: string;
  years: number;
  averageAnnualRainfallMm: number;
  averageTemperatureC: number;
  updatedAt?: string;
};

type SoilIntelligence = {
  schemaVersion?: number;
  source: string;
  pH?: number | null;
  soilType?: string | null;
  faoClassification?: string | null;
  physical?: {
    sandPercent?: number | null;
    siltPercent?: number | null;
    clayPercent?: number | null;
    bulkDensityGcm3?: number | null;
  };
  chemical?: {
    pHH2O?: number | null;
    organicMatterPercent?: number | null;
    nitrogenGKg?: number | null;
    cecCmolKg?: number | null;
  };
  water?: {
    fieldCapacityVolPercent?: number | null;
    wiltingPointVolPercent?: number | null;
  };
  providerLatencySeconds?: number | null;
  attributes?: Record<string, string | number | boolean | null>;
  fetchedAt?: string;
};

type Profile = {
  state: string;
  lga: string;
  farmSizeHa?: number | null;
  soilType?: string | null;
  pH?: number | null;
  irrigation: "rainfed" | "irrigated" | "mixed" | "unknown";
  farmingGoal?: string | null;
  plantingMonth?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
  altitudeM?: number | null;
  altitudeAccuracyM?: number | null;
  locationCapturedAt?: string | null;
  averageRainfallMm?: number | null;
  averageTemperatureC?: number | null;
  climateBaseline?: Climate | null;
  soilIntelligence?: SoilIntelligence | null;
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
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  altitudeM: number | null;
  altitudeAccuracyM: number | null;
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
  latitude: null,
  longitude: null,
  locationAccuracyM: null,
  altitudeM: null,
  altitudeAccuracyM: null,
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
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    locationAccuracyM: profile.locationAccuracyM ?? null,
    altitudeM: profile.altitudeM ?? null,
    altitudeAccuracyM: profile.altitudeAccuracyM ?? null,
    notes: profile.notes || ""
  };
}

function baselinePeriod(climate?: Climate | null) {
  if (!climate) return "";
  return `${climate.periodStart.slice(0, 4)}–${climate.periodEnd.slice(0, 4)}`;
}

export default function FarmProfileClient({ email }: { email: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locationRequestActive = useRef(false);
  const handledLocationTimestamp = useRef<number | null>(null);

  const {
    coords,
    timestamp: geolocationTimestamp,
    isGeolocationAvailable,
    positionError,
    getPosition
  } = useGeolocated({
    positionOptions: {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 30_000
    },
    suppressLocationOnMount: true,
    watchLocationPermissionChange: true
  });

  useEffect(() => {
    fetch("/api/farm-profile")
      .then(async r => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "Unable to load your farm profile");
          return;
        }
        const next = data.profile || null;
        console.info("[FarmCompass][Kaegro][Client] Loaded farm profile soil intelligence", {
          hasSoilIntelligence: Boolean(next?.soilIntelligence),
          soilIntelligence: next?.soilIntelligence ?? null
        });
        setProfile(next);
        setForm(toForm(next));
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!locationRequestActive.current || !coords || geolocationTimestamp == null) return;
    if (handledLocationTimestamp.current === geolocationTimestamp) return;

    handledLocationTimestamp.current = geolocationTimestamp;
    locationRequestActive.current = false;
    setForm(prev => ({
      ...prev,
      latitude: Number(coords.latitude.toFixed(6)),
      longitude: Number(coords.longitude.toFixed(6)),
      locationAccuracyM: Number(coords.accuracy.toFixed(0)),
      altitudeM: coords.altitude == null ? null : Number(coords.altitude.toFixed(1)),
      altitudeAccuracyM: coords.altitudeAccuracy == null ? null : Number(coords.altitudeAccuracy.toFixed(1))
    }));
    setLocating(false);
    setError("");
    setMessage("Farm location captured. Save your farm profile to calculate climate, weather and location-based soil information automatically.");
  }, [coords, geolocationTimestamp]);

  useEffect(() => {
    if (!locationRequestActive.current || !positionError) return;

    locationRequestActive.current = false;
    setLocating(false);

    // The supplied useGeolocated implementation sets isGeolocationEnabled=false
    // for every position error. Do not use that flag as proof that permission
    // is blocked. Only GeolocationPositionError.PERMISSION_DENIED (code 1)
    // means the browser actually denied location access.
    if (positionError.code === positionError.PERMISSION_DENIED) {
      setError("Location permission was denied by the browser. Allow Location for FarmCompass and press Use my current location again.");
    } else if (positionError.code === positionError.TIMEOUT) {
      setError("The browser could not obtain your location before the request timed out. Your location permission may still be allowed. Try again, preferably on a phone or where location services have a stronger signal.");
    } else if (positionError.code === positionError.POSITION_UNAVAILABLE) {
      setError("Your browser could not determine a location from the device. Location permission may still be enabled. Check Windows/device Location Services or try again on a GPS-enabled phone.");
    } else {
      setError("FarmCompass could not obtain the farm location. Try again while location services are enabled.");
    }
  }, [positionError]);

  function useCurrentLocation() {
    console.info("[FarmCompass][Geolocation] Use my current location clicked");
    setError("");
    setMessage("");

    if (!isGeolocationAvailable) {
      setError("This browser does not support geolocation. You can still save the rest of your farm profile.");
      return;
    }

    locationRequestActive.current = true;
    setLocating(true);
    try {
      getPosition();
    } catch (locationError) {
      console.error("[FarmCompass][Geolocation] getPosition threw before the browser request completed", locationError);
      locationRequestActive.current = false;
      setLocating(false);
      setError("FarmCompass could not start the location request. Check the browser console for the geolocation diagnostic log.");
    }
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
      latitude: form.latitude,
      longitude: form.longitude,
      locationAccuracyM: form.locationAccuracyM,
      altitudeM: form.altitudeM,
      altitudeAccuracyM: form.altitudeAccuracyM,
      notes: textOrNull(form.notes)
    };

    const r = await fetch("/api/farm-profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    setSaving(false);

    console.info("[FarmCompass][Kaegro][Client] Farm profile save response", {
      httpStatus: r.status,
      ok: r.ok,
      soilWarning: data.soilWarning || null,
      hasSoilIntelligence: Boolean(data.profile?.soilIntelligence),
      soilIntelligence: data.profile?.soilIntelligence ?? null
    });

    if (!r.ok) {
      setError(data.error || "Unable to save your farm profile");
      return;
    }

    const next = data.profile || null;
    setProfile(next);
    setForm(toForm(next));
    const baseMessage = profile
      ? "Farm details updated. New recommendations will use these values."
      : "Farm profile created. You can now get a personalised recommendation.";
    const warnings = [data.climateWarning, data.soilWarning].filter(Boolean).join(" ");
    setMessage(warnings ? `${baseMessage} ${warnings}` : baseMessage);
  }

  if (loading) return <div className="fc-card-flat p-5 text-sm text-slate-500">Loading your farm profile…</div>;

  const hasCapturedLocation = form.latitude != null && form.longitude != null;
  const locationMatchesSaved = hasCapturedLocation && profile?.latitude != null && profile?.longitude != null
    && Math.abs((form.latitude ?? 0) - profile.latitude) < 0.0001
    && Math.abs((form.longitude ?? 0) - profile.longitude) < 0.0001;
  const climate = locationMatchesSaved ? profile?.climateBaseline : null;
  const soil = locationMatchesSaved ? profile?.soilIntelligence : null;

  return <div className="space-y-5">
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">{message}</div>}

    {!profile && <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><AppIcon name="farm"/></span>
        <div><h2 className="font-black text-emerald-950">Create your farm profile</h2><p className="mt-1 text-sm leading-6 text-emerald-900">Enter what you know. Do not guess soil pH. When farm GPS is saved, FarmCompass can obtain location-based soil information automatically.</p></div>
      </div>
    </section>}

    <form onSubmit={save} className="space-y-4">
      <section className="fc-card p-5">
        <div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Farm identity</div>
        <h2 className="mt-1 text-xl font-black">Where is the farm?</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">State</label><select required className="fc-input" value={form.state} onChange={e => update("state", e.target.value)}><option value="">Select State</option>{states.map(state => <option key={state}>{state}</option>)}</select></div>
          <div><label className="fc-label">LGA</label><input required className="fc-input" maxLength={100} value={form.lga} onChange={e => update("lga", e.target.value)} placeholder="e.g. Ifo"/></div>
          <div><label className="fc-label">Farm size (hectares)</label><input className="fc-input" type="number" min="0" step="0.01" value={form.farmSizeHa} onChange={e => update("farmSizeHa", e.target.value)} placeholder="Optional"/></div>
          <div><label className="fc-label">Water context</label><select className="fc-input" value={form.irrigation} onChange={e => update("irrigation", e.target.value as Profile["irrigation"])}><option value="unknown">Not sure</option><option value="rainfed">Rainfed</option><option value="irrigated">Irrigated</option><option value="mixed">Rainfed + irrigation</option></select></div>
        </div>
      </section>

      <section className="fc-card p-5">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><AppIcon name="mapPin"/></span><div><div className="text-xs font-black uppercase tracking-[.1em] text-blue-700">Farm GPS intelligence</div><h2 className="mt-1 text-xl font-black">Let FarmCompass detect climate and soil context</h2></div></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use the farm&apos;s location so FarmCompass can calculate long-term rainfall and temperature, show short-term weather, and request location-based soil information such as pH from the Kaegro soil service. This reduces the need to guess environmental values.</p>

        <button type="button" onClick={useCurrentLocation} disabled={locating} className="fc-btn fc-btn-secondary mt-4 w-full"><AppIcon name="mapPin"/>{locating ? "Finding farm location…" : hasCapturedLocation ? "Update farm location" : "Use my current location"}</button>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">FarmCompass reads latitude, longitude, accuracy and altitude (when the device provides it) from the browser Geolocation API. A timeout or unavailable position is not treated as a permission denial.</p>

        {hasCapturedLocation ? <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Saved coordinates</div><div className="mt-1 text-sm font-extrabold">{form.latitude?.toFixed(5)}, {form.longitude?.toFixed(5)}</div></div><button type="button" onClick={() => setForm(prev => ({ ...prev, latitude: null, longitude: null, locationAccuracyM: null, altitudeM: null, altitudeAccuracyM: null }))} className="text-xs font-black text-red-600">Remove</button></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Estimated horizontal accuracy: {form.locationAccuracyM == null ? "not reported" : `about ${Math.round(form.locationAccuracyM)} m`}.{form.altitudeM == null ? "" : ` Altitude: ${form.altitudeM.toFixed(1)} m${form.altitudeAccuracyM == null ? "" : ` (±${Math.round(form.altitudeAccuracyM)} m)`}.`} For best results, capture the location while you are physically at the farm.</p>
        </div> : <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><b>Optional but recommended:</b> without farm GPS, recommendations can still use State/LGA and other information you provide, but automatic climate matching, farm weather and Kaegro soil estimates will be unavailable.</div>}

        {(climate || soil) && hasCapturedLocation && <div className="mt-4 grid grid-cols-2 gap-2">
          {climate && <>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Avg annual rainfall</div><div className="mt-1 text-lg font-black">{Math.round(climate.averageAnnualRainfallMm).toLocaleString()} mm</div></div>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Avg temperature</div><div className="mt-1 text-lg font-black">{climate.averageTemperatureC.toFixed(1)}°C</div></div>
          </>}
          {soil && <>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Kaegro soil pH</div><div className="mt-1 text-lg font-black">{soil.pH == null ? "Not returned" : soil.pH.toFixed(2)}</div></div>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Kaegro soil type</div><div className="mt-1 text-lg font-black">{soil.soilType || "Not returned"}</div></div>
          </>}
          {climate && <div className="col-span-2 mt-1 text-[11px] leading-5 text-slate-500">Based on {climate.years}-year {climate.model} historical weather data ({baselinePeriod(climate)}). Soil pH and soil type are location-derived estimates from the Kaegro Soil API when available. These values support decision-making and do not replace an on-farm soil test.</div>}
          {!climate && soil && <div className="col-span-2 mt-1 text-[11px] leading-5 text-slate-500">Soil pH and soil type are location-derived estimates from the Kaegro Soil API. These values support decision-making and do not replace an on-farm soil test.</div>}
        </div>}
      </section>

      <section className="fc-card p-5">
        <div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Soil intelligence</div>
        <h2 className="mt-1 text-xl font-black">Soil information without guessing</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">FarmCompass uses a measured value you enter only when you actually have one. Otherwise, a saved GPS location can provide a Kaegro location-based soil estimate for recommendation context.</p>

        {soil ? <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Automatic soil profile</div><div className="mt-1 text-sm font-black text-emerald-950">Kaegro Soil API</div></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-emerald-700">GPS BASED</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Estimated pH (H₂O)</div><div className="mt-1 text-lg font-black">{soil.pH == null ? "Not returned" : soil.pH.toFixed(2)}</div></div>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Texture class</div><div className="mt-1 text-sm font-black">{soil.soilType || "Not returned"}</div></div>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">FAO classification</div><div className="mt-1 text-sm font-black">{soil.faoClassification || "Not returned"}</div></div>
            <div className="fc-stat-chip"><div className="text-[11px] font-bold text-slate-500">Organic matter</div><div className="mt-1 text-sm font-black">{soil.chemical?.organicMatterPercent == null ? "Not returned" : `${soil.chemical.organicMatterPercent.toFixed(2)}%`}</div></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Sand", soil.physical?.sandPercent == null ? null : `${soil.physical.sandPercent.toFixed(2)}%`],
              ["Silt", soil.physical?.siltPercent == null ? null : `${soil.physical.siltPercent.toFixed(2)}%`],
              ["Clay", soil.physical?.clayPercent == null ? null : `${soil.physical.clayPercent.toFixed(2)}%`],
              ["Bulk density", soil.physical?.bulkDensityGcm3 == null ? null : `${soil.physical.bulkDensityGcm3.toFixed(2)} g/cm³`],
              ["Nitrogen", soil.chemical?.nitrogenGKg == null ? null : `${soil.chemical.nitrogenGKg.toFixed(2)} g/kg`],
              ["CEC", soil.chemical?.cecCmolKg == null ? null : `${soil.chemical.cecCmolKg.toFixed(2)} cmol/kg`],
              ["Field capacity", soil.water?.fieldCapacityVolPercent == null ? null : `${soil.water.fieldCapacityVolPercent.toFixed(2)}%`],
              ["Wilting point", soil.water?.wiltingPointVolPercent == null ? null : `${soil.water.wiltingPointVolPercent.toFixed(2)}%`]
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{String(label)}</div><div className="mt-1 break-words text-xs font-extrabold text-slate-700">{value == null ? "Not returned" : String(value)}</div></div>)}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-emerald-900">Kaegro values are location-derived soil estimates. FarmCompass uses the estimated pH and texture directly when matching crop requirements; the remaining properties are retained as extra farm context for the AI assistant. A measured laboratory soil test should take priority where available.</p>
        </div> : hasCapturedLocation && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Save the farm profile to request soil information for these coordinates. If the external soil service is temporarily unavailable, the rest of your farm profile will still be saved.</div>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">Soil type (only if you know it)</label><select className="fc-input" value={form.soilType} onChange={e => update("soilType", e.target.value)}><option value="">Use automatic/unknown</option><option>Sandy loam</option><option>Loam</option><option>Clay loam</option><option>Sandy soil</option><option>Clay soil</option><option>Silt loam</option><option>Laterite</option></select></div>
          <div><label className="fc-label">Measured soil pH (optional)</label><input className="fc-input" type="number" min="3" max="10" step="0.1" value={form.pH} onChange={e => update("pH", e.target.value)} placeholder="Only enter a test result"/><p className="mt-1 text-[10px] leading-4 text-slate-500">Leave blank if you have not measured the soil. FarmCompass will use the Kaegro pH estimate when available.</p></div>
        </div>
      </section>

      <section className="fc-card p-5">
        <div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Farming plan</div>
        <h2 className="mt-1 text-xl font-black">What are you planning?</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="fc-label">Farming goal</label><select className="fc-input" value={form.farmingGoal} onChange={e => update("farmingGoal", e.target.value)}><option value="">Not specified</option><option value="food crop">Food crop</option><option value="cash crop">Cash crop</option><option value="vegetable">Vegetable</option><option value="fruit">Fruit crop</option><option value="short duration">Short-duration crop</option><option value="perennial">Perennial crop</option></select></div>
          <div><label className="fc-label">Planned planting month</label><select className="fc-input" value={form.plantingMonth} onChange={e => update("plantingMonth", e.target.value)}><option value="">Not specified</option>{months.map(month => <option key={month}>{month}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="fc-label">Personal farm notes</label><textarea className="fc-input" rows={3} maxLength={500} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Optional notes for your own farm profile"/></div>
        </div>
      </section>

      <button disabled={saving} className="fc-btn fc-btn-primary w-full"><AppIcon name="check"/>{saving ? "Saving farm details and location intelligence…" : profile ? "Save changes" : "Create my farm profile"}</button>
      {profile && <p className="text-center text-[11px] leading-5 text-slate-500">Last saved {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "recently"}. Changes affect future recommendations; previous saved recommendation results are not rewritten.</p>}
    </form>

    {profile && <div className="grid grid-cols-2 gap-2"><Link href="/recommend" className="fc-btn fc-btn-secondary w-full text-sm"><AppIcon name="compass"/>Recommend</Link><Link href="/weather" className="fc-btn fc-btn-secondary w-full text-sm"><AppIcon name="sun"/>Farm weather</Link></div>}

    <section className="fc-card-flat p-5"><div className="text-xs font-black uppercase tracking-[.1em] text-slate-400">Account</div><div className="mt-2 text-sm font-bold text-slate-700">{email}</div><div className="mt-4 flex flex-wrap gap-3"><Link href="/welcome?replay=1" className="fc-btn fc-btn-secondary !min-h-11 text-sm">Replay app tour</Link><div className="fc-btn fc-btn-secondary !min-h-11 text-sm"><LogoutButton/></div></div></section>
  </div>;
}
