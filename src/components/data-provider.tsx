"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  type ContentExpense,
  type Brand,
  type BrandLink,
} from "@/store/store";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import { filterBrandLinksWithValidBrands } from "@/lib/brand-links-sync";
import { useAuth } from "@/store/auth";
import { useAuditLog, type AuditEntry } from "@/store/audit-log";
import { SYNC_ERROR_EVENT } from "@/lib/sync-notify";
import { RELOAD_VIEWERSHIP_EVENT } from "@/lib/viewership-reload";

const SYNC_MS = 900;
const BOOTSTRAP_RETRIES = 3;

async function fetchJsonWithRetry(
  url: string,
  opts?: RequestInit
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < BOOTSTRAP_RETRIES; i++) {
    const res = await fetch(url, { cache: "no-store", ...opts });
    last = res;
    if (res.ok || res.status === 401) return res;
    if (i < BOOTSTRAP_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    }
  }
  return last!;
}

function applyViewershipToPatch(
  patch: Record<string, unknown>,
  data: Pick<AppHydratePayload, "brands" | "brandLinks" | "linkSnapshots" | "brandViewership">
) {
  if (data.brands !== undefined) patch.brands = data.brands;
  if (data.brandLinks !== undefined) {
    const brands = (patch.brands ?? useStore.getState().brands) as Brand[];
    const brandIdSet = new Set(brands.map((b) => b.id));
    patch.brandLinks = filterBrandLinksWithValidBrands(data.brandLinks, brandIdSet);
  }
  if (data.linkSnapshots !== undefined) patch.linkSnapshots = data.linkSnapshots;
  if (data.brandViewership !== undefined) patch.brandViewership = data.brandViewership;
}

/** Toplu sync'e dahil edilmeyen anahtarlar (sunucu/API ile yazılır). */
const SYNC_EXCLUDE_KEYS = new Set<string>(["linkSnapshots", "brandViewership"]);

