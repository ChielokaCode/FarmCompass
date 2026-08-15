import type { FarmProfile, SoilIntelligence } from "@/types";

const KAEGRO_ENDPOINT = "https://www.kaegro.com/farms/api/soil";
const KAEGRO_TIMEOUT_MS = 30_000;

type KaegroSoilResponse = {
  location?: {
    lat?: unknown;
    lon?: unknown;
  };
  soil_type?: {
    texture_class?: unknown;
    fao_classification?: unknown;
  };
  physical?: {
    sand_pct?: unknown;
    silt_pct?: unknown;
    clay_pct?: unknown;
    bulk_density_g_cm3?: unknown;
  };
  chemical?: {
    ph_h2o?: unknown;
    organic_matter_pct?: unknown;
    nitrogen_g_kg?: unknown;
    cec_cmol_kg?: unknown;
  };
  water?: {
    capacity_field_vol_pct?: unknown;
    capacity_wilt_vol_pct?: unknown;
  };
  _meta?: {
    latency_seconds?: unknown;
  };
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireObject(value: unknown): KaegroSoilResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Kaegro soil service returned an unexpected response format.");
  }
  return value as KaegroSoilResponse;
}

export async function getSoilIntelligence(latitude: number, longitude: number): Promise<SoilIntelligence> {
  const url = new URL(KAEGRO_ENDPOINT);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KAEGRO_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    console.info("[FarmCompass][Kaegro] Soil lookup started");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    console.info("[FarmCompass][Kaegro] Soil lookup response", {
      status: response.status,
      ok: response.ok,
      contentType,
      elapsedMs: Date.now() - startedAt
    });

    if (!response.ok) {
      const preview = (await response.text()).slice(0, 240).replace(/\s+/g, " ");
      throw new Error(`Kaegro soil service returned ${response.status}${preview ? `: ${preview}` : "."}`);
    }

    if (!contentType.toLowerCase().includes("application/json")) {
      const preview = (await response.text()).slice(0, 240).replace(/\s+/g, " ");
      throw new Error(`Kaegro soil service returned a non-JSON response${preview ? `: ${preview}` : "."}`);
    }

    const data = requireObject(await response.json());

    // Exact field mapping from the Kaegro /farms/api/soil response.
    const pH = finiteNumber(data.chemical?.ph_h2o);
    const soilType = text(data.soil_type?.texture_class);
    const faoClassification = text(data.soil_type?.fao_classification);

    const physical = {
      sandPercent: finiteNumber(data.physical?.sand_pct),
      siltPercent: finiteNumber(data.physical?.silt_pct),
      clayPercent: finiteNumber(data.physical?.clay_pct),
      bulkDensityGcm3: finiteNumber(data.physical?.bulk_density_g_cm3)
    };

    const chemical = {
      pHH2O: pH,
      organicMatterPercent: finiteNumber(data.chemical?.organic_matter_pct),
      nitrogenGKg: finiteNumber(data.chemical?.nitrogen_g_kg),
      cecCmolKg: finiteNumber(data.chemical?.cec_cmol_kg)
    };

    const water = {
      fieldCapacityVolPercent: finiteNumber(data.water?.capacity_field_vol_pct),
      wiltingPointVolPercent: finiteNumber(data.water?.capacity_wilt_vol_pct)
    };

    const providerLatitude = finiteNumber(data.location?.lat);
    const providerLongitude = finiteNumber(data.location?.lon);
    const providerLatencySeconds = finiteNumber(data._meta?.latency_seconds);

    const attributes: Record<string, string | number | boolean | null> = {
      "Texture class": soilType,
      "FAO classification": faoClassification,
      "Sand (%)": physical.sandPercent,
      "Silt (%)": physical.siltPercent,
      "Clay (%)": physical.clayPercent,
      "Bulk density (g/cm³)": physical.bulkDensityGcm3,
      "pH (H₂O)": pH,
      "Organic matter (%)": chemical.organicMatterPercent,
      "Nitrogen (g/kg)": chemical.nitrogenGKg,
      "CEC (cmol/kg)": chemical.cecCmolKg,
      "Field capacity (vol %)": water.fieldCapacityVolPercent,
      "Wilting point (vol %)": water.wiltingPointVolPercent
    };

    console.info("[FarmCompass][Kaegro] Soil lookup parsed", {
      pH,
      soilType,
      faoClassification,
      providerLatencySeconds,
      elapsedMs: Date.now() - startedAt
    });

    return {
      schemaVersion: 2,
      source: "Kaegro Soil API",
      endpoint: KAEGRO_ENDPOINT,
      latitude: providerLatitude ?? latitude,
      longitude: providerLongitude ?? longitude,
      pH,
      soilType,
      faoClassification,
      physical,
      chemical,
      water,
      providerLatencySeconds,
      attributes,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[FarmCompass][Kaegro] Soil lookup timed out", { elapsedMs: Date.now() - startedAt });
      throw new Error(`Kaegro soil service did not respond within ${KAEGRO_TIMEOUT_MS / 1000} seconds.`);
    }
    console.error("[FarmCompass][Kaegro] Soil lookup failed", error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
