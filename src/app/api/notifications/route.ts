import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { notificationFromRow, notificationToRow } from "@/lib/db/mappers";
import { STREAMER_NOTIFICATION_TYPES, type AppNotification } from "@/store/store";

export const runtime = "nodejs";

/** Markanın erişebildiği marka id'leri (scope_all_brands ise tümü, yoksa birincil). */
function brandScopeIds(session: SessionPayload): string[] {
  if (session.brandIds && session.brandIds.length) return session.brandIds;
  if (session.brandId) return [session.brandId];
  return [];
}

/** GET /api/notifications — admin/denetçi tüm akış; yayıncı/marka kendi bildirimleri. */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ notifications: [] });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const type = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);

  const db = getSupabaseAdmin();

  if (session.role === "streamer" || session.role === "brand") {
    let q = db
      .from("app_notifications")
      .select("*")
      .eq("for_role", session.role)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (session.role === "streamer") {
      q = q.in("type", [...STREAMER_NOTIFICATION_TYPES]);
      // Yayıncı: kendi bildirimi + genel duyuru (kullanıcı bazlı izolasyon).
      q = q.or(`for_user_id.eq.${session.userId},and(for_user_id.is.null,for_brand_id.is.null)`);
    } else {
      // Marka: kendi kullanıcı bildirimi VEYA erişebildiği markaların bildirimi
      // VEYA genel duyuru (her ikisi de NULL). Markalar arası sızma engellenir.
      const brandIds = brandScopeIds(session);
      const orParts = [`for_user_id.eq.${session.userId}`];
      if (brandIds.length) orParts.push(`for_brand_id.in.(${brandIds.join(",")})`);
      orParts.push(`and(for_user_id.is.null,for_brand_id.is.null)`);
      q = q.or(orParts.join(","));
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const notifications = (data ?? []).map((r) =>
      notificationFromRow(r as Record<string, unknown>)
    );
    return NextResponse.json({ notifications });
  }

  if (session.role !== "admin" && session.role !== "auditor") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  let q = db.from("app_notifications").select("*")
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
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
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
    forBrandId: body.forBrandId,
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
 * - Admin: her şeyi silebilir.
 * - Streamer / brand: yalnızca kendisine ait (for_user_id == session.userId) ve
 *   uygun for_role ile eşleşen bildirimleri silebilir.
 */
export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const olderThanDays = url.searchParams.get("olderThanDays");
  const db = getSupabaseAdmin();
  const isAdmin = session.role === "admin";
  const isSelfRole =
    session.role === "brand" || session.role === "streamer";

  let bodyIds: string[] | undefined;
  try {
    const jsonBody = (await req.json().catch(() => null)) as { ids?: string[] } | null;
    if (jsonBody?.ids && Array.isArray(jsonBody.ids)) bodyIds = jsonBody.ids;
  } catch {
    bodyIds = undefined;
  }

  if (bodyIds && bodyIds.length > 0 && isAdmin) {
    const unique = [...new Set(bodyIds)].slice(0, 500);
    const { error, count } = await db
      .from("app_notifications")
      .delete({ count: "exact" })
      .in("id", unique);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: count ?? unique.length });
  }

  if (id) {
    if (isAdmin) {
      const { error } = await db.from("app_notifications").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: 1 });
    }
    if (isSelfRole) {
      // Kullanıcı yalnızca kendi (veya markası) bildirimini silebilir.
      let dq = db
        .from("app_notifications")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("for_role", session.role);
      if (session.role === "brand") {
        const brandIds = brandScopeIds(session);
        const parts = [`for_user_id.eq.${session.userId}`];
        if (brandIds.length) parts.push(`for_brand_id.in.(${brandIds.join(",")})`);
        dq = dq.or(parts.join(","));
      } else {
        dq = dq.eq("for_user_id", session.userId);
      }
      const { error, count } = await dq;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if ((count ?? 0) === 0) {
        return NextResponse.json({ error: "Bildirim bulunamadı veya yetki yok" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, deleted: count });
    }
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  if (olderThanDays) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Toplu silme yalnızca yönetici" }, { status: 403 });
    }
    const days = Math.max(parseInt(olderThanDays, 10) || 0, 1);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { error, count } = await db
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
 *
 * - Admin / denetçi: tüm rollerin bildirimlerini okundu işaretleyebilir.
 * - Streamer / brand: yalnızca kendi rolü ve `forUserId === session.userId`
 *   olan bildirimleri okundu işaretleyebilir. Body'deki forRole/forUserId
 *   yok sayılır, sunucu oturumdan türetir.
 */
