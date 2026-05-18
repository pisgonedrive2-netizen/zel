import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { notificationToRow, projectFromRow } from "@/lib/db/mappers";
import {
  brandUsersForProject,
  buildBrandPaymentReminderCopy,
} from "@/lib/ic-gelir-remind";
import { toYearMonthLocal } from "@/lib/data";
import type { AppNotification, Brand } from "@/store/store";

export const runtime = "nodejs";

/**
 * POST /api/ic-gelir/remind
 * Body: { projectId: string, month?: "YYYY-MM" }
 * Marka portalı kullanıcılarına ödeme hatırlatması gönderir.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { projectId?: string; month?: string };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId zorunlu" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const monthYm = body.month ?? toYearMonthLocal(new Date());

  const { data: projRow, error: projErr } = await db
    .from("internal_projects")
    .select("*")
    .eq("id", body.projectId)
    .maybeSingle();
  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 });
  if (!projRow) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const project = projectFromRow(projRow as Record<string, unknown>);
  if (!project.brandId) {
    return NextResponse.json({ error: "Projeye bağlı marka yok" }, { status: 400 });
  }

  const { data: brandRow } = await db
    .from("brands")
    .select("*")
    .eq("id", project.brandId)
    .maybeSingle();
  const brand = brandRow
    ? ({
        id: String(brandRow.id),
        name: String(brandRow.name),
        shortName: String(brandRow.short_name ?? brandRow.name),
      } as Pick<Brand, "id" | "name" | "shortName">)
    : undefined;

  const { data: userRows } = await db.from("app_users").select("id, role, brand_id, active, name");
  const brandUsers = brandUsersForProject(
    (userRows ?? []).map((u) => ({
      id: String(u.id),
      username: "",
      pin: "",
      name: String(u.name ?? ""),
      role: u.role as "brand",
      brandId: u.brand_id ? String(u.brand_id) : undefined,
      avatar: "",
      active: u.active !== false,
    })),
    project.brandId
  );

  if (brandUsers.length === 0) {
    return NextResponse.json(
      { error: "Bu marka için aktif portal kullanıcısı bulunamadı" },
      { status: 400 }
    );
  }

  const { title, message, refId } = buildBrandPaymentReminderCopy(project, brand as Brand | undefined, monthYm);
  const now = new Date().toISOString();
  const created: AppNotification[] = [];

  for (const bu of brandUsers) {
    const notif: AppNotification = {
      id: `n-${crypto.randomUUID().slice(0, 12)}`,
      type: "brand_payment_reminder",
      title,
      message,
      forRole: "brand",
      forUserId: bu.id,
      refId: `${refId}-${bu.id}`,
      triggeredBy: session.userId,
      createdAt: now,
      read: false,
      href: "/marka/izlenmeler",
    };
    const { error } = await db.from("app_notifications").insert(notificationToRow(notif));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    created.push(notif);
  }

  await db
    .from("internal_projects")
    .update({ last_reminder_sent_at: now })
    .eq("id", project.id);

  return NextResponse.json({
    ok: true,
    notifications: created,
    lastReminderSentAt: now,
    sentTo: brandUsers.map((u) => u.name),
  });
}
