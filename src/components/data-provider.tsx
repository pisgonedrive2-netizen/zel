"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registerSyncFlushHandler } from "@/lib/sync-client";
import { Loader2 } from "lucide-react";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import {
  useStore,
  APP_SNAPSHOT_KEYS,
  reconcileRentExtrasForAllEmployees,
  type AppHydratePayload,
  type Employee,
  type SalaryExtra,
} from "@/store/store";
import { useAuth } from "@/store/auth";
import { useAuditLog, type AuditEntry } from "@/store/audit-log";

const SYNC_MS = 900;

function pickStoreSnapshot(): AppHydratePayload {
  const s = useStore.getState();
  const out: AppHydratePayload = {};
  for (const k of APP_SNAPSHOT_KEYS) {
    (out as Record<string, unknown>)[k] = s[k];
  }
  return out;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabaseMode = isSupabaseClientMode();
  const user = useAuth((s) => s.user);
  const [ready, setReady] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [bootstrapOk, setBootstrapOk] = useState(!supabaseMode);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSync = useRef(true);
  const syncInFlight = useRef(false);

  const runSyncNow = useCallback(async () => {
    if (!supabaseMode || !user || !ready || !bootstrapOk || skipSync.current) return;
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pickStoreSnapshot()),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = data.error ?? `Senkronizasyon başarısız (${res.status})`;
        setSyncError(msg);
        console.error("Sync failed:", msg);
        return;
      }
      setSyncError(null);
      const st = useStore.getState();
      const fixedExtras = reconcileRentExtrasForAllEmployees(st.employees, st.salaryExtras);
      if (fixedExtras !== st.salaryExtras) {
        skipSync.current = true;
        useStore.setState({ salaryExtras: fixedExtras });
        setTimeout(() => {
          skipSync.current = false;
        }, 500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ağ hatası";
      setSyncError(`Veriler sunucuya kaydedilemedi: ${msg}`);
      console.error("Sync failed:", e);
    } finally {
      syncInFlight.current = false;
    }
  }, [supabaseMode, user, ready, bootstrapOk]);

  useEffect(() => {
    if (!supabaseMode) {
      // localStorage modunda da sözleşme kirası ↔ kira kalemi uyumunu onar.
      const s = useStore.getState();
      const fixed = reconcileRentExtrasForAllEmployees(s.employees, s.salaryExtras);
      if (fixed !== s.salaryExtras) {
        skipSync.current = true;
        useStore.setState({ salaryExtras: fixed });
        setTimeout(() => { skipSync.current = false; }, 500);
      }
      setReady(true);
      return;
    }
    if (!user) {
      setReady(true);
      setBootstrapOk(false);
      skipSync.current = true;
      return;
    }

    let cancelled = false;
    setBootstrapOk(false);
    skipSync.current = true;
    const emptyPatch: Record<string, unknown> = {};
    for (const k of APP_SNAPSHOT_KEYS) emptyPatch[k] = [];
    useStore.setState(emptyPatch);
    (async () => {
      try {
        const res = await fetch("/api/bootstrap", { credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as AppHydratePayload & { users?: unknown[] };
        if (cancelled) return;
        const patch: Record<string, unknown> = {};
        for (const k of APP_SNAPSHOT_KEYS) {
          if (data[k] !== undefined) patch[k] = data[k];
        }
        const employees = (patch.employees ?? useStore.getState().employees) as Employee[];
        const salaryExtras = (patch.salaryExtras ?? useStore.getState().salaryExtras) as SalaryExtra[];
        patch.salaryExtras = reconcileRentExtrasForAllEmployees(employees, salaryExtras);
        useStore.setState(patch);
        if (data.users && user.role === "admin") {
          useAuth.setState({ users: data.users as ReturnType<typeof useAuth.getState>["users"] });
        }
        if (user.role === "admin" || user.role === "auditor") {
          try {
            const audRes = await fetch("/api/audit", { credentials: "include" });
            if (audRes.ok) {
              const aud = (await audRes.json()) as { entries: AuditEntry[] };
              useAuditLog.setState({ entries: aud.entries });
            }
          } catch { /* sessizce yut */ }
        }
        skipSync.current = true;
        setReady(true);
        setBootstrapOk(true);
        setTimeout(() => { skipSync.current = false; }, 500);
      } catch (e) {
        console.error("Bootstrap failed:", e);
        setReady(true);
        setBootstrapOk(false);
        setSyncError(
          "İlk yükleme başarısız oldu. Sunucu kaydı bu oturumda devre dışı bırakıldı — sayfayı yenileyin."
        );
      }
    })();

    return () => { cancelled = true; };
  }, [supabaseMode, user?.id]);

  useEffect(() => {
    registerSyncFlushHandler(() => {
      void runSyncNow();
    });
    return () => registerSyncFlushHandler(null);
  }, [runSyncNow]);

  useEffect(() => {
    if (!supabaseMode || !user || !ready || !bootstrapOk) return;

    const onPageHide = () => {
      if (skipSync.current || syncTimer.current == null) return;
      void runSyncNow();
    };
    window.addEventListener("pagehide", onPageHide);

    const unsub = useStore.subscribe(() => {
      if (skipSync.current) return;
      if (!bootstrapOk) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        void runSyncNow();
      }, SYNC_MS);
    });

    return () => {
      unsub();
      window.removeEventListener("pagehide", onPageHide);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [supabaseMode, user?.id, ready, bootstrapOk, runSyncNow]);

  if (!ready && supabaseMode) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {syncError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[70] w-[min(100%-2rem,32rem)] -translate-x-1/2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-500/50 dark:bg-red-950/90 dark:text-red-100"
        >
          <p className="font-medium">Supabase kaydı başarısız</p>
          <p className="text-xs mt-1 opacity-90">{syncError}</p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => setSyncError(null)}
          >
            Kapat
          </button>
        </div>
      )}
      {children}
    </>
  );
}
