import type { FarmProfile, SoilIntelligence } from "@/types";

const KAegro_ENDPOINT = "https://www.kaegro.com/farms/api/soil";

type Scalar = string | number | boolean | null;
type FlatScalar = { path: string; key: string; value: Scalar };

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function flattenScalars(value: unknown, prefix = "", out: FlatScalar[] = [], depth = 0): FlatScalar[] {
  if (depth > 6 || out.length >= 80) return out;
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix) {
      const parts = prefix.split(".");
      out.push({ path: prefix, key: parts[parts.length - 1] || prefix, value: value as Scalar });
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.slice(0, 12).forEach((item, index) => flattenScalars(item, prefix ? `${prefix}.${index}` : String(index), out, depth + 1));
    return out;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      flattenScalars(item, prefix ? `${prefix}.${key}` : key, out, depth + 1);
      if (out.length >= 80) break;
    }
  }
  return out;
}

function asNumber(value: Scalar): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asText(value: Scalar): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= 160 ? text : null;
}

function findNumber(items: FlatScalar[], aliases: string[], range?: [number, number]) {
  const normalizedAliases = aliases.map(normalizeKey);
  const ranked = items
    .map(item => {
      const key = normalizeKey(item.key);
      const path = normalizeKey(item.path);
      const exact = normalizedAliases.some(alias => key === alias);
      const pathHit = normalizedAliases.some(alias => alias.length >= 4 && path.includes(alias));
      return { item, score: exact ? 2 : pathHit ? 1 : 0 };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { item } of ranked) {
    const number = asNumber(item.value);
    if (number == null) continue;
    if (range && (number < range[0] || number > range[1])) continue;
    return number;
  }
  return null;
}

function findText(items: FlatScalar[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);
  const ranked = items
    .map(item => {
      const key = normalizeKey(item.key);
      const path = normalizeKey(item.path);
      const exact = normalizedAliases.some(alias => key === alias);
      const pathHit = normalizedAliases.some(alias => alias.length >= 3 && path.includes(alias));
      return { item, score: exact ? 2 : pathHit ? 1 : 0 };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { item } of ranked) {
    const text = asText(item.value);
    if (text) return text;
  }
  return null;
}

function readableLabel(path: string) {
  const leaf = path.split(".").filter(part => !/^\d+$/.test(part)).pop() || path;
  return leaf
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function collectAttributes(items: FlatScalar[]) {
  const ignored = new Set(["lat", "latitude", "lon", "lng", "longitude"]);
  const attributes: Record<string, string | number | boolean | null> = {};
  for (const item of items) {
    const key = normalizeKey(item.key);
    if (ignored.has(key)) continue;
    if (item.value == null || typeof item.value === "object") continue;
    const label = readableLabel(item.path);
    if (!(label in attributes)) attributes[label] = item.value;
    if (Object.keys(attributes).length >= 24) break;
  }
  return attributes;
}

export async function getSoilIntelligence(latitude: number, longitude: number): Promise<SoilIntelligence> {
  const url = new URL(KAegro_ENDPOINT);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "FarmCompass/1.0" },
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Kaegro soil service returned ${response.status}.`);
  }
  const data: unknown = await response.json();
  const flat = flattenScalars(data);

  const pH = findNumber(flat, ["ph", "soil_ph", "soilph", "phh2o", "ph_water", "phvalue"], [0, 14]);
  const soilType = findText(flat, ["soil_type", "soiltype", "texture_class", "textureclass", "soil_texture", "texture", "classification"]);

  return {
    source: "Kaegro Soil API",
    endpoint: KAegro_ENDPOINT,
    latitude,
    longitude,
    pH,
    soilType,
    attributes: collectAttributes(flat),
    fetchedAt: new Date().toISOString()
  };
}

export function effectiveSoilPH(profile: FarmProfile) {
  return profile.pH ?? profile.soilIntelligence?.pH ?? null;
}

export function effectiveSoilType(profile: FarmProfile) {
  return profile.soilType || profile.soilIntelligence?.soilType || null;
}

export function soilPHSource(profile: FarmProfile) {
  if (profile.pH != null) return "farmer-provided measured value";
  if (profile.soilIntelligence?.pH != null) return "Kaegro location-based estimate";
  return null;
}
