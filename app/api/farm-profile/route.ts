import { NextResponse } from "next/server";
import { z } from "zod";
import type { WithId } from "mongodb";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { getClimateBaseline } from "@/lib/weather";
import { getSoilIntelligence } from "@/lib/soil";
import type { FarmProfile } from "@/types";

const optionalNumber = z.number().finite().nullable().optional();
const optionalText = z.string().trim().max(500).nullable().optional();

const schema = z.object({
  state: z.string().trim().min(2).max(60),
  lga: z.string().trim().min(2).max(100),
  farmSizeHa: optionalNumber.refine(v => v == null || v >= 0, "Farm size cannot be negative"),
  soilType: z.string().trim().max(80).nullable().optional(),
  pH: optionalNumber.refine(v => v == null || (v >= 3 && v <= 10), "Soil pH must be between 3 and 10"),
  irrigation: z.enum(["rainfed", "irrigated", "mixed", "unknown"]),
  farmingGoal: z.string().trim().max(100).nullable().optional(),
  plantingMonth: z.string().trim().max(20).nullable().optional(),
  latitude: optionalNumber.refine(v => v == null || (v >= -90 && v <= 90), "Latitude is invalid"),
  longitude: optionalNumber.refine(v => v == null || (v >= -180 && v <= 180), "Longitude is invalid"),
  locationAccuracyM: optionalNumber.refine(v => v == null || v >= 0, "Location accuracy is invalid"),
  notes: optionalText
}).superRefine((value, ctx) => {
  const hasLat = value.latitude != null;
  const hasLon = value.longitude != null;
  if (hasLat !== hasLon) {
    ctx.addIssue({ code: "custom", message: "Latitude and longitude must be saved together." });
  }
});

function serialise(profile: WithId<FarmProfile>) {
  return { ...profile, _id: String(profile._id) };
}

function coordinateChanged(existing: FarmProfile | null, latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) return existing?.latitude != null || existing?.longitude != null;
  if (existing?.latitude == null || existing?.longitude == null) return true;
  return Math.abs(existing.latitude - latitude) > 0.0001 || Math.abs(existing.longitude - longitude) > 0.0001;
}

export async function GET() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const db = await getDb();
    const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId: auth.user.id });
    return NextResponse.json({ profile: profile ? serialise(profile) : null });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const body = schema.parse(await req.json());
    const db = await getDb();
    const now = new Date();
    const collection = db.collection<FarmProfile>("farmProfiles");
    const existing = await collection.findOne({ userId: auth.user.id });
    const locationChanged = coordinateChanged(existing, body.latitude, body.longitude);

    let climateBaseline = existing?.climateBaseline ?? null;
    let averageRainfallMm = existing?.averageRainfallMm ?? null;
    let averageTemperatureC = existing?.averageTemperatureC ?? null;
    let soilIntelligence = existing?.soilIntelligence ?? null;
    let climateWarning = "";
    let soilWarning = "";

    if (body.latitude == null || body.longitude == null) {
      climateBaseline = null;
      averageRainfallMm = null;
      averageTemperatureC = null;
      soilIntelligence = null;
    } else {
      const needsClimate = locationChanged || !climateBaseline || averageRainfallMm == null || averageTemperatureC == null;
      const needsSoil = locationChanged || !soilIntelligence;
      const [climateResult, soilResult] = await Promise.allSettled([
        needsClimate ? getClimateBaseline(body.latitude, body.longitude) : Promise.resolve(climateBaseline),
        needsSoil ? getSoilIntelligence(body.latitude, body.longitude) : Promise.resolve(soilIntelligence)
      ]);

      if (needsClimate) {
        if (climateResult.status === "fulfilled" && climateResult.value) {
          climateBaseline = climateResult.value;
          averageRainfallMm = climateBaseline.averageAnnualRainfallMm;
          averageTemperatureC = climateBaseline.averageTemperatureC;
        } else {
          climateBaseline = null;
          averageRainfallMm = null;
          averageTemperatureC = null;
          const reason = climateResult.status === "rejected" ? climateResult.reason : null;
          climateWarning = reason instanceof Error
            ? `Climate averages could not be refreshed: ${reason.message}`
            : "Climate averages could not be refreshed.";
        }
      }

      if (needsSoil) {
        if (soilResult.status === "fulfilled" && soilResult.value) {
          soilIntelligence = soilResult.value;
        } else {
          soilIntelligence = null;
          const reason = soilResult.status === "rejected" ? soilResult.reason : null;
          soilWarning = reason instanceof Error
            ? `Soil data could not be refreshed: ${reason.message}`
            : "Soil data could not be refreshed.";
        }
      }
    }

    await collection.updateOne(
      { userId: auth.user.id },
      {
        $set: {
          ...body,
          userId: auth.user.id,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          locationAccuracyM: body.locationAccuracyM ?? null,
          locationCapturedAt: locationChanged && body.latitude != null && body.longitude != null
            ? now
            : existing?.locationCapturedAt ?? null,
          averageRainfallMm,
          averageTemperatureC,
          climateBaseline,
          soilIntelligence,
          updatedBy: "FARMER",
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    // Remove fields used by older administrator-managed FarmCompass builds.
    await db.collection("farmProfiles").updateOne(
      { userId: auth.user.id },
      { $unset: { createdByAdminId: "", updatedByAdminId: "", verifiedAt: "" } }
    );

    const profile = await collection.findOne({ userId: auth.user.id });
    return NextResponse.json({ ok: true, profile: profile ? serialise(profile) : null, climateWarning, soilWarning });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid farm profile" }, { status: 400 });
    }
    return serverError(error);
  }
}
