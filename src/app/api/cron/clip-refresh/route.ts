import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { clipTablesReady, refreshSubmissions } from "@/lib/clip-farm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron: onaylı ve bekleyen video yolla gönderimlerinin günlük ölçümü. */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled() || !isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "Yapılandırma eksik" }, { status: 503 });
  }
  const secret = getCronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }
  if (!(await clipTablesReady())) return NextResponse.json({ ok: true, skipped: "tablolar yok" });
  const summary = await refreshSubmissions({ statuses: ["approved", "pending"] }, 270_000);
  return NextResponse.json({ ok: true, ...summary });
}
