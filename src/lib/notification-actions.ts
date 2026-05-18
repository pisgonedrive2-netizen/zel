"use client";

import { isSupabaseClientMode } from "@/lib/supabase-client";
import { useStore, type AppNotification } from "@/store/store";

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

/** Tek bildirimi okundu işaretle (Supabase + store). */
export async function markNotificationReadPersisted(id: string): Promise<void> {
  useStore.getState().markNotificationRead(id);
  if (!isSupabaseClientMode()) return;
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
  } catch {
    /* store güncellendi */
  }
}

/** Rol için tümünü okundu işaretle. */
export async function markAllNotificationsReadPersisted(
  forRole: AppNotification["forRole"],
  forUserId?: string
): Promise<void> {
  useStore.getState().markAllNotificationsRead(forRole, forUserId);
  if (!isSupabaseClientMode()) return;
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true, forRole, forUserId }),
    });
  } catch {
    /* store güncellendi */
  }
}

/** Bildirimi sil (yalnızca yönetici). */
export async function deleteNotificationPersisted(id: string): Promise<void> {
  useStore.getState().deleteNotification(id);
  if (!isSupabaseClientMode()) return;
  try {
    await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    /* store güncellendi */
  }
}
