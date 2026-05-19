"use client";

import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { canApplyUserPatch, canDeleteUser } from "@/lib/user-guards";
import { resolvePlainPin } from "@/lib/pin-update";
import { logAudit } from "@/store/audit-log";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { cacheAdminPin, mergeUsersWithPinCache, removeCachedAdminPin } from "@/lib/admin-pin-cache";
import { usePanelView, type BrandViewAs, type PanelViewAs } from "@/store/panel-view";

export type Role = "admin" | "streamer" | "auditor" | "brand";

export interface AppUser {
  id: string;
  username: string;
  pin: string;          // basit PIN (4-12 karakter)
  name: string;
  role: Role;
  /** Yayıncılar için Employee tablosundaki id. */
  employeeId?: string;
  /** Marka hesapları için hangi markaya bağlı (Brand.id). */
  brandId?: string;
  avatar: string;
  /** Hesap aktif mi? (admin pasifleştirebilir) */
  active: boolean;
  /** Son giriş zaman damgası (ISO). */
  lastLoginAt?: string;
}

/**
 * Başlangıç kullanıcı listesi. Admin PIN'i: "lanetkel2026".
 * Yayıncıların ilk PIN'i: kullanıcı adı + "1234". Admin her zaman PIN'leri
 * sıfırlayabilir veya yeni kullanıcı ekleyebilir.
 *
 * Denetim grubu için ayrı bir kullanıcı: `denetci` / `denetim2026`.
 */
