import { NextRequest, NextResponse } from "next/server";
import { runAllPlatformsRefresh } from "@/lib/social-api/refresh-runner";
import { getCronSecret, isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: günde bir kez (vercel.json'da tanımlı) — link metrics yenileme.
 *
 * Vercel Cron, isteklere `Authorization: Bearer <CRON_SECRET>` header'ı ekler.
 * Manuel tetiklemeler de aynı header'la (admin debug aracı) yapılabilir.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  if (!isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RAPIDAPI_KEY yok" }, { status: 503 });
  }
  const secret = getCronSecret();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
    }
  }
  const startedAt = new Date().toISOString();
  try {
    const summaries = await runAllPlatformsRefresh({ triggeredBy: "cron" });
    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      summaries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "?";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
