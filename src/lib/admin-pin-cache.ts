import type { AppUser } from "@/store/auth";

const STORAGE_KEY = "foxstream-admin-pin-cache-v1";

type PinCache = Record<string, string>;

function storage(): Storage | null {
  try {
    return typeof globalThis.sessionStorage !== "undefined"
      ? globalThis.sessionStorage
      : null;
  } catch {
    return null;
  }
}

function readCache(): PinCache {
  const ss = storage();
  if (!ss) return {};
  try {
    const raw = ss.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PinCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: PinCache): void {
  const ss = storage();
  if (!ss) return;
  try {
    ss.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / private mode */
  }
}

/** Admin panelinde oluşturulan / sıfırlanan PIN (oturum boyunca; sunucu hash döndürmez). */
export function cacheAdminPin(userId: string, pin: string): void {
  const t = pin.trim();
  if (!userId || t.length < 4) return;
  const cache = readCache();
  cache[userId] = t;
  writeCache(cache);
}

export function removeCachedAdminPin(userId: string): void {
  const cache = readCache();
  delete cache[userId];
  writeCache(cache);
}

export function getCachedAdminPin(userId: string): string | undefined {
  return readCache()[userId];
}

/** Sunucudan gelen kullanıcı listesine oturum içi PIN'leri birleştirir. */
export function mergeUsersWithPinCache(
  serverUsers: AppUser[],
  memoryUsers: AppUser[] = []
): AppUser[] {
  const cache = readCache();
  const mem = new Map(memoryUsers.map((u) => [u.id, u.pin]));
  return serverUsers.map((u) => {
    const fromCache = cache[u.id];
    const fromMem = mem.get(u.id)?.trim();
    const pin =
      fromCache ??
      (fromMem && fromMem.length >= 4 && fromMem !== "***" ? fromMem : "");
    return { ...u, pin };
  });
}
