"use client";

import { isSupabaseClientMode } from "@/lib/supabase-client";
import {
  useStore,
  visibleNotificationsForRole,
  type AppNotification,
} from "@/store/store";

function newNotificationId(): string {
  return `n-${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Bildirimi anında Supabase'e yazar ve store'a ekler.
 * Yayıncıya giden plan / mesaj bildirimleri sync beklenmeden ulaşır.
 */
export async function createNotificationPersisted(
  n: Omit<AppNotification, "id" | "createdAt" | "read">
): Promise<AppNotification> {
  const local: AppNotification = {
    ...n,
    id: newNotificationId(),
    createdAt: new Date().toISOString(),
    read: false,
  };

  if (!isSupabaseClientMode()) {
    useStore.setState((s) => ({
      notifications: [local, ...s.notifications].slice(0, 500),
    }));
    return local;
  }

  try {
    const res = await fetch("/api/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: n.title,
        message: n.message,
        forRole: n.forRole,
        forUserId: n.forUserId,
        type: n.type,
        href: n.href,
        refId: n.refId,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { notification: AppNotification };
    const saved = data.notification ?? local;
    useStore.setState((s) => ({
      notifications: [saved, ...s.notifications.filter((x) => x.id !== saved.id)].slice(0, 500),
    }));
    return saved;
  } catch {
    useStore.getState().pushNotification(n);
    return local;
  }
}

/** Sunucudan bildirim listesini çeker ve store'u günceller. */
export async function refreshNotificationsFromServer(): Promise<boolean> {
  if (!isSupabaseClientMode()) return false;
  try {
    const res = await fetch("/api/notifications?limit=200", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { notifications?: AppNotification[] };
    if (data.notifications) {
      useStore.setState({ notifications: data.notifications });
    }
    return true;
  } catch {
    return false;
  }
}

/** Yayıncı / marka: kendi bildirimlerini çekip store'a yazar (diğer rollerin kayıtlarını korur). */
export async function refreshMyNotificationsFromServer(
  role: "streamer" | "brand",
  userId: string
): Promise<boolean> {
  if (!isSupabaseClientMode()) return false;
  try {
    const res = await fetch("/api/notifications?limit=200", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { notifications?: AppNotification[] };
    const mine = (data.notifications ?? []).filter(
      (n) => n.forRole === role && (!n.forUserId || n.forUserId === userId)
    );
    useStore.setState((s) => {
      const rest = s.notifications.filter((n) => n.forRole !== role);
      return { notifications: [...mine, ...rest].slice(0, 500) };
    });
    return true;
  } catch {
    return false;
  }
}

/** Görünür okunmamış sayısı (rol filtresi uygulanmış). */
export function myUnreadNotificationCount(
  role: "streamer" | "brand",
  userId: string
): number {
  const { notifications } = useStore.getState();
  return visibleNotificationsForRole(notifications, role, userId).filter((n) => !n.read).length;
}

/**
 * Tek bildirimi okundu işaretle.
 * Önce Supabase'e yazar, başarılıysa store'u günceller — böylece
 * yenileme sonrası "geri gelme" bug'ı oluşmaz.
 */
export async function markNotificationReadPersisted(id: string): Promise<boolean> {
  if (!isSupabaseClientMode()) {
    useStore.getState().markNotificationRead(id);
    return true;
  }
  try {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    if (!res.ok) return false;
    useStore.getState().markNotificationRead(id);
    return true;
  } catch {
    return false;
  }
}

/** Bildirim merkezi: listedeki tüm bildirimleri okundu işaretle (admin/denetçi paneli). */
export async function markAllPanelNotificationsReadPersisted(): Promise<boolean> {
  if (!isSupabaseClientMode()) {
    useStore.setState((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    return true;
  }
  try {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true, markAllPanel: true }),
    });
    if (!res.ok) return false;
    useStore.setState((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    return true;
  } catch {
    return false;
  }
}

/** Rol için tümünü okundu işaretle. */
export async function markAllNotificationsReadPersisted(
  forRole: AppNotification["forRole"],
  forUserId?: string
): Promise<boolean> {
  if (!isSupabaseClientMode()) {
    useStore.getState().markAllNotificationsRead(forRole, forUserId);
    return true;
  }
  try {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true, forRole, forUserId }),
    });
    if (!res.ok) return false;
    useStore.getState().markAllNotificationsRead(forRole, forUserId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bildirimi kalıcı sil.
 * Önce Supabase'e DELETE atar; sadece sunucu onayladıktan sonra
 * yerel store'dan kaldırır. Aksi halde "anlık silindi, sonra geri geldi"
 * sorunları yaşanıyordu.
 */
export async function deleteNotificationPersisted(id: string): Promise<boolean> {
  if (!isSupabaseClientMode()) {
    useStore.getState().deleteNotification(id);
    return true;
  }
  try {
    const res = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok && res.status !== 404) return false;
    useStore.getState().deleteNotification(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Birden çok bildirimi tek seferde sil.
 * Her birini sırayla siler, başarısız olanları geri döner.
 */
export async function deleteNotificationsPersisted(ids: string[]): Promise<{ deleted: number; failed: number }> {
  if (ids.length === 0) return { deleted: 0, failed: 0 };
  if (!isSupabaseClientMode()) {
    useStore.setState((s) => ({
      notifications: s.notifications.filter((n) => !ids.includes(n.id)),
    }));
    return { deleted: ids.length, failed: 0 };
  }
  try {
    const res = await fetch("/api/notifications", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const results = await Promise.all(ids.map((id) => deleteNotificationPersisted(id)));
      const deleted = results.filter(Boolean).length;
      return { deleted, failed: ids.length - deleted };
    }
    const data = (await res.json()) as { deleted?: number };
    const deleted = data.deleted ?? ids.length;
    useStore.setState((s) => ({
      notifications: s.notifications.filter((n) => !ids.includes(n.id)),
    }));
    return { deleted, failed: Math.max(0, ids.length - deleted) };
  } catch {
    const results = await Promise.all(ids.map((id) => deleteNotificationPersisted(id)));
    const deleted = results.filter(Boolean).length;
    return { deleted, failed: ids.length - deleted };
  }
}
