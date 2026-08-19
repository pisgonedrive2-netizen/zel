import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { syncAllActivePersonalAccounts } from "@/lib/social-api/streamer-achievement-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron: yayıncı kişisel IG/YT/TT hesaplarından achievement takvimine yaz.
 * vercel.json — refresh-links'ten sonra (kota paylaşılır).
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  if (!isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RAPIDAPI_KEY yok" }, { status: 503 });
  }
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil — cron devre dışı" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const summary = await syncAllActivePersonalAccounts();
    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "?";
    return NextResponse.json({ ok: false, error: message, startedAt }, { status: 500 });
  }
}
