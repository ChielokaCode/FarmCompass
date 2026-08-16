import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { archiveCropCycle, selectCropAndCreateTasks } from "@/lib/tasks";
import type { CropCycle } from "@/types";

export const maxDuration = 60;

export async function GET() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const db = await getDb();
    const cycles = await db.collection<CropCycle>("cropCycles")
      .find({ userId: auth.user.id, status: "ACTIVE" })
      .sort({ createdAt: -1 })
      .toArray();
    return NextResponse.json({
      cycles: cycles.map(cycle => ({
        id: String(cycle._id),
        cropSlug: cycle.cropSlug,
        cropName: cycle.cropName,
        recommendationScore: cycle.recommendationScore ?? null,
        startDate: cycle.startDate,
        projectedEndDate: cycle.projectedEndDate,
        durationDays: cycle.durationDays
      }))
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const cropSlug = typeof body.cropSlug === "string" ? body.cropSlug.trim() : "";
    const recommendationScore = typeof body.recommendationScore === "number" ? body.recommendationScore : null;
    if (!cropSlug) return NextResponse.json({ error: "Choose a crop first." }, { status: 400 });
    const result = await selectCropAndCreateTasks(auth.user.id, cropSlug, recommendationScore);
    return NextResponse.json(result, { status: result.alreadySelected ? 200 : 201 });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const cropSlug = searchParams.get("cropSlug")?.trim() || "";
    if (!cropSlug) return NextResponse.json({ error: "cropSlug is required." }, { status: 400 });
    return NextResponse.json(await archiveCropCycle(auth.user.id, cropSlug));
  } catch (error) {
    return serverError(error);
  }
}
