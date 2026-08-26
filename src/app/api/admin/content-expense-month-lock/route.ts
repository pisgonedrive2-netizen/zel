import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import {
  CONTENT_EXPENSE_LOCKED_MONTHS_KEY,
  normalizeLockedMonths,
} from "@/lib/content-expense-month-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readLocked(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", CONTENT_EXPENSE_LOCKED_MONTHS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeLockedMonths(data?.value);
}

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: true, lockedMonths: [] });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  try {
    const lockedMonths = await readLocked();
    return NextResponse.json({ ok: true, lockedMonths });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Okuma hatası" },
      { status: 500 }
    );
  }
}

/** POST { monthYm, locked } — yalnızca ana yönetici (orkun) ay kilitler/açar. */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json(
      { ok: false, error: "Yalnızca ana yönetici ay kilitleyebilir" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    monthYm?: string;
    locked?: boolean;
  };
  const monthYm = String(body.monthYm ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthYm)) {
    return NextResponse.json({ ok: false, error: "Geçersiz ay (YYYY-MM)" }, { status: 400 });
  }
  if (typeof body.locked !== "boolean") {
    return NextResponse.json({ ok: false, error: "locked boolean gerekli" }, { status: 400 });
  }

  try {
    const current = await readLocked();
    const next = body.locked
      ? normalizeLockedMonths([...current, monthYm])
      : current.filter((m) => m !== monthYm);

    const { error } = await getSupabaseAdmin().from("app_settings").upsert(
      {
        key: CONTENT_EXPENSE_LOCKED_MONTHS_KEY,
        value: next,
        updated_by: session.userId,
      },
      { onConflict: "key" }
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, lockedMonths: next });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Kayıt hatası" },
      { status: 500 }
    );
  }
}
