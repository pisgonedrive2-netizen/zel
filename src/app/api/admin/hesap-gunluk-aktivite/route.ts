import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import {
  backfillHesapGunlukAktivite,
  HESAP_GUNLUK_BACKFILL_MAX,
  loadHesapGunlukStore,
  runHesapGunlukAktivite,
} from "@/lib/hesap-gunluk-aktivite";
import {
  hesapGunlukIstanbulDate,
  summarizeModeratorPosting,
} from "@/lib/hesap-gunluk-aktivite-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireAdmin() {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "auditor") ? s : null;
}

/** Takvim deposu (byDate). */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  const store = await loadHesapGunlukStore();
  if (req.nextUrl.searchParams.get("summary") === "moderators") {
    const end = store?.latestDate ?? hesapGunlukIstanbulDate();
    return NextResponse.json({
      ok: true,
      ...summarizeModeratorPosting(store, end, 28),
    });
  }
  return NextResponse.json({ ok: true, store });
}

/**
 * Manuel tarama.
 * - date: tek gün
 * - backfillDays: tek API turu ile son N günü doldur (1–21)
 * - varsayılan: bugün (ara kontrol)
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  const session = await requireAdmin();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    notify?: boolean;
    final?: boolean;
    date?: string;
    backfillDays?: number;
  };
  try {
    if (body.backfillDays != null) {
      const days = Math.max(1, Math.min(Number(body.backfillDays) || 14, HESAP_GUNLUK_BACKFILL_MAX));
      const result = await backfillHesapGunlukAktivite({ days, triggeredBy: "manual" });
      return NextResponse.json({
        ok: true,
        mode: "backfill",
        days: result.days,
        filled: result.filled,
        store: result.store,
        report: result.store.byDate[result.filled.at(-1) ?? ""] ?? null,
      });
    }

    const report = await runHesapGunlukAktivite({
      triggeredBy: "manual",
      date: body.date,
      final: typeof body.final === "boolean" ? body.final : undefined,
      notify: body.notify === true,
    });
    const store = await loadHesapGunlukStore();
    return NextResponse.json({ ok: true, mode: "day", report, store });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "?" },
      { status: 500 }
    );
  }
}
