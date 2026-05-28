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

/** GET /api/streamer-pool/me — streamer kendi havuz profili. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (session.role !== "streamer" || !session.employeeId) {
    return NextResponse.json({ error: "Sadece yayıncılar erişebilir" }, { status: 403 });
  }
  try {
    const profile = await findStreamerPoolProfileByEmployee(session.employeeId);
    return NextResponse.json({ profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profil yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT /api/streamer-pool/me — yayıncı kendi profilini oluşturur veya günceller. */
export async function PUT(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (session.role !== "streamer" || !session.employeeId) {
    return NextResponse.json({ error: "Sadece yayıncılar erişebilir" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<StreamerPoolProfile> | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  try {
    const existing = await findStreamerPoolProfileByEmployee(session.employeeId);
    const profile = normalizeProfileBody(body, {
      employeeId: session.employeeId,
      existing: existing ?? undefined,
    });
    if (!profile.displayName) {
      return NextResponse.json({ error: "displayName gerekli" }, { status: 400 });
    }
    const saved = await upsertStreamerPoolProfile(profile);
    await writeDealAudit(
      session,
      existing ? "streamer_pool_profile_updated" : "streamer_pool_profile_created",
      `profile=${saved.id} employee=${saved.employeeId} status=${saved.status}`
    );
    return NextResponse.json({ profile: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profil kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