export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const isElevated = session.role === "admin" || session.role === "auditor";
  const isSelfRole = session.role === "brand" || session.role === "streamer";
  if (!isElevated && !isSelfRole) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    read?: boolean;
    completedAt?: boolean;
    markAll?: boolean;
    markAllPanel?: boolean;
    forRole?: AppNotification["forRole"];
    forUserId?: string;
    forBrandId?: string;
  };

  const db = getSupabaseAdmin();

  if (body.markAll && body.markAllPanel && isElevated) {
    const { error } = await db
      .from("app_notifications")
      .update({ read: true })
      .eq("read", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.markAll) {
    if (isSelfRole) {
      // Self mark-all: forRole sunucudan zorlanır; marka için marka kapsamı dahil.
      let uq = db
        .from("app_notifications")
        .update({ read: true })
        .eq("for_role", session.role)
        .eq("read", false);
      if (session.role === "brand") {
        const brandIds = brandScopeIds(session);
        const parts = [`for_user_id.eq.${session.userId}`];
        if (brandIds.length) parts.push(`for_brand_id.in.(${brandIds.join(",")})`);
        uq = uq.or(parts.join(","));
      } else {
        uq = uq.eq("for_user_id", session.userId);
      }
      const { error } = await uq;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (!body.forRole) {
      return NextResponse.json({ error: "forRole gerekli" }, { status: 400 });
    }
    let q = db.from("app_notifications").update({ read: true }).eq("for_role", body.forRole).eq("read", false);
    if (body.forRole === "brand" && body.forBrandId) {
      const parts = [`for_brand_id.eq.${body.forBrandId}`];
      if (body.forUserId) parts.push(`for_user_id.eq.${body.forUserId}`);
      parts.push(`and(for_user_id.is.null,for_brand_id.is.null)`);
      q = q.or(parts.join(","));
    } else if (body.forUserId) {
      q = q.or(`for_user_id.is.null,for_user_id.eq.${body.forUserId}`);
    }
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.id && body.completedAt === true) {
    const completedIso = new Date().toISOString();
    if (session.role === "streamer") {
      const { data: existing, error: fetchErr } = await db
        .from("app_notifications")
        .select("*")
        .eq("id", body.id)
        .eq("for_role", "streamer")
        .eq("for_user_id", session.userId)
        .maybeSingle();
      if (fetchErr || !existing) {
        return NextResponse.json({ error: "Bildirim bulunamadı veya yetki yok" }, { status: 404 });
      }
      const { error, count } = await db
        .from("app_notifications")
        .update({ read: true, completed_at: completedIso }, { count: "exact" })
        .eq("id", body.id)
        .eq("for_role", "streamer")
        .eq("for_user_id", session.userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if ((count ?? 0) === 0) {
        return NextResponse.json({ error: "Bildirim bulunamadı veya yetki yok" }, { status: 404 });
      }
      const row = existing as Record<string, unknown>;
      const adminNotif: AppNotification = {
        id: `n-${crypto.randomUUID().slice(0, 12)}`,
        type: "general",
        title: "Görev tamamlandı",
        message: String(row.message ?? row.title ?? "Yayıncı bir görevi tamamladı olarak işaretledi."),
        forRole: "admin",
        refId: body.id,
        triggeredBy: session.userId,
        createdAt: new Date().toISOString(),
        read: false,
        href: "/gorevler",
      };
      await db.from("app_notifications").insert(notificationToRow(adminNotif));
      return NextResponse.json({ ok: true, completedAt: completedIso });
    }
    if (isElevated) {
      const { error } = await db
        .from("app_notifications")
        .update({ read: true, completed_at: completedIso })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, completedAt: completedIso });
    }
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  if (body.id && body.read === true) {
    if (isElevated) {
      const { error } = await db.from("app_notifications").update({ read: true }).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    // Self-only update: id + for_role + (kullanıcı veya marka) scope edilir.
    let uq = db
      .from("app_notifications")
      .update({ read: true }, { count: "exact" })
      .eq("id", body.id)
      .eq("for_role", session.role);
    if (session.role === "brand") {
      const brandIds = brandScopeIds(session);
      const parts = [`for_user_id.eq.${session.userId}`];
      if (brandIds.length) parts.push(`for_brand_id.in.(${brandIds.join(",")})`);
      uq = uq.or(parts.join(","));
    } else {
      uq = uq.eq("for_user_id", session.userId);
    }
    const { error, count } = await uq;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: "Bildirim bulunamadı veya yetki yok" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "id+read veya markAll gerekli" }, { status: 400 });
}