function pickStoreSnapshot(): AppHydratePayload {
  const s = useStore.getState();
  const out: AppHydratePayload = {};
  for (const k of APP_SNAPSHOT_KEYS) {
    if (SYNC_EXCLUDE_KEYS.has(k)) continue;
    (out as Record<string, unknown>)[k] = s[k];
  }
  out.salaryExtras = dedupeSalaryExtrasByContentExpense(
    s.salaryExtras,
    s.contentExpenses
  );
  const brands = s.brands as Brand[];
  const brandIds = new Set(brands.map((b) => b.id));
  out.brandLinks = filterBrandLinksWithValidBrands(
    s.brandLinks as BrandLink[],
    brandIds
  );
  return out;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabaseMode = isSupabaseClientMode();
  const user = useAuth((s) => s.user);
  const sessionReady = useAuth((s) => s.sessionReady);
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";
  const router = useRouter();
  const [ready, setReady] = useState(!supabaseMode);
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
        setSyncError(
          res.status === 401
            ? `${msg} — çıkış yapıp tekrar giriş yapın.`
            : msg
        );
        console.error("Sync failed:", msg);
        return;
      }
      setSyncError(null);
      const st = useStore.getState();
      let fixedExtras = dedupeSalaryExtrasByContentExpense(
        st.salaryExtras,
        st.contentExpenses
      );
      fixedExtras = reconcileRentExtrasForAllEmployees(st.employees, fixedExtras);
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

  /** Oturum kontrolü — children'ı bloklamadan burada yapılır (AuthShell deadlock önlenir). */
  useEffect(() => {
    if (!supabaseMode || sessionReady) return;
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { user: typeof user }) => {
        if (cancelled) return;
        useAuth.setState({ user: data.user ?? null, sessionReady: true });
      })
      .catch(() => {
        if (!cancelled) useAuth.setState({ user: null, sessionReady: true });
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseMode, sessionReady]);

  useEffect(() => {
    if (!supabaseMode) {
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

    if (!sessionReady) return;

    if (!user) {
      setReady(true);
      setBootstrapOk(false);
      skipSync.current = true;
      return;
    }

    let cancelled = false;
    setBootstrapOk(false);
    skipSync.current = true;
    setReady(false);

    (async () => {
      try {
        const res = await fetchJsonWithRetry("/api/bootstrap", {
          credentials: "include",
        });
        if (res.status === 401) {
          throw new Error("Oturum gerekli — lütfen tekrar giriş yapın");
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Bootstrap (${res.status})`);
        }
        const data = (await res.json()) as AppHydratePayload & { users?: unknown[] };
        if (cancelled) return;
        const patch: Record<string, unknown> = {};
        for (const k of APP_SNAPSHOT_KEYS) {
          if (data[k] !== undefined) patch[k] = data[k];
        }
        const employees = (patch.employees ?? useStore.getState().employees) as Employee[];
        const contentExpenses = (patch.contentExpenses ??
          useStore.getState().contentExpenses) as ContentExpense[];
        let salaryExtras = dedupeSalaryExtrasByContentExpense(
          (patch.salaryExtras ?? useStore.getState().salaryExtras) as SalaryExtra[],
          contentExpenses
        );
        salaryExtras = reconcileRentExtrasForAllEmployees(employees, salaryExtras);
        patch.salaryExtras = salaryExtras;
        const brandsBoot = (patch.brands ?? []) as Brand[];
        const brandIdSet = new Set(brandsBoot.map((b) => b.id));
        if (patch.brandLinks) {
          patch.brandLinks = filterBrandLinksWithValidBrands(
            patch.brandLinks as BrandLink[],
            brandIdSet
          );
        }
        const snapCount = Array.isArray(patch.linkSnapshots)
          ? (patch.linkSnapshots as unknown[]).length
          : 0;
        if (snapCount === 0) {
          try {
            const vr = await fetchJsonWithRetry("/api/bootstrap/viewership", {
              credentials: "include",
            });
            if (vr.ok) {
              const vd = (await vr.json()) as Pick<
                AppHydratePayload,
                "brands" | "brandLinks" | "linkSnapshots" | "brandViewership"
              >;
              if (Array.isArray(vd.linkSnapshots) && vd.linkSnapshots.length > 0) {
                applyViewershipToPatch(patch, vd);
              }
            }
          } catch {
            /* izlenme yüklemesi isteğe bağlı */
          }
        }
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
        setSyncError(null);
        setTimeout(() => { skipSync.current = false; }, 500);
      } catch (e) {
        console.error("Bootstrap failed:", e);
        if (!cancelled) {
          setReady(true);
          setBootstrapOk(false);
          const msg = e instanceof Error ? e.message : "Bootstrap hatası";
          setSyncError(
            msg.includes("Oturum")
              ? msg
              : `İlk yükleme başarısız: ${msg}. Sayfayı yenileyin veya tekrar giriş yapın.`
          );
        }
      }
    })();

    return () => { cancelled = true; };
  }, [supabaseMode, sessionReady, user?.id]);

  useEffect(() => {
    if (!supabaseMode || !user) return;

    const reloadViewership = async () => {
      skipSync.current = true;
      try {
        const res = await fetchJsonWithRetry("/api/bootstrap/viewership", {
          credentials: "include",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setSyncError(data.error ?? `İzlenme yüklenemedi (${res.status})`);
          return;
        }
        const vd = (await res.json()) as Pick<
          AppHydratePayload,
          "brands" | "brandLinks" | "linkSnapshots" | "brandViewership"
        >;
        const patch: Record<string, unknown> = {};
        applyViewershipToPatch(patch, vd);
        useStore.setState(patch);
        setSyncError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ağ hatası";
        setSyncError(`İzlenme verileri yüklenemedi: ${msg}`);
      } finally {
        setTimeout(() => {
          skipSync.current = false;
        }, 500);
      }
    };

    const onReload = () => {
      void reloadViewership();
    };
    window.addEventListener(RELOAD_VIEWERSHIP_EVENT, onReload);
    return () => window.removeEventListener(RELOAD_VIEWERSHIP_EVENT, onReload);
  }, [supabaseMode, user?.id]);

  useEffect(() => {
    registerSyncFlushHandler(() => {
      void runSyncNow();
    });
    return () => registerSyncFlushHandler(null);
  }, [runSyncNow]);

  useEffect(() => {
    const onKasaError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setSyncError(detail);
    };
    window.addEventListener(SYNC_ERROR_EVENT, onKasaError);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onKasaError);
  }, []);

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

  const showSessionOverlay = supabaseMode && !sessionReady && !isLoginRoute;
  const showBootstrapOverlay = supabaseMode && Boolean(user) && !ready;

  return (
    <>
      {(showSessionOverlay || showBootstrapOverlay) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          aria-busy="true"
          aria-label="Yükleniyor"
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {syncError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[70] w-[min(100%-2rem,32rem)] -translate-x-1/2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-500/50 dark:bg-red-950/90 dark:text-red-100"
        >
          <p className="font-medium">Supabase kaydı başarısız</p>
          <p className="text-xs mt-1 opacity-90">{syncError}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              className="text-xs underline"
              onClick={() => void runSyncNow()}
            >
              Tekrar dene
            </button>
            {syncError.includes("Oturum") && (
              <button
                type="button"
                className="text-xs underline font-medium"
                onClick={() => {
                  void useAuth.getState().logout();
                  router.replace("/login");
                }}
              >
                Tekrar giriş yap
              </button>
            )}
            <button
              type="button"
              className="text-xs underline opacity-70"
              onClick={() => setSyncError(null)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
