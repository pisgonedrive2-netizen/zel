import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";

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

  // Gizlilik: yöneticilerin (özellikle ana yönetici) işlem kayıtları
  // denetçiye/diğer rollere GÖRÜNMEZ. Sadece admin tam günlüğü görür.
  if (session.role !== "admin") {
    const { data: adminUsers } = await db
      .from("app_users")
      .select("id")
      .eq("role", "admin");
    const adminIds = new Set<string>([
      ...(adminUsers ?? []).map((u) => String((u as { id: unknown }).id)),
    ]);
    // Ana yönetici sabit id'si de garantiye al.
    const { MAIN_ADMIN_ID } = await import("@/lib/user-guards");
    adminIds.add(MAIN_ADMIN_ID);
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
  const entries = (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    at: String(r.created_at),
    actorId: String(r.actor_id),
    actorName: String(r.actor_name),
    action: String(r.action),
    detail: String(r.detail ?? ""),
  }));
  return NextResponse.json({ entries });
}
