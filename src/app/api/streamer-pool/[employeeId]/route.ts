import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  findStreamerPoolProfileByEmployee,
  upsertStreamerPoolProfile,
} from "@/lib/db/repository";
import { normalizeProfileBody } from "@/lib/streamer-pool-shared";
import { writeDealAudit } from "@/lib/deal-access";
import type { StreamerPoolProfile } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canViewProfile(
  role: string,
  sessionEmployeeId: string | undefined,
  profile: StreamerPoolProfile | null,
  targetEmployeeId: string
): boolean {
  if (role === "admin" || role === "auditor") return true;
  if (role === "streamer") return sessionEmployeeId === targetEmployeeId;
  if (role === "brand") {
    if (!profile) return false;
    return profile.status === "published" && profile.visibility !== "invite_only";
  }
  return false;
}

/** GET /api/streamer-pool/[employeeId] — profil detayı. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ employeeId: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { employeeId } = await ctx.params;
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId gerekli" }, { status: 400 });
  }
  try {
    const profile = await findStreamerPoolProfileByEmployee(employeeId);
    if (!canViewProfile(session.role, session.employeeId, profile, employeeId)) {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profil yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/streamer-pool/[employeeId]
 * Admin tüm profilleri günceller, yayıncı sadece kendi profilini günceller.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ employeeId: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { employeeId } = await ctx.params;
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId gerekli" }, { status: 400 });
  }

  const canEdit =
    session.role === "admin" ||
    (session.role === "streamer" && session.employeeId === employeeId);
  if (!canEdit) {
    return NextResponse.json({ error: "Yazma yetkisi yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<StreamerPoolProfile> | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  try {
    const existing = await findStreamerPoolProfileByEmployee(employeeId);
    const profile = normalizeProfileBody(body, {
      employeeId,
      existing: existing ?? undefined,
    });
    if (!profile.displayName) {
      return NextResponse.json({ error: "displayName gerekli" }, { status: 400 });
    }
    const saved = await upsertStreamerPoolProfile(profile);
    await writeDealAudit(
      session,
      existing ? "streamer_pool_profile_updated" : "streamer_pool_profile_created",
      `profile=${saved.id} employee=${saved.employeeId} status=${saved.status} by=${session.role}`
    );
    return NextResponse.json({ profile: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profil kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
