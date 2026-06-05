import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  deleteBrandNotificationRule,
  fetchBrandNotificationRules,
  upsertBrandNotificationRule,
} from "@/lib/db/brand-igaming-repo";
import type { BrandNotificationRule } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ rules: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const rules = await fetchBrandNotificationRules(brandId);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandNotificationRule> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const eventType = String(body.eventType ?? "").trim();
  if (!eventType) return NextResponse.json({ error: "eventType gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bnr-"));
  const rule: BrandNotificationRule = {
    id: isNew ? `bnr-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    eventType,
    channel: body.channel ?? "in_app",
    enabled: body.enabled ?? true,
    threshold: body.threshold ?? {},
  };
  const saved = await upsertBrandNotificationRule(rule);
  return NextResponse.json({ rule: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await deleteBrandNotificationRule(id);
  return NextResponse.json({ ok: true });
}
