import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import { MAIN_ADMIN_ID } from "@/lib/user-guards";
import type { AppNotification } from "@/store/store";

/** Tablo başına chunk boyutu — tek JSONB satırı şişmesin. */
const CHUNK_SIZE = 500;

/**
 * Tam sistem yedeğine dahil tablolar.
 * Eksik tablo hatası yedeklemeyi durdurmaz; partial olarak işaretlenir.
 */
export const SYSTEM_BACKUP_TABLES = [
  "app_users",
  "organizations",
  "organization_members",
  "organization_member_brands",
  "organization_member_permissions",
  "employees",
  "advances",
  "salary_extras",
  "payment_statuses",
  "external_companies",
  "sponsor_transactions",
  "internal_projects",
  "internal_project_payments",
  "expense_entries",
  "planned_items",
  "planned_item_payments",
  "streamer_accounts",
  "schedule_slots",
  "brands",
  "brand_links",
  "link_snapshots",
  "brand_viewership",
  "brand_monthly_stats",
  "kasas",
  "kasa_transactions",
  "content_expenses",
  "weekly_plans",
  "week_brand_reels",
  "app_notifications",
  "audit_logs",
  "app_settings",
  "notification_preferences",
  "api_quota_usage",
  "api_refresh_runs",
  "internal_tasks",
  "brand_registration_requests",
  "streamer_registration_requests",
  "brand_staff",
  "brand_staff_tasks",
  "brand_staff_shifts",
  "brand_staff_activity",
  "brand_ledger_entries",
  "brand_invoices",
  "brand_payroll_items",
  "brand_departments",
  "brand_payroll_component_payments",
  "brand_deals",
  "brand_posts",
  "brand_offers",
  "brand_offer_messages",
  "streamer_pool_profiles",
  "affiliate_partners",
  "affiliate_daily_stats",
  "affiliate_payouts",
  "tron_watch_seen",
] as const;

export type SystemBackupTriggeredBy = "cron" | "manual";

export type SystemBackupSnapshotMeta = {
  id: string;
  createdAt: string;
  triggeredBy: SystemBackupTriggeredBy;
  status: "success" | "partial" | "failed";
  totalRows: number;
  tableCount: number;
  tableStats: Record<string, number>;
  errors?: Record<string, string>;
  durationMs?: number;
};

export type SystemBackupExport = {
  snapshotVersion: 1;
  exportedAt: string;
  snapshotId: string;
  triggeredBy: SystemBackupTriggeredBy;
  project: "foxstream";
  totalRows: number;
  tableCount: number;
  tables: Record<string, unknown[]>;
  errors?: Record<string, string>;
};

