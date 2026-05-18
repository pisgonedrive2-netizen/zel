import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";

export const runtime = "nodejs";

const KEYS = [
  "notifications.kasaLowThreshold",
  "notifications.payrollReminderEnabled",
  "notifications.payrollReminderDaysBefore",
  "notifications.silencedTypes",
] as const;

type SettingsRecord = Record<(typeof KEYS)[number], unknown>;

const DEFAULTS: SettingsRecord = {
  "notifications.kasaLowThreshold": 5000,
  "notifications.payrollReminderEnabled": true,
  "notifications.payrollReminderDaysBefore": 3,
  "notifications.silencedTypes": [] as string[],
};

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ settings: DEFAULTS });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("*")
    .in("key", KEYS as unknown as string[]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const out: SettingsRecord = { ...DEFAULTS };
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    if ((KEYS as readonly string[]).includes(row.key)) {
      (out as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return NextResponse.json({ settings: out });
}

export async function PUT(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<SettingsRecord>;
  const rows: { key: string; value: unknown; updated_by: string }[] = [];
  for (const k of KEYS) {
    if (k in body && body[k] !== undefined) {
      rows.push({ key: k, value: body[k], updated_by: session.userId });
    }
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: rows.length });
}
