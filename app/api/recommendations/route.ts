import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { listCrops } from "@/lib/crops";
import { rankCrops } from "@/lib/recommendation";
import type { FarmProfile } from "@/types";

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
    const profile = await getProfile(auth.user.id);
    if (!profile) return NextResponse.json({ error: "Add your farm details before generating a personalised recommendation." }, { status: 409 });

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
