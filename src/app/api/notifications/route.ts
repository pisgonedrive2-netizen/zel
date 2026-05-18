import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { notificationFromRow, notificationToRow } from "@/lib/db/mappers";
import type { AppNotification } from "@/store/store";

export const runtime = "nodejs";

/** GET /api/notifications — yöneticiler için tüm bildirim akışı (filtre destekli). */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ notifications: [] });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const type = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);

  let q = getSupabaseAdmin().from("app_notifications").select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (role) q = q.eq("for_role", role);
  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const notifications = (data ?? []).map((r) => notificationFromRow(r as Record<string, unknown>));
  return NextResponse.json({ notifications });
}

/**
 * POST /api/notifications — yönetici elle bildirim gönderir.
 * Body:
 *   {
 *     title: string,
 *     message: string,
 *     forRole: "admin" | "auditor" | "streamer" | "brand",
 *     type?: AppNotification["type"], // varsayılan "general"
 *     forUserId?: string,             // sadece bu kullanıcıya
 *     href?: string,
 *   }
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<AppNotification>;
  if (!body.title || !body.message || !body.forRole) {
    return NextResponse.json({ error: "title, message, forRole zorunlu" }, { status: 400 });
  }
  const notif: AppNotification = {
    id: `n-${crypto.randomUUID().slice(0, 12)}`,
    type: body.type ?? "general",
    title: body.title,
    message: body.message,
    forRole: body.forRole,
    forUserId: body.forUserId,
    refId: body.refId,
    triggeredBy: session.userId,
    createdAt: new Date().toISOString(),
    read: false,
    href: body.href,
  };
  const row = notificationToRow(notif);
  const { error } = await getSupabaseAdmin().from("app_notifications").insert(row);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notification: notif });
}

/**
 * DELETE /api/notifications?id=...  veya  ?olderThanDays=30
 * Yönetici bildirim silebilir.
 */
export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const olderThanDays = url.searchParams.get("olderThanDays");

  if (id) {
    const { error } = await getSupabaseAdmin().from("app_notifications").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: 1 });
  }
  if (olderThanDays) {
    const days = Math.max(parseInt(olderThanDays, 10) || 0, 1);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { error, count } = await getSupabaseAdmin()
      .from("app_notifications")
      .delete({ count: "exact" })
      .lt("created_at", cutoff);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  }
  return NextResponse.json({ error: "id veya olderThanDays gerekli" }, { status: 400 });
}

/**
 * PATCH /api/notifications
 * Body: { id, read } | { markAll: true, forRole, forUserId? }
 * Yönetici ve denetçi okundu işaretleyebilir.
 */
export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    read?: boolean;
    markAll?: boolean;
    forRole?: AppNotification["forRole"];
    forUserId?: string;
  };

  const db = getSupabaseAdmin();

  if (body.markAll && body.forRole) {
    let q = db.from("app_notifications").update({ read: true }).eq("for_role", body.forRole);
    if (body.forUserId) {
      q = q.or(`for_user_id.is.null,for_user_id.eq.${body.forUserId}`);
    }
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.id && body.read === true) {
    const { error } = await db.from("app_notifications").update({ read: true }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "id+read veya markAll+forRole gerekli" }, { status: 400 });
}
