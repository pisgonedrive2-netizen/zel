import type { KasaTransaction } from "@/store/store";
import { requestSyncFlush } from "@/lib/sync-client";

export const SYNC_ERROR_EVENT = "fox-sync-error";

function notifySyncError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: message }));
  }
}

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
