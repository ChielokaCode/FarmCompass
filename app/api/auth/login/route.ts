import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { signSession } from "@/lib/auth";
import type { UserDoc } from "@/types";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    const db = await getDb();
    const doc = await db.collection<UserDoc>("users").findOne({ email: data.email.toLowerCase() });
    if (!doc || !(await bcrypt.compare(data.password, doc.passwordHash))) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const user = { id: String(doc._id), name: doc.name, email: doc.email, role: doc.role };
    await signSession(user);
    return NextResponse.json({ user: { ...user, onboardingCompleted: doc.onboardingCompleted === true } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to sign in" }, { status: 400 });
  }
}
