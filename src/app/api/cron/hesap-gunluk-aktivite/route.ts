import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, isSupabaseEnabled } from "@/lib/env";
import { runHesapGunlukAktivite } from "@/lib/hesap-gunluk-aktivite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Her gece 00:00 İstanbul (21:00 UTC): bir önceki günü kesin tarar, tek bildirim.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET yok" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }

  try {
    const report = await runHesapGunlukAktivite({
      triggeredBy: "cron",
      final: true,
      notify: true,
    });
    return NextResponse.json({
      ok: true,
      date: report.date,
      final: report.final,
      notified: report.notified ?? false,
      posted: report.posted,
      missing: report.missing,
      errors: report.errors,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "?" },
      { status: 500 }
    );
  }
}
