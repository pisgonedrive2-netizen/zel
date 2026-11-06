import { isSupabaseClientMode } from "@/lib/supabase-client";

export const PRIM_POOL_LOCKED_KEY = "primPool.locked";
export const PRIM_POOL_LOCKED_LS = "foxstream.primPoolLocked";

export function normalizePrimPoolLocked(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === 1 || raw === "1") return true;
  if (raw && typeof raw === "object" && "locked" in raw) {
    return normalizePrimPoolLocked((raw as { locked: unknown }).locked);
  }
  return false;
}

function readLocalPrimPoolLocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRIM_POOL_LOCKED_LS) === "1";
  } catch {
    return false;
  }
}

function writeLocalPrimPoolLocked(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRIM_POOL_LOCKED_LS, locked ? "1" : "0");
  } catch {
    // kota / private mode
  }
}

/** Senkron okuma — önce localStorage (anında UI), API async ile senkronize edilir. */
export function getPrimPoolLocked(): boolean {
  return readLocalPrimPoolLocked();
}

export function setPrimPoolLockedLocal(locked: boolean): void {
  writeLocalPrimPoolLocked(locked);
}

export async function fetchPrimPoolLocked(): Promise<boolean> {
  if (!isSupabaseClientMode()) {
    return readLocalPrimPoolLocked();
  }
  try {
    const res = await fetch("/api/admin/orkun/prim-lock", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return readLocalPrimPoolLocked();
    const json = (await res.json()) as { locked?: boolean };
    const locked = normalizePrimPoolLocked(json.locked);
    writeLocalPrimPoolLocked(locked);
    return locked;
  } catch {
    return readLocalPrimPoolLocked();
  }
}

export async function setPrimPoolLocked(
  locked: boolean
): Promise<{ ok: boolean; locked: boolean; error?: string }> {
  writeLocalPrimPoolLocked(locked);
  if (!isSupabaseClientMode()) {
    return { ok: true, locked };
  }
  try {
    const res = await fetch("/api/admin/orkun/prim-lock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      locked?: boolean;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        locked: readLocalPrimPoolLocked(),
        error: json.error ?? `HTTP ${res.status}`,
      };
    }
    const next = normalizePrimPoolLocked(json.locked);
    writeLocalPrimPoolLocked(next);
    return { ok: true, locked: next };
  } catch (e) {
    return {
      ok: false,
      locked: readLocalPrimPoolLocked(),
      error: e instanceof Error ? e.message : "Ağ hatası",
    };
  }
}
