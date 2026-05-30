import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/store/auth";
import { getSessionSecret } from "@/lib/env";

const COOKIE = "lanetkel_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  username: string;
  name: string;
  role: Role;
  employeeId?: string;
  /** Aktif/birincil marka (geri uyum). */
  brandId?: string;
  avatar: string;
  /** Multi-tenant (Faz 0): bağlı olduğu organizasyon. */
  organizationId?: string;
  /** Org içindeki rol (owner/admin/finance/marketing/hr/viewer). */
  orgRole?: string;
  /** Erişebildiği tüm marka id'leri (scope_all_brands ise org'un tüm markaları). */
  brandIds?: string[];
}

function secretKey() {
  return new TextEncoder().encode(getSessionSecret());
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const p = payload as Record<string, unknown>;
    if (typeof p.userId !== "string" || typeof p.role !== "string") return null;
    return {
      userId: p.userId,
      username: String(p.username ?? ""),
      name: String(p.name ?? ""),
      role: p.role as Role,
      employeeId: typeof p.employeeId === "string" ? p.employeeId : undefined,
      brandId: typeof p.brandId === "string" ? p.brandId : undefined,
      avatar: String(p.avatar ?? ""),
      organizationId: typeof p.organizationId === "string" ? p.organizationId : undefined,
      orgRole: typeof p.orgRole === "string" ? p.orgRole : undefined,
      brandIds: Array.isArray(p.brandIds) ? (p.brandIds as unknown[]).map(String) : undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