const INITIAL_USERS: AppUser[] = [
  { id: "u-admin",   username: "orkun",   pin: "lanetkel2026", name: "Orkun Bey",     role: "admin",    avatar: "O", active: true },
  { id: "u-ramiz",   username: "ramiz",   pin: "ramiz1234",    name: "Ramiz",         role: "streamer", employeeId: "emp-ramiz",  avatar: "R", active: true },
  { id: "u-lucy",    username: "lucy",    pin: "lucy1234",     name: "Lucy",          role: "streamer", employeeId: "emp-lucy",   avatar: "L", active: true },
  { id: "u-acelya",  username: "acelya",  pin: "acelya1234",   name: "Açelya",        role: "streamer", employeeId: "emp-acelya", avatar: "A", active: true },
  { id: "u-denetci", username: "denetci", pin: "denetim2026",  name: "Denetim Ekibi", role: "auditor",  avatar: "D", active: true },
  { id: "u-brand-gala",    username: "galabet",    pin: "marka2026", name: "Galabet (Marka)",    role: "brand", brandId: "br-gala",    avatar: "G", active: true },
  { id: "u-brand-boffice", username: "betoffice",  pin: "marka2026", name: "Betoffice (Marka)",  role: "brand", brandId: "br-boffice", avatar: "B", active: true },
  { id: "u-brand-pipo",    username: "betpipo",    pin: "marka2026", name: "Betpipo (Marka)",    role: "brand", brandId: "br-pipo",    avatar: "P", active: true },
  { id: "u-brand-hit",     username: "hitbet",     pin: "marka2026", name: "Hitbet (Marka)",     role: "brand", brandId: "br-hit",     avatar: "H", active: true },
  { id: "u-brand-padi",    username: "padisahbet", pin: "marka2026", name: "Padişahbet (Marka)", role: "brand", brandId: "br-padi",    avatar: "P", active: true },
];

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Sunucu hatası (${res.status})`;
  } catch {
    return `Sunucu hatası (${res.status})`;
  }
}

/** 8 karakterli okunaklı PIN üretir (0/O, l/I gibi karışan karakterler hariç). */
export function generatePin(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface AuthState {
  /** Şu an oturum açmış kullanıcı (null = login ekranı gösterilir). */
  user: AppUser | null;
  /** Tüm kayıtlı kullanıcılar. Admin yeni ekleyebilir / PIN sıfırlayabilir. */
  users: AppUser[];

  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Admin actions
  addUser: (u: Omit<AppUser, "id">) => Promise<{ ok: true; user: AppUser } | { ok: false; reason: string }>;
  updateUser: (id: string, patch: Partial<AppUser>) => Promise<{ ok: true } | { ok: false; reason: string }>;
  resetPin: (id: string, newPin: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteUser: (id: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}

const authCreator: StateCreator<AuthState> = (set, get) => {
  const refreshUsersFromServer = async (): Promise<boolean> => {
    const res = await fetch("/api/users", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: AppUser[] };
    if (!data.users) return false;
    set((s) => ({
      users: mergeUsersWithPinCache(data.users!, s.users),
    }));
    return true;
  };

  return {
      user:  null,
      users: isSupabaseClientMode() ? [] : INITIAL_USERS,

      login: async (username, pin) => {
        // Yeni oturumda eski impersonation state'i taşımayalım.
        try {
          usePanelView.setState({ panelViewAs: null, brandViewAs: null });
        } catch {
          /* SSR */
        }
        if (isSupabaseClientMode()) {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, pin }),
          });
          if (!res.ok) return false;
          const data = (await res.json()) as { user: AppUser };
          set({ user: data.user });
          return true;
        }
        const u = get().users.find(
          (x) => x.username.toLowerCase().trim() === username.toLowerCase().trim() &&
                 x.pin === pin.trim() &&
                 x.active
        );
        if (u) {
          const updated = { ...u, lastLoginAt: new Date().toISOString() };
          set((s) => ({
            user:  updated,
            users: s.users.map((x) => (x.id === u.id ? updated : x)),
          }));
          return true;
        }
        return false;
      },
      logout: async () => {
        if (isSupabaseClientMode()) {
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        }
        try {
          usePanelView.setState({ panelViewAs: null, brandViewAs: null });
        } catch {
          /* SSR güvenliği */
        }
        set({ user: null });
      },

      addUser: async (u) => {
        const actor = get().user;
        const uname = u.username.toLowerCase().trim();
        if (get().users.some((x) => x.username.toLowerCase().trim() === uname)) {
          return { ok: false as const, reason: "Bu kullanıcı adı zaten kayıtlı." };
        }
        const tempId = `u-${crypto.randomUUID().slice(0, 8)}`;
        const row: AppUser = { ...u, id: tempId, username: uname, pin: u.pin };
        if (isSupabaseClientMode()) {
          try {
            const res = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                id: tempId,
                username: row.username,
                name: row.name,
                role: row.role,
                employeeId: row.employeeId,
                brandId: row.brandId,
                avatar: row.avatar,
                active: row.active,
                pin: u.pin,
              }),
            });
            if (!res.ok) {
              return { ok: false as const, reason: await readApiError(res) };
            }
            const data = (await res.json()) as { user?: AppUser };
            if (!data.user) {
              return { ok: false as const, reason: "Sunucu kullanıcı döndürmedi." };
            }
            const saved: AppUser = { ...data.user, pin: u.pin };
            cacheAdminPin(saved.id, u.pin);
            await refreshUsersFromServer();
            logAudit({
              actorId: actor?.id ?? "system",
              actorName: actor?.name ?? "Bilinmiyor",
              action: "user_created",
              detail: `${saved.name} (${saved.username}) · ${saved.role}`,
            });
            return { ok: true as const, user: saved };
          } catch {
            return {
              ok: false as const,
              reason: "Ağ hatası — kullanıcı Supabase'e kaydedilemedi. Tekrar deneyin.",
            };
          }
        }
        set((s) => ({ users: [...s.users, row] }));
        logAudit({
          actorId: actor?.id ?? "system",
          actorName: actor?.name ?? "Bilinmiyor",
          action: "user_created",
          detail: `${row.name} (${row.username}) · ${row.role}`,
        });
        return { ok: true as const, user: row };
      },

      updateUser: async (id, patch) => {
        let nextPatch = patch;
        if (patch.username !== undefined) {
          const un = patch.username.toLowerCase().trim();
          if (get().users.some((x) => x.id !== id && x.username.toLowerCase().trim() === un)) {
            return { ok: false as const, reason: "Bu kullanıcı adı zaten kayıtlı." };
          }
          nextPatch = { ...patch, username: un };
        }
        const guard = canApplyUserPatch(get().users, id, nextPatch);
        if (!guard.ok) return { ok: false as const, reason: guard.reason };
        const prev = get().users.find((x) => x.id === id);
        const plainPin = resolvePlainPin(nextPatch);
        const { pin: _p, newPin: _n, ...profileOnly } = nextPatch as Partial<AppUser> & { newPin?: string };
        const apiBody: Record<string, unknown> = { ...profileOnly };
        if (plainPin) apiBody.newPin = plainPin;
        const safe = { ...profileOnly };
        if (plainPin) (safe as { newPin?: string }).newPin = "***";
        if (isSupabaseClientMode()) {
          try {
            const res = await fetch(`/api/users/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(apiBody),
            });
            if (!res.ok) {
              return { ok: false as const, reason: await readApiError(res) };
            }
            const data = (await res.json()) as { pinUpdated?: boolean };
            if (plainPin && !data.pinUpdated) {
              return {
                ok: false as const,
                reason: "PIN sunucuya yazılamadı. Alanı tekrar doldurup kaydedin veya PIN sıfırla.",
              };
            }
            if (plainPin) cacheAdminPin(id, plainPin);
            await refreshUsersFromServer();
            if (plainPin) {
              set((s) => ({
                users: s.users.map((u) => (u.id === id ? { ...u, pin: plainPin } : u)),
              }));
            }
          } catch {
            return {
              ok: false as const,
              reason: "Ağ hatası — güncelleme Supabase'e yazılamadı.",
            };
          }
        } else {
          const localPatch = { ...profileOnly } as Partial<AppUser>;
          if (plainPin) localPatch.pin = plainPin;
          set((s) => ({
            users: s.users.map((u) => (u.id === id ? { ...u, ...localPatch } : u)),
            user: s.user?.id === id ? { ...s.user, ...localPatch } : s.user,
          }));
        }
        logAudit({
          actorId: get().user?.id ?? "system",
          actorName: get().user?.name ?? "Bilinmiyor",
          action: "user_updated",
          detail: `${prev?.name ?? id}: ${JSON.stringify(safe)}`,
        });
        return { ok: true as const };
      },

      resetPin: async (id, newPin) => {
        const actor = get().user;
        const u = get().users.find((x) => x.id === id);
        const trimmed = newPin.trim();
        if (!trimmed) {
          return { ok: false as const, reason: "PIN boş olamaz." };
        }
        if (isSupabaseClientMode()) {
          try {
            const res = await fetch(`/api/users/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ newPin: trimmed }),
            });
            if (!res.ok) {
              return { ok: false as const, reason: await readApiError(res) };
            }
            const data = (await res.json()) as { pinUpdated?: boolean };
            if (!data.pinUpdated) {
              return {
                ok: false as const,
                reason: "PIN sunucuya yazılamadı. Tekrar deneyin.",
              };
            }
            cacheAdminPin(id, trimmed);
            await refreshUsersFromServer();
            set((s) => ({
              users: s.users.map((x) => (x.id === id ? { ...x, pin: trimmed } : x)),
            }));
          } catch {
            return {
              ok: false as const,
              reason: "Ağ hatası — PIN Supabase'e yazılamadı.",
            };
          }
        } else {
          set((s) => ({
            users: s.users.map((x) => (x.id === id ? { ...x, pin: trimmed } : x)),
          }));
        }
        logAudit({
          actorId: actor?.id ?? "system",
          actorName: actor?.name ?? "Bilinmiyor",
          action: "user_pin_reset",
          detail: u ? `${u.username}` : id,
        });
        return { ok: true as const };
      },

      deleteUser: async (id) => {
        const guard = canDeleteUser(get().users, id);
        if (!guard.ok) return { ok: false as const, reason: guard.reason };
        const prev = get().users.find((u) => u.id === id);
        if (isSupabaseClientMode()) {
          try {
            const res = await fetch(`/api/users/${id}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!res.ok) {
              return { ok: false as const, reason: await readApiError(res) };
            }
            removeCachedAdminPin(id);
            await refreshUsersFromServer();
          } catch {
            return {
              ok: false as const,
              reason: "Ağ hatası — silme Supabase'e yazılamadı.",
            };
          }
        } else {
          removeCachedAdminPin(id);
          set((s) => ({
            users: s.users.filter((u) => u.id !== id),
            user: s.user?.id === id ? null : s.user,
          }));
        }
        logAudit({
          actorId: get().user?.id ?? "system",
          actorName: get().user?.name ?? "Bilinmiyor",
          action: "user_deleted",
          detail: `${prev?.name ?? "?"} (${prev?.username ?? id})`,
        });
        return { ok: true as const };
      },
  };
};

