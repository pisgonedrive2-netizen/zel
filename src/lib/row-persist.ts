import { requestSyncFlush } from "@/lib/sync-client";
import { notifySyncError } from "@/lib/sync-notify";

/** Anında tek satır kaydı desteklenen tablolar. */
export type PersistEntity =
  | "schedule_slot"
  | "brand_link"
  | "link_snapshot"
  | "brand_viewership"
  | "weekly_plan"
  | "week_brand_reel"
  | "streamer_account"
  | "content_expense";

async function apiPersist(
  entity: PersistEntity,
  row: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/data/row", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, row }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const err = data.error ?? `Kayıt başarısız (${res.status})`;
      notifySyncError(err);
      requestSyncFlush();
      return { ok: false, error: err };
    }
    requestSyncFlush();
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : "Ağ hatası";
    notifySyncError(err);
    requestSyncFlush();
    return { ok: false, error: err };
  }
}

async function apiRemove(
  entity: PersistEntity,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const q = new URLSearchParams({ entity, id });
    const res = await fetch(`/api/data/row?${q}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const err = data.error ?? `Silme başarısız (${res.status})`;
      notifySyncError(err);
      requestSyncFlush();
      return { ok: false, error: err };
    }
    requestSyncFlush();
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : "Ağ hatası";
    notifySyncError(err);
    requestSyncFlush();
    return { ok: false, error: err };
  }
}

export function persistRowImmediate(entity: PersistEntity, row: Record<string, unknown>) {
  void apiPersist(entity, row);
}

export function removeRowImmediate(entity: PersistEntity, id: string) {
  void apiRemove(entity, id);
}
