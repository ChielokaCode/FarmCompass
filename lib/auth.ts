import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import type { Role } from "@/types";

const COOKIE_NAME = "farmcompass_session";
const secretText = process.env.JWT_SECRET || "development-only-change-this-farmcompass-secret";
const secret = new TextEncoder().encode(secretText);

export type SessionUser = { id: string; name: string; email: string; role: Role };

export async function signSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.email || !payload.role || !payload.name) return null;
    return {
      id: payload.sub,
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role
    };
  } catch {
    return null;
  }
}

export async function requireUser(role?: Role) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  return user;
}
