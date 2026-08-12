import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { UserDoc } from "@/types";

export async function getUserDocById(userId: string) {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getDb();
  return db.collection<UserDoc>("users").findOne({ _id: new ObjectId(userId) });
}

export async function hasCompletedOnboarding(userId: string) {
  const user = await getUserDocById(userId);
  return user?.onboardingCompleted === true;
}
