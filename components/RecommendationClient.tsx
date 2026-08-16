"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

type Profile = {
  state: string;
  lga: string;
  farmSizeHa?: number;
  soilType?: string | null;
  pH?: number | null;
  irrigation: string;
  farmingGoal?: string;
  plantingMonth?: string;
  latitude?: number | null;
  longitude?: number | null;
  averageRainfallMm?: number | null;
  averageTemperatureC?: number | null;
  soilIntelligence?: {
    pH?: number | null;
    soilType?: string | null;
    faoClassification?: string | null;
    fetchedAt?: string | Date;
  } | null;
};

type Rec = {
  crop: {
    slug: string;
    name: string;
    scientificName: string;
    category: string;
  };
  score: number;
  reasons: string[];
};

type ActiveCycle = {
  cropSlug: string;
  cropName: string;
  id: string;
};

export default function RecommendationClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [cycles, setCycles] = useState<ActiveCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    console.info("[FarmCompass][Recommendation] Loading recommendation workspace...");

    try {
      const [recommendationResponse, cyclesResponse] = await Promise.all([
        fetch("/api/recommendations", { cache: "no-store" }),
        fetch("/api/crop-cycles", { cache: "no-store" })
      ]);

      const recommendationData = await recommendationResponse.json();
      const cyclesData = await cyclesResponse.json();

      console.info("[FarmCompass][Recommendation] GET /api/recommendations response", {
        ok: recommendationResponse.ok,
        status: recommendationResponse.status,
        profile: recommendationData?.profile,
        recommendationsCount: Array.isArray(recommendationData?.recommendations)
          ? recommendationData.recommendations.length
          : 0
      });

      console.info("[FarmCompass][Recommendation] GET soil data", {
        farmerEntered: {
          soilType: recommendationData?.profile?.soilType ?? null,
          pH: recommendationData?.profile?.pH ?? null
        },
        kaegro: {
          soilType: recommendationData?.profile?.soilIntelligence?.soilType ?? null,
          pH: recommendationData?.profile?.soilIntelligence?.pH ?? null,
          faoClassification:
            recommendationData?.profile?.soilIntelligence?.faoClassification ?? null,
          fetchedAt: recommendationData?.profile?.soilIntelligence?.fetchedAt ?? null
        },
        soilIntelligence: recommendationData?.profile?.soilIntelligence ?? null,
        coordinates: {
          latitude: recommendationData?.profile?.latitude ?? null,
          longitude: recommendationData?.profile?.longitude ?? null
        }
      });

      if (recommendationResponse.ok) {
        console.info(
          "[FarmCompass][Recommendation] Calling setProfile() from GET with",
          recommendationData.profile || null
        );
        setProfile(recommendationData.profile || null);
        setRecs(recommendationData.recommendations || []);
      } else {
        console.error(
          "[FarmCompass][Recommendation] GET recommendation request failed",
          recommendationData
        );
        setError(recommendationData.error || "Unable to load your recommendation data");
      }

      if (cyclesResponse.ok) {
        setCycles(cyclesData.cycles || []);
      } else {
        console.warn("[FarmCompass][Recommendation] Unable to load active crop cycles", cyclesData);
      }
    } catch (err) {
      console.error("[FarmCompass][Recommendation] Workspace load failed", err);
      setError(err instanceof Error ? err.message : "Unable to load your recommendation data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!profile) {
      console.info("[FarmCompass][Recommendation] Profile state is null");
      return;
    }

    const farmerSoilType = profile.soilType || null;
    const farmerPH = profile.pH ?? null;
    const kaegroSoilType = profile.soilIntelligence?.soilType || null;
    const kaegroPH = profile.soilIntelligence?.pH ?? null;
    const resolvedSoilType = farmerSoilType || kaegroSoilType || null;
    const resolvedPH = farmerPH ?? kaegroPH ?? null;

    console.info("[FarmCompass][Recommendation] Profile state / soil resolution", {
      farmerEntered: {
        soilType: farmerSoilType,
        pH: farmerPH
      },
      kaegro: {
        soilType: kaegroSoilType,
        pH: kaegroPH,
        faoClassification: profile.soilIntelligence?.faoClassification ?? null,
        fetchedAt: profile.soilIntelligence?.fetchedAt ?? null
      },
      effective: {
        soilType: resolvedSoilType,
        pH: resolvedPH
      },
      willDisplay: {
        soilType: resolvedSoilType || "Unknown",
        pH: resolvedPH ?? "Unknown"
      },
      coordinates: {
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null
      },
      fullProfile: profile
    });
  }, [profile]);

  async function recommend() {
    setWorking(true);
    setError("");
    setNotice("");

    console.info("[FarmCompass][Recommendation] POST /api/recommendations started");

    try {
      const response = await fetch("/api/recommendations", { method: "POST" });
      const data = await response.json();

      console.info("[FarmCompass][Recommendation] POST /api/recommendations response", {
        ok: response.ok,
        status: response.status,
        profile: data?.profile,
        recommendationsCount: Array.isArray(data?.recommendations)
          ? data.recommendations.length
          : 0
      });

      console.info("[FarmCompass][Recommendation] POST soil data", {
        farmerEntered: {
          soilType: data?.profile?.soilType ?? null,
          pH: data?.profile?.pH ?? null
        },
        kaegro: {
          soilType: data?.profile?.soilIntelligence?.soilType ?? null,
          pH: data?.profile?.soilIntelligence?.pH ?? null,
          faoClassification: data?.profile?.soilIntelligence?.faoClassification ?? null,
          fetchedAt: data?.profile?.soilIntelligence?.fetchedAt ?? null
        },
        soilIntelligence: data?.profile?.soilIntelligence ?? null,
        coordinates: {
          latitude: data?.profile?.latitude ?? null,
          longitude: data?.profile?.longitude ?? null
        }
      });

      if (!response.ok) {
        console.error("[FarmCompass][Recommendation] Recommendation generation failed", data);
        setError(data.error || "Unable to generate recommendation");
        return;
      }

      const nextProfile = data.profile || profile;
      console.info(
        "[FarmCompass][Recommendation] Calling setProfile() from POST with",
        nextProfile
      );

      setProfile(nextProfile);
      setRecs(data.recommendations || []);
    } catch (err) {
      console.error("[FarmCompass][Recommendation] POST recommendation request failed", err);
      setError(err instanceof Error ? err.message : "Unable to generate recommendation");
    } finally {
      setWorking(false);
    }
  }

  const selectedSlugs = useMemo(
    () => new Set(cycles.map(cycle => cycle.cropSlug)),
    [cycles]
  );

  async function toggleCrop(rec: Rec) {
    const selected = selectedSlugs.has(rec.crop.slug);
    setSelecting(rec.crop.slug);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        selected
          ? `/api/crop-cycles?cropSlug=${encodeURIComponent(rec.crop.slug)}`
          : "/api/crop-cycles",
        {
          method: selected ? "DELETE" : "POST",
          headers: selected ? undefined : { "Content-Type": "application/json" },
          body: selected
            ? undefined
            : JSON.stringify({
                cropSlug: rec.crop.slug,
                recommendationScore: rec.score
              })
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update the crop task plan.");
      }

      if (selected) {
        setCycles(current => current.filter(cycle => cycle.cropSlug !== rec.crop.slug));
        setNotice(`${rec.crop.name} task plan removed from your active Tasks.`);
      } else {
        const cyclesResponse = await fetch("/api/crop-cycles", { cache: "no-store" });
        const cyclesData = await cyclesResponse.json();
        if (cyclesResponse.ok) setCycles(cyclesData.cycles || []);
        setNotice(
          `${rec.crop.name} selected. FarmCompass created ${data.taskCount || 0} AI-assisted farm tasks.`
        );
      }

      window.dispatchEvent(new Event("farmcompass:notifications-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the crop task plan.");
    } finally {
      setSelecting(null);
    }
  }

  const effectiveSoilType =
    profile?.soilType || profile?.soilIntelligence?.soilType || null;
  const effectivePH = profile?.pH ?? profile?.soilIntelligence?.pH ?? null;

  if (loading) {
    return (
      <div className="fc-card-flat p-5 text-sm text-slate-500">
        Loading recommendation workspace…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
          {notice}{" "}
          <Link href="/tasks" className="font-black underline">
            Open Tasks
          </Link>
        </div>
      )}

      {!profile ? (
        <section className="fc-card p-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <AppIcon name="clock" />
          </div>
          <h2 className="mt-4 text-xl font-black">Add your farm profile first</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add your farm details first so FarmCompass has enough context to rank crops for your farm.
          </p>
          <Link href="/profile" className="fc-btn fc-btn-secondary mt-5 w-full">
            Add farm details
          </Link>
        </section>
      ) : (
        <>
          <section className="fc-card-flat p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">
                  Recommendation context
                </div>
                <h2 className="mt-1 font-black">
                  {profile.lga}, {profile.state}
                </h2>
              </div>
              <Link href="/profile" className="text-xs font-extrabold text-emerald-700">
                View farm
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="fc-stat-chip">
                <span className="text-xs text-slate-500">Soil</span>
                <div className="mt-1 font-extrabold">{profile.soilIntelligence?.soilType}</div>
              </div>
              <div className="fc-stat-chip">
                <span className="text-xs text-slate-500">pH</span>
                <div className="mt-1 font-extrabold">{profile.soilIntelligence?.pH}</div>
              </div>
              <div className="fc-stat-chip">
                <span className="text-xs text-slate-500">Water</span>
                <div className="mt-1 font-extrabold capitalize">{profile.irrigation}</div>
              </div>
              <div className="fc-stat-chip">
                <span className="text-xs text-slate-500">Planting</span>
                <div className="mt-1 font-extrabold">{profile.plantingMonth || "Not set"}</div>
              </div>
            </div>

            {profile.averageRainfallMm != null && profile.averageTemperatureC != null ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-blue-50 p-3">
                  <div className="text-[11px] font-bold text-blue-700">Climate rainfall</div>
                  <div className="mt-1 text-sm font-black text-blue-950">
                    {Math.round(profile.averageRainfallMm).toLocaleString()} mm/year
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3">
                  <div className="text-[11px] font-bold text-blue-700">Climate temperature</div>
                  <div className="mt-1 text-sm font-black text-blue-950">
                    {profile.averageTemperatureC.toFixed(1)}°C
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/profile"
                className="mt-3 flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-900"
              >
                <span>Add farm GPS to include automatic rainfall and temperature matching.</span>
                <AppIcon name="arrowRight" className="h-4 w-4 shrink-0" />
              </Link>
            )}

            <button
              onClick={recommend}
              disabled={working}
              className="fc-btn fc-btn-primary mt-5 w-full"
            >
              <AppIcon name="compass" />
              {working
                ? "Comparing crops…"
                : recs.length
                  ? "Refresh recommendation"
                  : "Find crops for my farm"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
              FarmCompass ranks crops using the farm factors that are available. The percentage is a
              suitability aid, not a yield guarantee.
            </p>
          </section>

          {recs.length > 0 && (
            <section>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="fc-page-kicker">Your matches</div>
                  <h2 className="mt-1 text-2xl font-black">Top recommended crops</h2>
                </div>
                <span className="text-xs font-bold text-slate-500">{recs.length} results</span>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Select a crop to create an AI-assisted accountability plan in Tasks. Selecting a crop
                does not change its suitability score.
              </p>

              <div className="mt-4 space-y-3">
                {recs.map((r, i) => {
                  const selected = selectedSlugs.has(r.crop.slug);
                  const busy = selecting === r.crop.slug;

                  return (
                    <article key={r.crop.slug} className="fc-card p-5">
                      <div className="flex items-start gap-4">
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${
                            i === 0
                              ? "bg-emerald-700 text-white"
                              : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          #{i + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-xl font-black">{r.crop.name}</h3>
                              <p className="mt-0.5 truncate text-xs italic text-slate-500">
                                {r.crop.scientificName}
                              </p>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-800">
                              {r.score}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <ul className="mt-4 space-y-2">
                        {r.reasons.slice(0, 5).map(reason => (
                          <li key={reason} className="flex gap-2 text-sm leading-6 text-slate-600">
                            <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                              <AppIcon name="check" className="h-3 w-3" />
                            </span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Link
                          href={`/crops/${r.crop.slug}`}
                          className="fc-btn fc-btn-secondary !min-h-11 !py-2 text-sm"
                        >
                          Crop guide
                        </Link>
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() => void toggleCrop(r)}
                          className={`fc-btn !min-h-11 !py-2 text-sm ${
                            selected ? "fc-btn-secondary" : "fc-btn-primary"
                          }`}
                        >
                          {selected && <AppIcon name="check" className="h-4 w-4" />}
                          {busy
                            ? "Please wait…"
                            : selected
                              ? `Selected ${r.crop.name}`
                              : `Select ${r.crop.name}`}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
