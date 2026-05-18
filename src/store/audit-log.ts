"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isSupabaseClientMode } from "@/lib/supabase-client";

export type AuditAction =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "user_pin_reset"
  | "expense_approved"
  | "expense_rejected"
  | "expense_needs_info"
  | "backup_exported"
  | "backup_imported"
  | "session_idle_logout";

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
