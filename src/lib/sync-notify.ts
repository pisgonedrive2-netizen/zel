export const SYNC_ERROR_EVENT = "fox-sync-error";

export function notifySyncError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: message }));
  }
}
