import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { refreshAllLinksBulk } from "@/lib/social-api/refresh-runner";
import {
  startBulkRefreshJob,
  finishBulkRefreshJob,
  failBulkRefreshJob,
} from "@/lib/social-api/bulk-job-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/refresh-all-links
 *
 * Toplu yenileme. İstek arka planda devam eder; UI `/api/admin/refresh-progress`
 * ile durumu poll eder. Sunucu yine de sync sonucu (özet) döndürür.
 *
 * Body (opsiyonel):
 *   - brandId?: string         — yalnızca bu markaya ait linkler
 *   - failedOnly?: boolean     — sadece son denemede hatalı / yenilenmemiş linkler
 *   - linkIds?: string[]       — verilen ID set'i (priority)
 *   - targetDate?: string      — YYYY-MM-DD (geçmiş ay snapshot tarihi)
 *   - jobId?: string           — UI poll için aynı id
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled() || !isRapidApiEnabled()) {
    return NextResponse.json(
      { ok: false, error: "RapidAPI veya Supabase yapılandırılmamış" },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  if (session.role !== "admin" && session.role !== "auditor") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici / denetçi" }, { status: 403 });
  }

  let body: {
    brandId?: string;
    failedOnly?: boolean;
    linkIds?: string[];
    targetDate?: string;
    jobId?: string;
  } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  const jobId = body.jobId || `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  startBulkRefreshJob(jobId, {
    mode: body.failedOnly ? "failed-only" : body.linkIds ? "selected" : "all",
    brandId: body.brandId,
    targetDate: body.targetDate,
    userId: session.userId,
  });

  try {
    const summary = await refreshAllLinksBulk({
      userId: session.userId,
      brandId: body.brandId,
      failedOnly: body.failedOnly,
      linkIds: body.linkIds,
      targetDate: body.targetDate,
      jobId,
    });
    finishBulkRefreshJob(jobId, summary);
    return NextResponse.json({ ok: true, jobId, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Toplu yenileme hatası";
    failBulkRefreshJob(jobId, msg);
    return NextResponse.json({ ok: false, jobId, error: msg }, { status: 500 });
  }
}
