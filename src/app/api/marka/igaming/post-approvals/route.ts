import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId, hasOrgCapability, writeAudit } from "@/lib/org-access";
import {
  fetchBrandContentViolations,
  fetchBrandPostApprovals,
  upsertBrandPostApproval,
  upsertBrandContentViolation,
  clearPostViolations,
} from "@/lib/db/brand-igaming-repo";
import { scanPostCompliance } from "@/lib/content-compliance-scan";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BrandPostApproval } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ approvals: [], violations: [] });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  try {
    const [approvals, violations] = await Promise.all([
      fetchBrandPostApprovals(brandId),
      fetchBrandContentViolations(brandId),
    ]);
    return NextResponse.json({ approvals, violations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onay verisi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yok" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "crm") && session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });

  const requested = String(body.brandId ?? "").trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested) ?? "";
  const postId = String(body.postId ?? "").trim();
  if (!brandId || !postId) return NextResponse.json({ error: "brandId ve postId gerekli" }, { status: 400 });

  if (body.action === "scan") {
    const { data: post } = await getSupabaseAdmin()
      .from("brand_posts")
      .select("caption, url")
      .eq("id", postId)
      .maybeSingle();
    const caption = String((post as Record<string, unknown> | null)?.caption ?? "");
    const url = String((post as Record<string, unknown> | null)?.url ?? "");
    const scan = scanPostCompliance(caption, url);
    await clearPostViolations(brandId, postId);
    for (const v of scan.violations) {
      await upsertBrandContentViolation({
        id: `bcv-${crypto.randomUUID().slice(0, 12)}`,
        brandId,
        postId,
        violationType: v.type,
        severity: v.severity,
        notes: v.message,
      });
    }
    if (scan.violations.length === 0) {
      await upsertBrandPostApproval({
        id: `bpa-${postId}`,
        brandId,
        postId,
        status: "approved",
        reviewedBy: session.userId,
        reviewedAt: new Date().toISOString(),
        notes: "Otomatik tarama — uyarı yok",
      });
    }
    return NextResponse.json({ scan, violations: scan.violations });
  }

  const status = String(body.status ?? "pending") as BrandPostApproval["status"];
  if (!["pending", "approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Geçersiz status" }, { status: 400 });
  }

  const approval: BrandPostApproval = {
    id: typeof body.id === "string" && body.id ? body.id : `bpa-${postId}`,
    brandId,
    postId,
    status,
    reviewedBy: session.userId,
    reviewedAt: new Date().toISOString(),
    notes: String(body.notes ?? ""),
  };

  try {
    const saved = await upsertBrandPostApproval(approval);
    await writeAudit(session, `post_approval_${status}`, `post=${postId}`);
    return NextResponse.json({ approval: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kayıt başarısız" }, { status: 500 });
  }
}
