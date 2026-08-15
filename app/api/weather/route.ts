import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { getClimateBaseline, getFarmWeatherForecast } from "@/lib/weather";
import type { FarmProfile } from "@/types";

async function getProfile(userId: string) {
  const db = await getDb();
  return db.collection<FarmProfile>("farmProfiles").findOne({ userId });
}

export async function GET() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const profile = await getProfile(auth.user.id);
    if (!profile) return NextResponse.json({ error: "Add your farm details before using farm weather." }, { status: 409 });
    if (profile.latitude == null || profile.longitude == null) {
      return NextResponse.json({ error: "Add your farm location in My Farm to enable climate and weather features.", needsLocation: true }, { status: 409 });
    }

    const forecast = await getFarmWeatherForecast(profile.latitude, profile.longitude);
    return NextResponse.json({
      farm: { state: profile.state, lga: profile.lga, latitude: profile.latitude, longitude: profile.longitude },
      climate: profile.climateBaseline || null,
      forecast
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const db = await getDb();
    const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId: auth.user.id });
    if (!profile) return NextResponse.json({ error: "Add your farm details first." }, { status: 409 });
    if (profile.latitude == null || profile.longitude == null) {
      return NextResponse.json({ error: "Add your farm location before refreshing climate data.", needsLocation: true }, { status: 409 });
    }

    const climate = await getClimateBaseline(profile.latitude, profile.longitude);
    await db.collection<FarmProfile>("farmProfiles").updateOne(
      { userId: auth.user.id },
      {
        $set: {
          climateBaseline: climate,
          averageRainfallMm: climate.averageAnnualRainfallMm,
          averageTemperatureC: climate.averageTemperatureC,
          updatedAt: new Date(),
          updatedBy: "FARMER"
        }
      }
    );
    return NextResponse.json({ ok: true, climate });
  } catch (error) {
    return serverError(error);
  }
}
