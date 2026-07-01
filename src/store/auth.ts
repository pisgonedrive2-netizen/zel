"use client";

import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { canApplyUserPatch, canDeleteUser, isMainAdmin } from "@/lib/user-guards";
import { routeCapability, hasCapabilityFor } from "@/lib/permissions";
import { resolvePlainPin } from "@/lib/pin-update";
import { logAudit, purgeAuditEntriesForActor, refreshAuditFromServer } from "@/store/audit-log";
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
  /** Marka hesapları için aktif/birincil marka (Brand.id). */
  brandId?: string;
  /** Multi-tenant: bağlı organizasyon. */
  organizationId?: string;
  /** Org içi rol. */
  orgRole?: string;
  /** Erişilen tüm marka id'leri. */
  brandIds?: string[];
  avatar: string;
  /**
   * İnce ayarlı yetki override'ları (yalnızca admin/auditor için anlamlı).
   * Verilmezse rol varsayılanları uygulanır (bkz. `@/lib/permissions`).
   */
  permissions?: import("@/lib/permissions").UserPermissions;
  /** Hesap aktif mi? (admin pasifleştirebilir) */
  active: boolean;
  /** Son giriş zaman damgası (ISO). */
  lastLoginAt?: string;
  /**
   * Denetim/impersonation: bu oturuma ana yönetici "hesabına girerek" geçtiyse,
   * asıl yöneticinin kimliği. Boşsa normal oturum. (Yalnızca aktif oturum için.)
   */
  impersonatorId?: string;
  impersonatorName?: string;
}

/**
 * Başlangıç kullanıcı listesi. Admin PIN'i: "lanetkel2026".
 * Yayıncıların ilk PIN'i: kullanıcı adı + "1234". Admin her zaman PIN'leri
 * sıfırlayabilir veya yeni kullanıcı ekleyebilir.
 *
 * Denetim grubu için ayrı bir kullanıcı: `denetci` / `denetim2026`.
 */
