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
    const latest = await db
      .collection("recommendations")
      .findOne({ userId: auth.user.id }, { sort: { createdAt: -1 } });

    console.info("[FarmCompass][Recommendation] GET profile returned to client", {
      userId: auth.user.id,
      farmerSoilType: profile?.soilType ?? null,
      farmerPH: profile?.pH ?? null,
      kaegroSoilType: profile?.soilIntelligence?.soilType ?? null,
      kaegroPH: profile?.soilIntelligence?.pH ?? null,
      hasSoilIntelligence: Boolean(profile?.soilIntelligence),
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      recommendationsCount: Array.isArray(latest?.rankedCrops) ? latest.rankedCrops.length : 0
    });

    return NextResponse.json({
      profile,
      recommendations: latest?.rankedCrops || []
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;

  try {
    let profile = await getProfile(auth.user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "Add your farm details before generating a personalised recommendation." },
        { status: 409 }
      );
    }

    console.info("[FarmCompass][Recommendation] POST starting profile", {
      userId: auth.user.id,
      farmerSoilType: profile.soilType ?? null,
      farmerPH: profile.pH ?? null,
      kaegroSoilType: profile.soilIntelligence?.soilType ?? null,
      kaegroPH: profile.soilIntelligence?.pH ?? null,
      soilSchemaVersion: profile.soilIntelligence?.schemaVersion ?? null,
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
      averageRainfallMm: profile.averageRainfallMm ?? null,
      averageTemperatureC: profile.averageTemperatureC ?? null
    });

    const latitude = profile.latitude;
    const longitude = profile.longitude;

    if (latitude != null && longitude != null) {
      const needsClimate =
        profile.averageRainfallMm == null ||
        profile.averageTemperatureC == null ||
        !profile.climateBaseline;

      const needsSoil =
        !profile.soilIntelligence || profile.soilIntelligence.schemaVersion !== 2;

      console.info("[FarmCompass][Recommendation] Environmental refresh decision", {
        userId: auth.user.id,
        latitude,
        longitude,
        needsSoil,
        needsClimate
      });

      if (needsClimate || needsSoil) {
        const update: Partial<FarmProfile> = {
          updatedAt: new Date(),
          updatedBy: "FARMER"
        };

        // Kaegro is awaited before scoring. The returned SoilIntelligence is also
        // merged into the in-memory profile immediately so the recommendation
        // engine and the client response use the same soil values.
        if (needsSoil) {
          try {
            console.info("[FarmCompass][Kaegro] Recommendation awaiting soil response", {
              userId: auth.user.id,
              latitude,
              longitude
            });

            const soil = await getSoilIntelligence(latitude, longitude);

            console.info("[FarmCompass][Kaegro] Recommendation received soil response", {
              userId: auth.user.id,
              pH: soil.pH,
              soilType: soil.soilType,
              faoClassification: soil.faoClassification,
              providerLatitude: soil.latitude,
              providerLongitude: soil.longitude,
              fetchedAt: soil.fetchedAt
            });

            update.soilIntelligence = soil;
            profile = {
              ...profile,
              soilIntelligence: soil
            };

            console.info("[FarmCompass][Recommendation] In-memory profile updated with Kaegro", {
              userId: auth.user.id,
              kaegroPH: profile.soilIntelligence?.pH ?? null,
              kaegroSoilType: profile.soilIntelligence?.soilType ?? null
            });
          } catch (error) {
            console.error("[FarmCompass][Kaegro] Recommendation soil refresh failed", {
              userId: auth.user.id,
              latitude,
              longitude,
              errorName: error instanceof Error ? error.name : "UnknownError",
              errorMessage: error instanceof Error ? error.message : String(error)
            });
          }
        }

        if (needsClimate) {
          try {
            console.info("[FarmCompass][Climate] Recommendation awaiting climate baseline", {
              userId: auth.user.id,
              latitude,
              longitude
            });

            const climate = await getClimateBaseline(latitude, longitude);

            update.climateBaseline = climate;
            update.averageRainfallMm = climate.averageAnnualRainfallMm;
            update.averageTemperatureC = climate.averageTemperatureC;

            profile = {
              ...profile,
              climateBaseline: climate,
              averageRainfallMm: climate.averageAnnualRainfallMm,
              averageTemperatureC: climate.averageTemperatureC
            };

            console.info("[FarmCompass][Climate] Recommendation received climate baseline", {
              userId: auth.user.id,
              averageAnnualRainfallMm: climate.averageAnnualRainfallMm,
              averageTemperatureC: climate.averageTemperatureC
            });
          } catch (error) {
            console.error("[FarmCompass][Climate] Recommendation climate refresh failed", {
              userId: auth.user.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        // updatedAt and updatedBy are always present in `update`; persist only when
        // at least one external data source added real profile data.
        if (Object.keys(update).length > 2) {
          const db = await getDb();
          const persistenceResult = await db
            .collection<FarmProfile>("farmProfiles")
            .updateOne({ userId: auth.user.id }, { $set: update });

          console.info("[FarmCompass][Recommendation] Environmental profile persistence", {
            userId: auth.user.id,
            matchedCount: persistenceResult.matchedCount,
            modifiedCount: persistenceResult.modifiedCount,
            persistedSoil: Boolean(update.soilIntelligence),
            persistedClimate: Boolean(update.climateBaseline)
          });

          // Read the profile back from MongoDB after persistence. This guarantees
          // the object returned to RecommendationClient is the exact stored profile,
          // including Kaegro pH/soil type when the provider succeeded.
          const persistedProfile = await getProfile(auth.user.id);
          if (persistedProfile) {
            profile = persistedProfile;
          }

          console.info("[FarmCompass][Recommendation] Persisted profile reloaded", {
            userId: auth.user.id,
            farmerSoilType: profile.soilType ?? null,
            farmerPH: profile.pH ?? null,
            kaegroSoilType: profile.soilIntelligence?.soilType ?? null,
            kaegroPH: profile.soilIntelligence?.pH ?? null,
            hasSoilIntelligence: Boolean(profile.soilIntelligence),
            averageRainfallMm: profile.averageRainfallMm ?? null,
            averageTemperatureC: profile.averageTemperatureC ?? null
          });
        }
      }
    } else {
      console.info("[FarmCompass][Recommendation] No GPS coordinates; skipping external context refresh", {
        userId: auth.user.id,
        latitude: latitude ?? null,
        longitude: longitude ?? null
      });
    }

    console.info("[FarmCompass][Recommendation] Profile used for crop ranking", {
      userId: auth.user.id,
      effectiveFarmerSoilType: profile.soilType ?? null,
      effectiveFarmerPH: profile.pH ?? null,
      kaegroSoilType: profile.soilIntelligence?.soilType ?? null,
      kaegroPH: profile.soilIntelligence?.pH ?? null,
      irrigation: profile.irrigation,
      plantingMonth: profile.plantingMonth ?? null,
      averageRainfallMm: profile.averageRainfallMm ?? null,
      averageTemperatureC: profile.averageTemperatureC ?? null
    });

    const crops = await listCrops();
    const ranked = rankCrops(profile, crops, 5).map(result => ({
      crop: {
        slug: result.crop.slug,
        name: result.crop.name,
        scientificName: result.crop.scientificName,
        category: result.crop.category
      },
      score: result.score,
      reasons: result.reasons,
      components: result.components
    }));

    const db = await getDb();
    await db.collection("recommendations").insertOne({
      userId: auth.user.id,
      farmId: String(profile._id),
      rankedCrops: ranked,
      profileSnapshot: profile,
      createdAt: new Date()
    });

    console.info("[FarmCompass][Recommendation] POST response profile", {
      userId: auth.user.id,
      farmerSoilType: profile.soilType ?? null,
      farmerPH: profile.pH ?? null,
      kaegroSoilType: profile.soilIntelligence?.soilType ?? null,
      kaegroPH: profile.soilIntelligence?.pH ?? null,
      recommendationsCount: ranked.length
    });

    return NextResponse.json({
      profile,
      recommendations: ranked
    });
  } catch (error) {
    return serverError(error);
  }
}
