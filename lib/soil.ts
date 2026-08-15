import type { FarmProfile, SoilIntelligence } from "@/types";

const KAEGRO_ENDPOINT = "https://www.kaegro.com/farms/api/soil";
const KAEGRO_TIMEOUT_MS = 45_000;

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

/**
 * Fetch Kaegro soil data for a farm coordinate.
 *
 * Important: this function deliberately awaits the HTTP response AND awaits
 * the complete JSON body before the Kaegro response schema is read. Nothing
 * is mapped into FarmCompass SoilIntelligence until the provider payload has
 * been fully received.
 */
export async function getSoilIntelligence(latitude: number, longitude: number): Promise<SoilIntelligence> {
  const url = new URL(KAEGRO_ENDPOINT);
  // Send ordinary decimal coordinates, matching the working Postman request.
  url.searchParams.set("lat", latitude.toFixed(6));
  url.searchParams.set("lon", longitude.toFixed(6));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KAEGRO_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    console.info("[FarmCompass][Kaegro] Request prepared", {
      method: "GET",
      url: url.toString(),
      latitude,
      longitude,
      timeoutMs: KAEGRO_TIMEOUT_MS
    });

    console.info("[FarmCompass][Kaegro] Awaiting Kaegro HTTP response...");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "FarmCompass/1.0"
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    console.info("[FarmCompass][Kaegro] HTTP response received", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      redirected: response.redirected,
      finalUrl: response.url,
      elapsedMs: Date.now() - startedAt
    });

    if (!response.ok) {
      // Wait for the provider response body before throwing so the logs show
      // the useful server error returned by Kaegro.
      const errorBody = await response.text();
      const preview = errorBody.slice(0, 500).replace(/\s+/g, " ");
      console.error("[FarmCompass][Kaegro] Non-success response body", preview);
      throw new Error(`Kaegro soil service returned ${response.status}${preview ? `: ${preview}` : "."}`);
    }

    console.info("[FarmCompass][Kaegro] Awaiting complete JSON body...");

    // This await is intentional: do not inspect or map the Kaegro response
    // until the full JSON body has been received and decoded.
    const rawPayload: unknown = await response.json();

    console.info("[FarmCompass][Kaegro] Complete JSON body received", {
      elapsedMs: Date.now() - startedAt,
      payload: rawPayload
    });

    // Only now do we apply/read the known Kaegro response schema.
    const data = requireObject(rawPayload);

    console.info("[FarmCompass][Kaegro] Applying Kaegro response schema", {
      topLevelKeys: Object.keys(data),
      hasLocation: Boolean(data.location),
      hasSoilType: Boolean(data.soil_type),
      hasPhysical: Boolean(data.physical),
      hasChemical: Boolean(data.chemical),
      hasWater: Boolean(data.water),
      hasMeta: Boolean(data._meta)
    });

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

    // pH and texture are the two core fields FarmCompass expects from Kaegro.
    // Fail loudly instead of silently storing an empty soil object.
    if (pH == null && !soilType) {
      throw new Error("Kaegro returned JSON, but neither chemical.ph_h2o nor soil_type.texture_class was present.");
    }

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

    const soilIntelligence: SoilIntelligence = {
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

    console.info("[FarmCompass][Kaegro] Soil intelligence ready for persistence", {
      providerLatitude: soilIntelligence.latitude,
      providerLongitude: soilIntelligence.longitude,
      pH: soilIntelligence.pH,
      soilType: soilIntelligence.soilType,
      faoClassification: soilIntelligence.faoClassification,
      sandPercent: soilIntelligence.physical.sandPercent,
      siltPercent: soilIntelligence.physical.siltPercent,
      clayPercent: soilIntelligence.physical.clayPercent,
      bulkDensityGcm3: soilIntelligence.physical.bulkDensityGcm3,
      organicMatterPercent: soilIntelligence.chemical.organicMatterPercent,
      nitrogenGKg: soilIntelligence.chemical.nitrogenGKg,
      cecCmolKg: soilIntelligence.chemical.cecCmolKg,
      fieldCapacityVolPercent: soilIntelligence.water.fieldCapacityVolPercent,
      wiltingPointVolPercent: soilIntelligence.water.wiltingPointVolPercent,
      providerLatencySeconds: soilIntelligence.providerLatencySeconds,
      totalElapsedMs: Date.now() - startedAt
    });

    return soilIntelligence;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[FarmCompass][Kaegro] Soil lookup timed out", {
        url: url.toString(),
        latitude,
        longitude,
        timeoutMs: KAEGRO_TIMEOUT_MS,
        elapsedMs: Date.now() - startedAt
      });
      throw new Error(`Kaegro soil service did not respond within ${KAEGRO_TIMEOUT_MS / 1000} seconds.`);
    }

    console.error("[FarmCompass][Kaegro] Soil lookup failed", {
      url: url.toString(),
      latitude,
      longitude,
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
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
