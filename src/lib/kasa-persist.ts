import type { KasaTransaction } from "@/store/store";
import { requestSyncFlush } from "@/lib/sync-client";
import { notifySyncError } from "@/lib/sync-notify";

/** Tek kasa hareketini anında Supabase'e yazar (tam sync yedeklenir). */
export async function persistKasaTransaction(
  tx: KasaTransaction
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/kasa/transaction", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tx),
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

/**
 * Birden çok kasa hareketinin `countInGenel` bayrağını TEK istekte günceller.
 * Toplu TRON dahil/çıkar işlemi yüzlerce eşzamanlı tekil POST yerine bunu kullanır.
 */
export async function bulkUpdateKasaCountInGenel(
  ids: string[],
  countInGenel: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (ids.length === 0) return { ok: true };
  try {
    const res = await fetch("/api/kasa/transaction/bulk", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, countInGenel }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const err = data.error ?? `Toplu güncelleme başarısız (${res.status})`;
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

export async function removeKasaAccount(
  id: string,
  opts?: { force?: boolean },
): Promise<{ ok: boolean; archived?: boolean; deleted?: boolean; error?: string }> {
  try {
    const qs = new URLSearchParams({ id });
    if (opts?.force) qs.set("force", "1");
    const res = await fetch(`/api/kasa/account?${qs.toString()}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const err = data.error ?? `Kasa silinemedi (${res.status})`;
      notifySyncError(err);
      requestSyncFlush();
      return { ok: false, error: err };
    }
    const data = (await res.json()) as { archived?: boolean; deleted?: boolean };
    requestSyncFlush();
    return { ok: true, archived: data.archived, deleted: data.deleted };
  } catch (e) {
    const err = e instanceof Error ? e.message : "Ağ hatası";
    notifySyncError(err);
    requestSyncFlush();
    return { ok: false, error: err };
  }
}

export async function removeKasaTransaction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/kasa/transaction?id=${encodeURIComponent(id)}`, {
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
