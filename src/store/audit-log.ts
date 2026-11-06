"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { isMainAdmin, MAIN_ADMIN_ID, MAIN_ADMIN_USERNAME } from "@/lib/user-guards";

export type AuditAction =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "user_pin_reset"
  | "expense_approved"
  | "expense_rejected"
  | "expense_needs_info"
  | "expense_settlement"
  | "expense_team_release"
  | "expense_month_lock"
  | "backup_exported"
  | "backup_imported"
  | "user_impersonated"
  | "user_impersonation_stopped"
  | "session_idle_logout"
  | "screen_share_toggled";

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  detail: string;
}

interface AuditState {
  entries: AuditEntry[];
  /** Son 500 kayıt tutulur. */
  push: (e: Omit<AuditEntry, "id" | "at">) => void;
  clear: () => void;
}

export const useAuditLog = create<AuditState>()(
  persist(
    (set) => ({
      entries: [],
      push: (e) =>
        set((s) => ({
          entries: [
            { ...e, id: crypto.randomUUID(), at: new Date().toISOString() },
            ...s.entries,
          ].slice(0, 500),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: "lanetkel-audit-v1" }
  )
);

/** Aktör ana yönetici (Orkun) mu? */
export function isMainAdminAuditActor(e: {
  actorId?: string;
  actorName?: string;
}): boolean {
  if (e.actorId === MAIN_ADMIN_ID) return true;
  const n = (e.actorName ?? "").toLowerCase().trim();
  return n === MAIN_ADMIN_USERNAME || n === "orkun";
}

/**
 * Orkun’un logları yalnızca Orkun’a görünür.
 * Diğer admin / denetçi / yerel persist sızıntısı burada kesilir.
 */
export function filterAuditVisibleToViewer<T extends { actorId?: string; actorName?: string }>(
  entries: readonly T[],
  viewer: { id?: string; username?: string } | null | undefined,
): T[] {
  if (viewer?.id && viewer?.username && isMainAdmin({ id: viewer.id, username: viewer.username })) {
    return [...entries];
  }
  return entries.filter((e) => !isMainAdminAuditActor(e));
}

export function logAudit(entry: Omit<AuditEntry, "id" | "at">): void {
  useAuditLog.getState().push(entry);
  if (isSupabaseClientMode() && typeof fetch !== "undefined") {
    void fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }
}

/** Belirli bir aktöre ait yerel kayıtları kaldırır (örn. kullanıcı silinince). */
export function purgeAuditEntriesForActor(actorId: string): void {
  useAuditLog.setState((s) => ({
    entries: s.entries.filter((e) => e.actorId !== actorId),
  }));
}

/** İşlem günlüğünü sunucudan tazeler — silme/temizleme sonrası anında yansıması için. */
export async function refreshAuditFromServer(): Promise<void> {
  if (!isSupabaseClientMode() || typeof fetch === "undefined") return;
  try {
    const res = await fetch("/api/audit", { cache: "no-store", credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { entries?: AuditEntry[] };
    if (Array.isArray(data.entries)) {
      useAuditLog.setState({ entries: data.entries });
    }
  } catch {
    /* sessiz */
  }
}
