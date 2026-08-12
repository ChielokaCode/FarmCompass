import type { CropRecord, FarmProfile, RecommendationResult } from "@/types";

const monthIndex: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function normalize(s?: string | null) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function numericRangeScore(value: number | null | undefined, range: { min: number | null; optimal: number | null; max: number | null }) {
  if (value == null || range.min == null || range.max == null) return null;
  if (value < range.min || value > range.max) return 0;
  if (range.optimal == null) return 1;
  const span = value <= range.optimal ? range.optimal - range.min : range.max - range.optimal;
  if (span <= 0) return 1;
  const distance = Math.abs(value - range.optimal);
  return Math.max(0.55, 1 - 0.45 * (distance / span));
}

function stateScore(profile: FarmProfile, crop: CropRecord) {
  if (!profile.state || !crop.suitableStates?.length) return null;
  return crop.suitableStates.some((s) => normalize(s) === normalize(profile.state)) ? 1 : 0.25;
}

function soilScore(profile: FarmProfile, crop: CropRecord) {
  if (!profile.soilType || !crop.soilTypes?.length) return null;
  const farm = normalize(profile.soilType);
  const hits = crop.soilTypes.map(normalize);
  if (hits.some((s) => s.includes(farm) || farm.includes(s))) return 1;
  const farmTokens = new Set(farm.split(" "));
  const overlap = hits.some((s) => s.split(" ").some((t) => farmTokens.has(t) && t.length > 3));
  return overlap ? 0.65 : 0.2;
}

function irrigationScore(profile: FarmProfile, crop: CropRecord) {
  if (!profile.irrigation || profile.irrigation === "unknown" || !crop.irrigation) return null;
  const text = normalize(crop.irrigation + " " + crop.rawSource.slice(0, 5000));
  if (profile.irrigation === "rainfed") return text.includes("rainfed") ? 1 : 0.55;
  if (profile.irrigation === "irrigated") {
    return /(irrigat|drip|sprinkler|flood|supplemental)/.test(text) ? 1 : 0.4;
  }
  if (profile.irrigation === "mixed") return /(rainfed|irrigat|supplemental)/.test(text) ? 0.9 : 0.5;
  return null;
}

function monthScore(month: string | null | undefined, plantingSeason: string) {
  if (!month || !plantingSeason) return null;
  const m = monthIndex[normalize(month)];
  if (!m) return null;
  const text = normalize(plantingSeason);
  if (/year round|all year|perennial/.test(text)) return 1;
  const rangeRegex = /(january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:to|-|–)\s*(january|february|march|april|may|june|july|august|september|october|november|december)/g;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(text))) {
    const a = monthIndex[match[1]], b = monthIndex[match[2]];
    const inside = a <= b ? m >= a && m <= b : m >= a || m <= b;
    if (inside) return 1;
  }
  const monthName = Object.keys(monthIndex).find((k) => monthIndex[k] === m)!;
  if (text.includes(monthName)) return 1;
  if (/rainy season|wet season/.test(text)) return 0.7;
  if (/dry season/.test(text) && profileMonthDrySeason(monthName)) return 0.8;
  return 0.35;
}

function profileMonthDrySeason(month: string) {
  return ["november", "december", "january", "february", "march"].includes(month);
}

function goalScore(goal: string | null | undefined, crop: CropRecord) {
  if (!goal) return null;
  const g = normalize(goal);
  const hay = normalize([crop.category, crop.growthDuration, crop.rawSource.slice(0, 3000)].join(" "));
  if (g.includes("food") && hay.includes("food crop")) return 1;
  if (g.includes("cash") && hay.includes("cash crop")) return 1;
  if (g.includes("vegetable") && hay.includes("vegetable")) return 1;
  if (g.includes("fruit") && hay.includes("fruit")) return 1;
  if (g.includes("perennial") && /(perennial|years)/.test(hay)) return 1;
  if (g.includes("short") && /(days|week)/.test(hay)) return 0.9;
  return 0.5;
}

export function scoreCrop(profile: FarmProfile, crop: CropRecord): RecommendationResult {
  const components: Record<string, number | null> = {
    state: stateScore(profile, crop),
    soil: soilScore(profile, crop),
    pH: numericRangeScore(profile.pH, crop.pH),
    water: irrigationScore(profile, crop),
    rainfall: numericRangeScore(profile.averageRainfallMm, crop.rainfallMm),
    temperature: numericRangeScore(profile.averageTemperatureC, crop.temperatureC),
    season: monthScore(profile.plantingMonth, crop.plantingSeason),
    goal: goalScore(profile.farmingGoal, crop)
  };

  const weights: Record<string, number> = {
    state: 25, soil: 12.5, pH: 12.5, water: 20, rainfall: 10, temperature: 5, season: 10, goal: 5
  };

  let weighted = 0;
  let available = 0;
  for (const [key, val] of Object.entries(components)) {
    if (val == null) continue;
    weighted += val * weights[key];
    available += weights[key];
  }
  const score = available ? (weighted / available) * 100 : 0;
  const reasons: string[] = [];
  if ((components.state ?? 0) >= 0.95) reasons.push(`${crop.name} is listed for ${profile.state}.`);
  if ((components.soil ?? 0) >= 0.65 && profile.soilType) reasons.push(`Its soil guidance is compatible with ${profile.soilType}.`);
  if ((components.pH ?? 0) >= 0.55 && profile.pH != null) reasons.push(`Farm pH ${profile.pH} falls within the crop's documented pH range.`);
  if ((components.water ?? 0) >= 0.8) reasons.push(`The crop's water-management guidance fits a ${profile.irrigation} farm context.`);
  if ((components.season ?? 0) >= 0.7 && profile.plantingMonth) reasons.push(`${profile.plantingMonth} aligns with the documented planting guidance.`);
  if ((components.goal ?? 0) >= 0.9 && profile.farmingGoal) reasons.push(`The crop aligns with the stated goal: ${profile.farmingGoal}.`);
  if (!reasons.length) reasons.push("The crop remains a candidate based on the farm information currently available.");

  return { crop, score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4), components };
}

export function rankCrops(profile: FarmProfile, crops: CropRecord[], limit = 5) {
  return crops
    .filter((c) => c.active !== false)
    .map((crop) => scoreCrop(profile, crop))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
