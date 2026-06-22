import type { AppUser } from "@/store/auth";
import type { AppHydratePayload } from "@/store/store";
import { APP_SNAPSHOT_KEYS } from "@/store/store";

export const LANETKEL_BACKUP_VERSION = 1 as const;

export type LanetkelBackupV1 = {
  backupVersion: typeof LANETKEL_BACKUP_VERSION;
  exportedAt: string;
  auth: { users: AppUser[] };
  app: AppHydratePayload;
};

export function pickAppHydratePayload(store: Record<string, unknown>): AppHydratePayload {
  const o: AppHydratePayload = {};
  for (const k of APP_SNAPSHOT_KEYS) {
    const v = store[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** İçe aktarım için hafif doğrulama. */
export function parseLanetkelBackup(raw: unknown): LanetkelBackupV1 | null {
  if (!isObject(raw)) return null;
  if (raw.backupVersion !== LANETKEL_BACKUP_VERSION) return null;
  if (typeof raw.exportedAt !== "string") return null;
  const auth = raw.auth;
  if (!isObject(auth) || !Array.isArray(auth.users)) return null;
  const app = raw.app;
  if (!isObject(app)) return null;
  for (const k of APP_SNAPSHOT_KEYS) {
    const v = app[k];
    if (v !== undefined && !Array.isArray(v)) return null;
  }
  return {
    backupVersion: LANETKEL_BACKUP_VERSION,
    exportedAt: raw.exportedAt,
    auth: { users: auth.users as AppUser[] },
    app: app as AppHydratePayload,
  };
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Nesne dizisini CSV metnine çevirir (başlık satırı = tüm anahtarların birleşimi). */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return lines.join("\n");
}

/**
 * Birden çok tabloyu tek bir CSV dosyasında, her tablo `## tablo_adı` başlığıyla
 * ayrılmış olarak indirir. Excel/Sheets'te bölüm bölüm açılabilir.
 */
export function downloadTablesCsv(filename: string, tables: Record<string, Record<string, unknown>[]>): void {
  const blocks: string[] = [];
  for (const [name, rows] of Object.entries(tables)) {
    blocks.push(`## ${name} (${rows.length})`);
    blocks.push(rowsToCsv(rows));
    blocks.push("");
  }
  // BOM ekle — Excel Türkçe karakterleri doğru açsın.
  const blob = new Blob(["\uFEFF" + blocks.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename, blob);
}
