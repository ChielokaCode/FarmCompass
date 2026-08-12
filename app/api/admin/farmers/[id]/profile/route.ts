import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import type { FarmProfile } from "@/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("ADMIN");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid farmer id" }, { status: 400 });

    const db = await getDb();
    const farmer = await db.collection("users").findOne({ _id: new ObjectId(id), role: "FARMER" });
    if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

    const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId: id });
    return NextResponse.json({ profile: profile ? { ...profile, _id: String(profile._id) } : null });
  } catch (error) {
    return serverError(error);
  }
}
