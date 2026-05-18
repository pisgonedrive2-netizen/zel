import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import type { AppNotification } from "@/store/store";
import type { NotificationPref, NotificationPrefsMap } from "@/lib/notification-preferences";

export const runtime = "nodejs";
export type { NotificationPref, NotificationPrefsMap };

function rowToPref(r: Record<string, unknown>): NotificationPref {
  return {
    inApp: Boolean(r.in_app ?? true),
    desktop: Boolean(r.desktop ?? false),
    email: Boolean(r.email ?? false),
  };
}

/** GET — oturum açmış kullanıcının bildirim tercihleri. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ preferences: {} });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("notification_preferences")
    .select("type, in_app, desktop, email")
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const preferences: NotificationPrefsMap = {};
  for (const row of data ?? []) {
    const type = row.type as AppNotification["type"];
    preferences[type] = rowToPref(row as Record<string, unknown>);
  }
  return NextResponse.json({ preferences });
}

/**
 * PUT — tercihleri güncelle.
 * Body: { preferences: Record<type, { inApp?, desktop?, email? }> }
 */
export async function PUT(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    preferences?: NotificationPrefsMap;
  };
  const prefs = body.preferences ?? {};
  const rows = Object.entries(prefs).map(([type, p]) => ({
    user_id: session.userId,
    type,
    in_app: p?.inApp ?? true,
    desktop: p?.desktop ?? false,
    email: p?.email ?? false,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await getSupabaseAdmin()
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,type" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