const authPersistConfig = {
      name: "lanetkel-auth-v3-brand",
      merge: (persistedState: unknown, currentState: AuthState) => {
        const p = (persistedState ?? {}) as Partial<AuthState>;
        const merged: AuthState = {
          ...currentState,
          ...p,
          user: p.user ?? currentState.user,
          users: p.users ?? currentState.users,
        };
        const users = merged.users ?? [];
        const seen = new Set(users.map((u) => u.username.toLowerCase()));
        const extra = INITIAL_USERS.filter((u) => !seen.has(u.username.toLowerCase()));
        return {
          ...merged,
          users: [...users, ...extra],
        };
      },
    } as const;

export const useAuth = isSupabaseClientMode()
  ? create<AuthState>()(authCreator)
  : create<AuthState>()(persist(authCreator, authPersistConfig));

/** Hangi rotalara hangi rol erişebilir? */
export const ROUTE_ACCESS = {
  /** Auth gerekmiyor. */
  public: ["/login"],

  /** Yayıncı sadece bu rotalara erişebilir. */
  streamer: ["/yayinci"],

  /** Denetçi (read-only) erişim alanı. */
  auditor: [
    "/denetci",
    "/bildirimler",
    "/kasa",
    "/icerik-harcamalari",
    "/maaslar",
    "/rapor",
    "/giderler",
    "/dis-gelir",
    "/izlenme",
  ],

  /** Marka partneri — yalnızca yayın takvimi + kendi marka izlenmeleri. */
  brand: ["/marka"],

  /** Admin tüm rotalara erişebilir; ek olarak login dışındaki her şey. */
  adminBlocked: ["/login"],
};

export function canAccess(
  pathname: string,
  role: Role | null,
  panelViewAs?: PanelViewAs | null,
  brandViewAs?: BrandViewAs | null
): boolean {
  if (ROUTE_ACCESS.public.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (!role) return false;
  if (role === "admin") {
    if (
      panelViewAs &&
      ROUTE_ACCESS.streamer.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
      return true;
    }
    if (
      brandViewAs &&
      ROUTE_ACCESS.brand.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
      return true;
    }
    return !ROUTE_ACCESS.adminBlocked.includes(pathname);
  }
  if (role === "auditor") {
    return ROUTE_ACCESS.auditor.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  if (role === "brand") {
    return ROUTE_ACCESS.brand.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  // streamer
  return ROUTE_ACCESS.streamer.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Her rol için varsayılan landing. */
export function landingFor(role: Role): string {
  if (role === "admin")   return "/ozet";
  if (role === "auditor") return "/denetci";
  if (role === "brand")   return "/marka/operasyon";
  return "/yayinci/maas";
}

/** UI'da CRUD butonlarını gizlemek için. */
export function useIsReadOnly(): boolean {
  const role = useAuth((s) => s.user?.role);
  return role === "auditor";
}
