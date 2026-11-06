import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession, MAIN_ADMIN_ID, MAIN_ADMIN_USERNAME } from "@/lib/user-guards";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    detail?: string;
  };
  if (!body.action) {
    return NextResponse.json({ error: "action zorunlu" }, { status: 400 });
  }
  // Actor sunucu oturumundan türetilir; istemci bunu spoof edemez.
  const { error } = await getSupabaseAdmin().from("audit_logs").insert({
    actor_id: session.userId,
    actor_name: session.name,
    action: body.action,
    detail: body.detail ?? "",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ entries: [] });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  let query = db
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const viewerIsOrkun = isMainAdminSession(session);

  // Ana yönetici (Orkun) logları yalnızca kendisine görünür — sistem sahibi.
  if (!viewerIsOrkun) {
    query = query.neq("actor_id", MAIN_ADMIN_ID);
  }

  // Denetçi: diğer admin eylemlerini de görmez (mevcut gizlilik).
  if (session.role !== "admin") {
    const { data: adminUsers } = await db
      .from("app_users")
      .select("id")
      .eq("role", "admin");
    const adminIds = new Set<string>([
      ...(adminUsers ?? []).map((u) => String((u as { id: unknown }).id)),
      MAIN_ADMIN_ID,
    ]);
    if (adminIds.size > 0) {
      const list = Array.from(adminIds)
        .map((v) => `"${v.replace(/"/g, '\\"')}"`)
        .join(",");
      query = query.not("actor_id", "in", `(${list})`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let entries = (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    at: String(r.created_at),
    actorId: String(r.actor_id),
    actorName: String(r.actor_name),
    action: String(r.action),
    detail: String(r.detail ?? ""),
  }));

  // İsim ile de Orkun kaydı sızmasın (eski / yerel tutarsız id'ler).
  if (!viewerIsOrkun) {
    const orkunName = MAIN_ADMIN_USERNAME.toLowerCase();
    entries = entries.filter((e) => {
      if (e.actorId === MAIN_ADMIN_ID) return false;
      const n = e.actorName.toLowerCase().trim();
      return n !== orkunName && n !== "orkun";
    });
  }

  return NextResponse.json({ entries });
}
