import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, isSupabaseEnabled } from "@/lib/env";
import { runSystemBackup } from "@/lib/system-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: günde iki kez (vercel.json) tam sistem yedeği.
 * Yedekler system_backup_snapshots tablosuna yazılır; Orkun'a bildirim gider.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET tanımlı değil — yedekleme cron devre dışı" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const meta = await runSystemBackup({ triggeredBy: "cron", notify: true });
    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      snapshot: meta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "?";
    return NextResponse.json({ ok: false, error: message, startedAt }, { status: 500 });
  }
}