function newSnapshotId(): string {
  return `s-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

/** Tüm tabloları DB'den okur (indirme / yedekleme ortak mantık). */
export async function exportSystemTables(): Promise<{
  tables: Record<string, unknown[]>;
  tableStats: Record<string, number>;
  errors: Record<string, string>;
  totalRows: number;
}> {
  const db = getSupabaseAdmin();
  const tables: Record<string, unknown[]> = {};
  const tableStats: Record<string, number> = {};
  const errors: Record<string, string> = {};
  let totalRows = 0;

  for (const table of SYSTEM_BACKUP_TABLES) {
    const { data, error } = await db.from(table).select("*").limit(100_000);
    if (error) {
      errors[table] = error.message;
      continue;
    }
    const rows = data ?? [];
    tables[table] = rows;
    tableStats[table] = rows.length;
    totalRows += rows.length;
  }

  return { tables, tableStats, errors, totalRows };
}

async function persistSnapshotChunks(
  snapshotId: string,
  tables: Record<string, unknown[]>
): Promise<void> {
  const db = getSupabaseAdmin();
  const chunkRowsToInsert: Array<{
    id: string;
    snapshot_id: string;
    table_name: string;
    chunk_index: number;
    row_count: number;
    data: unknown[];
  }> = [];

  for (const [tableName, rows] of Object.entries(tables)) {
    const parts = chunkRows(rows, CHUNK_SIZE);
    parts.forEach((part, chunkIndex) => {
      chunkRowsToInsert.push({
        id: `${snapshotId}-${tableName}-${chunkIndex}`,
        snapshot_id: snapshotId,
        table_name: tableName,
        chunk_index: chunkIndex,
        row_count: part.length,
        data: part,
      });
    });
  }

  const BATCH = 40;
  for (let i = 0; i < chunkRowsToInsert.length; i += BATCH) {
    const batch = chunkRowsToInsert.slice(i, i + BATCH);
    const { error } = await db.from("system_backup_table_chunks").insert(batch);
    if (error) throw new Error(`system_backup_table_chunks insert: ${error.message}`);
  }
}

async function upsertLastBackupSetting(meta: SystemBackupSnapshotMeta): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("app_settings").upsert(
    {
      key: "system_backup_last",
      value: {
        snapshotId: meta.id,
        createdAt: meta.createdAt,
        triggeredBy: meta.triggeredBy,
        status: meta.status,
        totalRows: meta.totalRows,
        tableCount: meta.tableCount,
        tableStats: meta.tableStats,
        errors: meta.errors ?? null,
        durationMs: meta.durationMs ?? null,
      },
      updated_at: new Date().toISOString(),
      updated_by: MAIN_ADMIN_ID,
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(`app_settings system_backup_last: ${error.message}`);
}

async function notifyOrkunBackup(meta: SystemBackupSnapshotMeta): Promise<void> {
  const db = getSupabaseAdmin();
  const errorCount = meta.errors ? Object.keys(meta.errors).length : 0;
  const statusLabel =
    meta.status === "success"
      ? "başarılı"
      : meta.status === "partial"
        ? "kısmen başarılı"
        : "başarısız";

  const title =
    meta.triggeredBy === "cron"
      ? `Otomatik sistem yedeği (${statusLabel})`
      : `Manuel sistem yedeği (${statusLabel})`;

  const message =
    errorCount > 0
      ? `${meta.totalRows.toLocaleString("tr-TR")} satır · ${meta.tableCount} tablo · ${errorCount} tablo hatası — Kullanıcılar sayfasından indirebilirsiniz.`
      : `${meta.totalRows.toLocaleString("tr-TR")} satır · ${meta.tableCount} tablo yedeklendi — Kullanıcılar sayfasından indirebilirsiniz.`;

  const notif: AppNotification = {
    id: `n-backup-${meta.id}`,
    type: "general",
    title,
    message,
    forRole: "admin",
    forUserId: MAIN_ADMIN_ID,
    href: "/kullanicilar",
    refId: meta.id,
    triggeredBy: "system",
    createdAt: meta.createdAt,
    read: false,
  };

  const { error } = await db.from("app_notifications").insert(notificationToRow(notif));
  if (error) {
    console.error("[system-backup] Orkun bildirimi yazılamadı:", error.message);
  }
}

/** Tam yedek alır, DB'ye yazar ve Orkun'a bildirim gönderir. */
export async function runSystemBackup(opts: {
  triggeredBy: SystemBackupTriggeredBy;
  notify?: boolean;
}): Promise<SystemBackupSnapshotMeta> {
  const started = Date.now();
  const snapshotId = newSnapshotId();
  const createdAt = new Date().toISOString();

  const { tables, tableStats, errors, totalRows } = await exportSystemTables();
  const tableCount = Object.keys(tables).length;
  const errorKeys = Object.keys(errors);

  let status: SystemBackupSnapshotMeta["status"] = "success";
  if (errorKeys.length > 0 && tableCount === 0) status = "failed";
  else if (errorKeys.length > 0) status = "partial";

  const meta: SystemBackupSnapshotMeta = {
    id: snapshotId,
    createdAt,
    triggeredBy: opts.triggeredBy,
    status,
    totalRows,
    tableCount,
    tableStats,
    ...(errorKeys.length ? { errors } : {}),
    durationMs: Date.now() - started,
  };

  const db = getSupabaseAdmin();
  const { error: snapErr } = await db.from("system_backup_snapshots").insert({
    id: snapshotId,
    created_at: createdAt,
    triggered_by: opts.triggeredBy,
    status,
    total_rows: totalRows,
    table_count: tableCount,
    table_stats: tableStats,
    errors: errorKeys.length ? errors : null,
    duration_ms: meta.durationMs,
  });
  if (snapErr) throw new Error(`system_backup_snapshots insert: ${snapErr.message}`);

  await persistSnapshotChunks(snapshotId, tables);
  await upsertLastBackupSetting(meta);

  if (opts.notify !== false) {
    await notifyOrkunBackup(meta);
  }

  return meta;
}

export async function listSystemBackupSnapshots(limit = 20): Promise<SystemBackupSnapshotMeta[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("system_backup_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`system_backup_snapshots list: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    createdAt: String(r.created_at),
    triggeredBy: (r.triggered_by === "manual" ? "manual" : "cron") as SystemBackupTriggeredBy,
    status: r.status as SystemBackupSnapshotMeta["status"],
    totalRows: Number(r.total_rows ?? 0),
    tableCount: Number(r.table_count ?? 0),
    tableStats: (r.table_stats ?? {}) as Record<string, number>,
    errors: r.errors ? (r.errors as Record<string, string>) : undefined,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : undefined,
  }));
}

/** Kayıtlı yedeği JSON export formatına birleştirir. */
export async function loadSystemBackupExport(snapshotId: string): Promise<SystemBackupExport | null> {
  const db = getSupabaseAdmin();

  const { data: snap, error: snapErr } = await db
    .from("system_backup_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapErr) throw new Error(`system_backup_snapshots load: ${snapErr.message}`);
  if (!snap) return null;

  const { data: chunks, error: chunkErr } = await db
    .from("system_backup_table_chunks")
    .select("table_name, chunk_index, data")
    .eq("snapshot_id", snapshotId)
    .order("table_name")
    .order("chunk_index");
  if (chunkErr) throw new Error(`system_backup_table_chunks load: ${chunkErr.message}`);

  const tables: Record<string, unknown[]> = {};
  for (const c of chunks ?? []) {
    const name = String(c.table_name);
    if (!tables[name]) tables[name] = [];
    const part = (c.data ?? []) as unknown[];
    tables[name].push(...part);
  }

  const errors = snap.errors ? (snap.errors as Record<string, string>) : undefined;

  return {
    snapshotVersion: 1,
    exportedAt: String(snap.created_at),
    snapshotId,
    triggeredBy: snap.triggered_by === "manual" ? "manual" : "cron",
    project: "foxstream",
    totalRows: Number(snap.total_rows ?? 0),
    tableCount: Number(snap.table_count ?? 0),
    tables,
    ...(errors && Object.keys(errors).length ? { errors } : {}),
  };
}
