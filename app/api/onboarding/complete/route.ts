import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";

export async function POST() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(auth.user.id) },
      { $set: { onboardingCompleted: true, onboardedAt: new Date() } }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
