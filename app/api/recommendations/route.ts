import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { listCrops } from "@/lib/crops";
import { rankCrops } from "@/lib/recommendation";
import { getClimateBaseline } from "@/lib/weather";
import { getSoilIntelligence } from "@/lib/soil";
import type { FarmProfile } from "@/types";

export const maxDuration = 60;

async function getProfile(userId: string) {
  const db = await getDb();
  const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId });
  return profile ? { ...profile, _id: String(profile._id) } : null;
}

export async function GET() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const db = await getDb();
    const profile = await getProfile(auth.user.id);
    const latest = await db.collection("recommendations").findOne({ userId: auth.user.id }, { sort: { createdAt: -1 } });
    return NextResponse.json({ profile, recommendations: latest?.rankedCrops || [] });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    let profile = await getProfile(auth.user.id);
    if (!profile) return NextResponse.json({ error: "Add your farm details before generating a personalised recommendation." }, { status: 409 });

    const latitude = profile.latitude;
    const longitude = profile.longitude;

    if (latitude != null && longitude != null) {
      const needsClimate = profile.averageRainfallMm == null || profile.averageTemperatureC == null || !profile.climateBaseline;
      const needsSoil = !profile.soilIntelligence || profile.soilIntelligence.schemaVersion !== 2;
      if (needsClimate || needsSoil) {
        const update: Partial<FarmProfile> = { updatedAt: new Date(), updatedBy: "FARMER" };

        // Explicitly await Kaegro first so recommendation scoring cannot run
        // before the soil response has been fully received and mapped.
        if (needsSoil) {
          try {
            console.info("[FarmCompass][Kaegro] Recommendation waiting for Kaegro soil response", {
              userId: auth.user.id,
              latitude,
              longitude
            });
            const soil = await getSoilIntelligence(latitude, longitude);
            update.soilIntelligence = soil;
            profile = { ...profile, soilIntelligence: soil };
            console.info("[FarmCompass][Kaegro] Recommendation received Kaegro soil response", {
              userId: auth.user.id,
              pH: soil.pH,
              soilType: soil.soilType
            });
          } catch (error) {
            console.error("[FarmCompass][Kaegro] Recommendation soil refresh failed", {
              userId: auth.user.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        if (needsClimate) {
          try {
            const climate = await getClimateBaseline(latitude, longitude);
            update.climateBaseline = climate;
            update.averageRainfallMm = climate.averageAnnualRainfallMm;
            update.averageTemperatureC = climate.averageTemperatureC;
            profile = { ...profile, climateBaseline: climate, averageRainfallMm: climate.averageAnnualRainfallMm, averageTemperatureC: climate.averageTemperatureC };
          } catch (error) {
            console.error("[FarmCompass][Climate] Recommendation climate refresh failed", {
              userId: auth.user.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        if (Object.keys(update).length > 2) {
          const db = await getDb();
          await db.collection<FarmProfile>("farmProfiles").updateOne({ userId: auth.user.id }, { $set: update });
        }
      }
    }

    const crops = await listCrops();
    const ranked = rankCrops(profile, crops, 5).map(r => ({
      crop: { slug: r.crop.slug, name: r.crop.name, scientificName: r.crop.scientificName, category: r.crop.category },
      score: r.score,
      reasons: r.reasons,
      components: r.components
    }));

    const db = await getDb();
    await db.collection("recommendations").insertOne({
      userId: auth.user.id,
      farmId: String(profile._id),
      rankedCrops: ranked,
      profileSnapshot: profile,
      createdAt: new Date()
    });
    return NextResponse.json({ profile, recommendations: ranked });
  } catch (error) {
    return serverError(error);
  }
}
