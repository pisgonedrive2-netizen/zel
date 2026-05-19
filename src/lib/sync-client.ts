/** Anında Supabase senkronizasyonu — DataProvider tarafından kayıt edilir. */

type FlushHandler = () => void;

let flushHandler: FlushHandler | null = null;

export function registerSyncFlushHandler(handler: FlushHandler | null) {
  flushHandler = handler;
}

/** Debounce beklemeden sunucuya yaz (link / snapshot / izlenme kayıtları için). */
export function requestSyncFlush() {
  flushHandler?.();
}
