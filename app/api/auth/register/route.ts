import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { signSession } from "@/lib/auth";
import type { UserDoc } from "@/types";

const schema = z.object({ name: z.string().min(2).max(80), email: z.string().email(), phone: z.string().max(30).optional(), password: z.string().min(8).max(128) });
export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    const db = await getDb();
    const email = data.email.toLowerCase();
    const users = db.collection<UserDoc>("users");
    if (await users.findOne({ email })) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const doc: UserDoc = { name: data.name.trim(), email, phone: data.phone?.trim(), passwordHash: await bcrypt.hash(data.password, 12), role: "FARMER", onboardingCompleted: false, createdAt: new Date() };
    const r = await users.insertOne(doc);
    const user = { id: String(r.insertedId), name: doc.name, email: doc.email, role: doc.role };
    await signSession(user);
    return NextResponse.json({ user: { ...user, onboardingCompleted: false } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to register" }, { status: 400 });
  }
}
