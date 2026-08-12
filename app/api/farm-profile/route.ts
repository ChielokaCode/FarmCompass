import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
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
  averageRainfallMm: optionalNumber.refine(v => v == null || v >= 0, "Rainfall cannot be negative"),
  averageTemperatureC: optionalNumber.refine(v => v == null || (v >= -10 && v <= 60), "Temperature is outside the accepted range"),
  notes: optionalText
});

function serialise(profile: FarmProfile & { _id?: unknown }) {
  return { ...profile, _id: profile._id ? String(profile._id) : undefined };
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

    await db.collection<FarmProfile>("farmProfiles").updateOne(
      { userId: auth.user.id },
      {
        $set: {
          ...body,
          userId: auth.user.id,
          updatedBy: "FARMER",
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    // Remove legacy administrator-managed fields if this database was seeded by an older FarmCompass build.
    await db.collection("farmProfiles").updateOne(
      { userId: auth.user.id },
      { $unset: { createdByAdminId: "", updatedByAdminId: "", verifiedAt: "" } }
    );

    const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId: auth.user.id });
    return NextResponse.json({ ok: true, profile: profile ? serialise(profile) : null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid farm profile" }, { status: 400 });
    }
    return serverError(error);
  }
}
