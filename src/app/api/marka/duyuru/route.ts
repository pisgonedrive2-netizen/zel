import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess,
  resolveBrandId,
  accessibleBrandIds,
  hasOrgCapability,
  writeAudit,
} from "@/lib/org-access";
import {
  fetchBrandAnnouncements,
  upsertBrandAnnouncement,
  deleteBrandAnnouncement,
} from "@/lib/db/brand-personnel-repo";
import type {
  AnnouncementAudience,
  AnnouncementLevel,
  BrandStaffAnnouncement,
} from "@/types/brand-personnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIENCE: readonly AnnouncementAudience[] = ["all", "department", "staff"];
const LEVEL: readonly AnnouncementLevel[] = ["info", "warning", "urgent"];
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ announcements: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const ids =
    session.role === "brand"
      ? requested ? [requested] : accessibleBrandIds(session)
      : requested ? [requested] : [];
  try {
    const announcements = await fetchBrandAnnouncements(ids);
    return NextResponse.json({ announcements });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Duyurular alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Duyuru yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });

  const audience = pick(body.audience, AUDIENCE, "all");
  const isNew = !(typeof body.id === "string" && /^ann-/.test(body.id));
  const announcement: BrandStaffAnnouncement = {
    id: isNew ? `ann-${crypto.randomUUID().slice(0, 12)}` : String(body.id),
    brandId,
    title,
    body: String(body.body ?? ""),
    audience,
    departmentId: audience === "department" ? (String(body.departmentId ?? "").trim() || undefined) : undefined,
    staffId: audience === "staff" ? (String(body.staffId ?? "").trim() || undefined) : undefined,
    level: pick(body.level, LEVEL, "info"),
    pinned: Boolean(body.pinned),
    createdBy: session.userId,
    createdByName: session.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = await upsertBrandAnnouncement(announcement);
    await writeAudit(session, isNew ? "brand_announcement_created" : "brand_announcement_updated", `id=${saved.id} brand=${brandId}`);
    return NextResponse.json({ announcement: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Duyuru kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Silme yetkisi yok" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    await deleteBrandAnnouncement(id);
    await writeAudit(session, "brand_announcement_deleted", `id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