const INITIAL_USERS: AppUser[] = [
  {
    id: "u-admin",
    username: "orkun",
    pin: "lanetkel2026",
    name: "Orkun Bey",
    role: "admin",
    avatar: "O",
    active: true,
    organizationId: "org-foxstream",
    orgRole: "owner",
  },
  { id: "u-ramiz",   username: "ramiz",   pin: "ramiz1234",    name: "Ramiz",         role: "streamer", employeeId: "emp-ramiz",  avatar: "R", active: true },
  { id: "u-lucy",    username: "lucy",    pin: "lucy1234",     name: "Lucy",          role: "streamer", employeeId: "emp-lucy",   avatar: "L", active: false },
  { id: "u-acelya",  username: "acelya",  pin: "acelya1234",   name: "Açelya",        role: "streamer", employeeId: "emp-acelya", avatar: "A", active: false },
  { id: "u-denetci", username: "denetci", pin: "denetim2026",  name: "Denetim Ekibi", role: "auditor",  avatar: "D", active: true },
  { id: "u-ediz",    username: "ediz",    pin: "ediz2026",     name: "Ediz",          role: "admin",    avatar: "E", active: true },
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
  /** `/api/auth/me` tamamlandı mı (Supabase modunda bootstrap bundan sonra). */
  sessionReady: boolean;

  login: (
    username: string,
    pin: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;

  /** Ana yönetici: bir kullanıcının hesabına denetim için gir (impersonation). */
  impersonate: (userId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Denetimden çık — asıl yönetici hesabına geri dön. */
  stopImpersonation: () => Promise<{ ok: true } | { ok: false; error: string }>;

  // Admin actions
  addUser: (u: Omit<AppUser, "id">) => Promise<{ ok: true; user: AppUser } | { ok: false; reason: string }>;
  updateUser: (id: string, patch: Partial<AppUser>) => Promise<{ ok: true } | { ok: false; reason: string }>;
  resetPin: (id: string, newPin: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteUser: (id: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}

/** Oturum kullanıcısını listedeki güncel profille eşle (sidebar / header). */
function syncSessionUser(session: AppUser, row: AppUser): AppUser {
  const base: AppUser = {
    ...session,
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    role: row.role,
    employeeId: row.employeeId,
    brandId: row.brandId,
    permissions: row.permissions,
    active: row.active,
    lastLoginAt: row.lastLoginAt,
    pin: session.pin || row.pin,
    // Org bağlamı yalnızca oturum (session) üzerinden gelir; /api/users satırında
    // bulunmadığından mevcut session değerlerini koruyoruz.
    organizationId: session.organizationId,
    orgRole: session.orgRole,
    brandIds: session.brandIds,
  };
  if (isMainAdmin(base)) {
    return {
      ...base,
      organizationId: base.organizationId ?? "org-foxstream",
      orgRole: "owner",
    };
  }
  return base;
}

const authCreator: StateCreator<AuthState> = (set, get) => {
  const refreshUsersFromServer = async (): Promise<boolean> => {
    const res = await fetch("/api/users", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: AppUser[] };
    if (!data.users) return false;
    set((s) => {
      const users = mergeUsersWithPinCache(data.users!, s.users);
      const row = s.user ? users.find((u) => u.id === s.user!.id) : undefined;
      return {
        users,
        user: row && s.user ? syncSessionUser(s.user, row) : s.user,
      };
    });
    return true;
  };

  return {
      user:  null,
      users: isSupabaseClientMode() ? [] : INITIAL_USERS,
      sessionReady: !isSupabaseClientMode(),

      login: async (username, pin) => {
        // Yeni oturumda eski impersonation state'i taşımayalım.
        try {
          usePanelView.setState({ panelViewAs: null, brandViewAs: null });
        } catch {
          /* SSR */
        }
        const un = username.toLowerCase().trim();
        const pinTrim = pin.trim();
        if (!un || !pinTrim) {
          return { ok: false as const, error: "Kullanıcı adı ve şifre gerekli." };
        }

        /** Canlı/localhost aynı DB — önce sunucu API (NEXT_PUBLIC olmasa bile). */
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: un, pin: pinTrim }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            user?: AppUser;
            error?: string;
          };
          if (res.ok && data.user) {
            set({ user: data.user, sessionReady: true });
            return { ok: true as const };
          }
          if (res.status === 503) {
            /* Supabase kapalı — yalnızca yerel seed kullanıcılar */
          } else if (res.status === 401) {
            return {
              ok: false as const,
              error: data.error ?? "Kullanıcı adı veya şifre hatalı.",
            };
          } else if (res.status >= 500) {
            return {
              ok: false as const,
              error:
                data.error ??
                "Sunucu hatası — `npm run dev` ile yeniden başlatıp tekrar deneyin.",
            };
          } else {
            return {
              ok: false as const,
              error: data.error ?? `Giriş başarısız (${res.status}).`,
            };
          }
        } catch {
          return {
            ok: false as const,
            error:
              "Sunucuya bağlanılamadı — localhost açık mı? (http://127.0.0.1:3000)",
          };
        }

        const pool = [...get().users, ...INITIAL_USERS];
        const seen = new Set<string>();
        const u = pool.find((x) => {
          const key = x.username.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return key === un && x.pin === pinTrim && x.active;
        });
        if (u) {
          const updated = { ...u, lastLoginAt: new Date().toISOString() };
          set((s) => ({
            user: updated,
            users: s.users.some((x) => x.id === u.id)
              ? s.users.map((x) => (x.id === u.id ? updated : x))
              : [...s.users, updated],
            sessionReady: true,
          }));
          return { ok: true as const };
        }
        return {
          ok: false as const,
          error:
            "Kullanıcı adı veya şifre hatalı. (Yerel mod — canlı sitedeki PIN ile aynı olmayabilir.)",
        };
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
        set({ user: null, sessionReady: true });
      },

      impersonate: async (userId) => {
        if (!isSupabaseClientMode()) {
          return { ok: false as const, error: "Hesaba giriş yalnızca canlı (Supabase) modda çalışır." };
        }
        try {
          const res = await fetch("/api/auth/impersonate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ userId }),
          });
          if (!res.ok) {
            return { ok: false as const, error: await readApiError(res) };
          }
          // Önceki impersonation/panel görünümünü temizle, ardından tam yeniden yükle:
          // yeni oturum çerezi ile tüm uygulama (rol, veri, sidebar) yeniden kurulur.
          try {
            usePanelView.setState({ panelViewAs: null, brandViewAs: null });
          } catch {
            /* SSR */
          }
          if (typeof window !== "undefined") window.location.assign("/");
          return { ok: true as const };
        } catch {
          return { ok: false as const, error: "Ağ hatası — hesaba girilemedi." };
        }
      },

      stopImpersonation: async () => {
        if (!isSupabaseClientMode()) {
          return { ok: false as const, error: "Yerel modda denetim oturumu yok." };
        }
        try {
          const res = await fetch("/api/auth/impersonate", {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) {
            return { ok: false as const, error: await readApiError(res) };
          }
          try {
            usePanelView.setState({ panelViewAs: null, brandViewAs: null });
          } catch {
            /* SSR */
          }
          if (typeof window !== "undefined") window.location.assign("/kullanicilar");
          return { ok: true as const };
        } catch {
          return { ok: false as const, error: "Ağ hatası — denetimden çıkılamadı." };
        }
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
                permissions: row.permissions,
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
            const refreshed = await refreshUsersFromServer();
            if (refreshed) {
              set((s) => {
                const row = s.users.find((u) => u.id === id);
                const next: Partial<AuthState> = {};
                if (plainPin) {
                  next.users = s.users.map((u) =>
                    u.id === id ? { ...u, pin: plainPin } : u
                  );
                }
                if (row && s.user?.id === id) {
                  next.user = syncSessionUser(
                    plainPin ? { ...s.user, pin: plainPin } : s.user,
                    row
                  );
                }
                return next;
              });
            } else if (get().user?.id === id) {
              set((s) => ({
                user: { ...s.user!, ...profileOnly, ...(plainPin ? { pin: plainPin } : {}) },
                users: s.users.map((u) =>
                  u.id === id ? { ...u, ...profileOnly, ...(plainPin ? { pin: plainPin } : {}) } : u
                ),
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
            if (prev?.role === "brand" && prev.brandId) {
              const { useStore } = await import("@/store/store");
              const { purgeViewershipCacheForBrands } = await import("@/lib/viewership-cache");
              useStore.getState().deleteBrand(prev.brandId);
              purgeViewershipCacheForBrands([prev.brandId]);
            }
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
          if (prev?.role === "brand" && prev.brandId) {
            const { useStore } = await import("@/store/store");
            const { purgeViewershipCacheForBrands } = await import("@/lib/viewership-cache");
            useStore.getState().deleteBrand(prev.brandId);
            purgeViewershipCacheForBrands([prev.brandId]);
          }
        }
        logAudit({
          actorId: get().user?.id ?? "system",
          actorName: get().user?.name ?? "Bilinmiyor",
          action: "user_deleted",
          detail: `${prev?.name ?? "?"} (${prev?.username ?? id})`,
        });
        // Silinen kişinin işlem günlüğü kayıtları sunucuda da temizlendi; istemci
        // önbelleğini hemen güncelle ki "Eylemi yapan" filtresinde kalmasın.
        purgeAuditEntriesForActor(id);
        void refreshAuditFromServer();
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

  /** Yalnızca ana yönetici (Orkun) — marka/yayıncı/denetçi/diğer adminler erişemez. */
  mainAdminOnly: ["/prim", "/ozet"],
};

export function canAccess(
  pathname: string,
  role: Role | null,
  panelViewAs?: PanelViewAs | null,
  brandViewAs?: BrandViewAs | null,
  user?: Pick<AppUser, "id" | "username" | "impersonatorId" | "permissions"> | null,
): boolean {
  if (ROUTE_ACCESS.public.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (!role) return false;

  // İnce ayarlı yetki: rotanın gerektirdiği sayfa yetkisi (varsa) kontrol edilir.
  // Rol varsayılanları mevcut davranışı korur; kullanıcıya özel override ezer.
  const cap = routeCapability(pathname);
  const hasRouteCap = () =>
    cap === undefined ||
    hasCapabilityFor(
      {
        isMainAdmin: isMainAdmin(user ?? undefined),
        role,
        impersonating: !!user?.impersonatorId,
        permissions: user?.permissions,
      },
      cap,
    );

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
    if (ROUTE_ACCESS.adminBlocked.includes(pathname)) return false;
    return hasRouteCap();
  }
  if (role === "auditor") {
    if (!ROUTE_ACCESS.auditor.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return false;
    }
    return hasRouteCap();
  }
  if (role === "brand") {
    return ROUTE_ACCESS.brand.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  // streamer
  return ROUTE_ACCESS.streamer.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Her rol için varsayılan landing. Özet yalnızca Orkun — diğer adminler maaşlara gider. */
export function landingFor(
  role: Role,
  user?: Pick<AppUser, "id" | "username"> | null,
): string {
  if (role === "admin") {
    return user && isMainAdmin(user) ? "/ozet" : "/maaslar";
  }
  if (role === "auditor") return "/denetci";
  if (role === "brand")   return "/marka/izlenmeler";
  return "/yayinci/maas";
}

/**
 * UI'da CRUD butonlarını gizlemek için. İsteğe bağlı `writeCap` verilirse, o
 * yazma yetkisi olmayan yöneticiler de salt-okunur olur (denetçi her zaman
 * salt-okunur; ana yönetici her zaman tam yetkili).
 */
export function useIsReadOnly(writeCap?: import("@/lib/permissions").Capability): boolean {
  const user = useAuth((s) => s.user);
  if (user && isMainAdmin(user)) return false;
  if (user?.role === "auditor") return true;
  if (writeCap && !hasCapabilityFor({ role: user?.role ?? null, impersonating: !!user?.impersonatorId, permissions: user?.permissions }, writeCap)) {
    return true;
  }
  return false;
}
