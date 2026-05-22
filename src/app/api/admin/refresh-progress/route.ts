import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getBulkRefreshJob,
  listRecentBulkRefreshJobs,
} from "@/lib/social-api/bulk-job-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/refresh-progress?jobId=...
 *
 * Belirli bir bulk refresh işinin canlı durumunu döner.
 * jobId yoksa son tamamlanmamış işleri listeler.
 *
 * NOT: State in-memory; serverless farklı instance'larda çalıştırılırsa
 * job bulunamayabilir. Bu durumda UI fallback olarak final sonucu bekler.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  if (session.role !== "admin" && session.role !== "auditor") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici / denetçi" }, { status: 403 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (jobId) {
    const job = getBulkRefreshJob(jobId);
    if (!job) {
      return NextResponse.json({ ok: true, found: false, job: null });
    }
    return NextResponse.json({ ok: true, found: true, job });
  }

  // Tüm aktif işleri döner — UI ana panel için.
  const all = listRecentBulkRefreshJobs();
  const active = all.filter((j) => j.status === "running");
  return NextResponse.json({ ok: true, active, recent: all.slice(0, 10) });
}
