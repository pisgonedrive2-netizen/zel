import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tam sistem yedeği — tüm önemli Supabase tablolarının anlık görüntüsü.
 * İstemci store yedeğinden farklı olarak doğrudan veritabanından okur,
 * böylece marka/organizasyon/log tabloları dahil her şey yedeklenir.
 * Yalnızca ana yönetici (Orkun) erişebilir.
 */
const BACKUP_TABLES = [
  "app_users", "organizations", "organization_members", "organization_member_brands",
  "organization_member_permissions",
  "employees", "advances", "salary_extras", "payment_statuses",
  "external_companies", "sponsor_transactions", "internal_projects", "internal_project_payments",
  "expense_entries", "planned_items", "planned_item_payments",
  "streamer_accounts", "schedule_slots",
  "brands", "brand_links", "link_snapshots", "brand_viewership", "brand_monthly_stats",
  "kasas", "kasa_transactions",
  "content_expenses", "weekly_plans", "week_brand_reels",
  "app_notifications", "audit_logs", "app_settings", "notification_preferences",
  "api_quota_usage", "api_refresh_runs",
  "internal_tasks",
  "brand_registration_requests", "streamer_registration_requests",
  "brand_staff", "brand_staff_tasks", "brand_staff_shifts", "brand_staff_activity",
  "brand_ledger_entries", "brand_invoices", "brand_payroll_items", "brand_departments",
] as const;

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json({ error: "Yalnızca ana yönetici" }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  const tables: Record<string, unknown[]> = {};
  const errors: Record<string, string> = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    const { data, error } = await db.from(table).select("*").limit(100000);
    if (error) {
      errors[table] = error.message;
      continue;
    }
    tables[table] = data ?? [];
    totalRows += (data ?? []).length;
  }

  const payload = {
    snapshotVersion: 1,
    exportedAt: new Date().toISOString(),
    project: "foxstream",
    totalRows,
    tableCount: Object.keys(tables).length,
    tables,
    ...(Object.keys(errors).length ? { errors } : {}),
  };

  const filename = `foxstream-sistem-yedegi-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
