import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { Role } from "@/types";

export async function apiUser(role?: Role) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) } as const;
  if (role && user.role !== role) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { user } as const;
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
