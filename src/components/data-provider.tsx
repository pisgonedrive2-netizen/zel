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
  mergeCanonicalContentExpenses,
  mergeCanonicalPaymentStatuses,
  mergeCanonicalSalaryExtras,
  reconcilePayrollSettledContentExtras,
  type AppHydratePayload,
  type Employee,
  type SalaryExtra,
  type ContentExpense,
  type Brand,
  type BrandLink,
} from "@/store/store";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import {
  mergeBrandViewershipHydrate,
  mergeCanonicalBrandLinks,
  mergeLinkSnapshotsHydrate,
  unionBrandLinks,
} from "@/lib/merge-viewership-hydrate";
import {
  preferRicherViewership,
  readViewershipCache,
  writeViewershipCache,
} from "@/lib/viewership-cache";

/** Ana bootstrap ile yazılmaz — yalnızca /api/bootstrap/viewership (+ yerel yedek). */
const VIEWERSHIP_STORE_KEYS = new Set<string>([
  "brandLinks",
  "linkSnapshots",
  "brandViewership",
]);
import { useAuth } from "@/store/auth";
import { useAuditLog, type AuditEntry } from "@/store/audit-log";
import { SYNC_ERROR_EVENT } from "@/lib/sync-notify";
import { RELOAD_VIEWERSHIP_EVENT } from "@/lib/viewership-reload";

const SYNC_MS = 900;
const BOOTSTRAP_RETRIES = 3;
const FETCH_TIMEOUT_MS = 8000;
const BOOTSTRAP_STALL_TIMEOUT_MS = 15000;

async function fetchJsonWithRetry(
  url: string,
  opts?: RequestInit
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < BOOTSTRAP_RETRIES; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, {
        cache: "no-store",
        ...opts,
        signal: controller.signal,
      });
      clearTimeout(timer);
      last = res;
      if (res.ok || res.status === 401) return res;
    } catch {
      // ağ/time-out: retry dene
    }
    if (i < BOOTSTRAP_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    }
  }
  if (last) return last;
  throw new Error("İstek zaman aşımı");
}

function applyViewershipToPatch(
  patch: Record<string, unknown>,
  data: Pick<AppHydratePayload, "brands" | "brandLinks" | "linkSnapshots" | "brandViewership">
) {
  const prev = useStore.getState();
  const brands = (data.brands ?? patch.brands ?? prev.brands) as Brand[];
  const brandIds = new Set(brands.map((b) => b.id));
  if (data.brands !== undefined) patch.brands = data.brands;

  const prevLinksForBrands = prev.brandLinks.filter((l) => l.brandId && brandIds.has(l.brandId));
  const prevSnapshotsForBrands = prev.linkSnapshots.filter((sn) => {
    const link = prev.brandLinks.find((l) => l.id === sn.linkId);
    return link?.brandId && brandIds.has(link.brandId);
  });
  const prevViewershipForBrands = prev.brandViewership.filter(
    (v) => v.brandId && brandIds.has(v.brandId)
  );

  if (data.brandLinks !== undefined) {
    patch.brandLinks = mergeCanonicalBrandLinks(
      unionBrandLinks(
        prevLinksForBrands,
        (patch.brandLinks as BrandLink[] | undefined) ?? [],
        data.brandLinks
      ),
      brands
    );
  }
  if (data.linkSnapshots !== undefined) {
    patch.linkSnapshots = mergeLinkSnapshotsHydrate(
      prevSnapshotsForBrands,
      data.linkSnapshots
    );
  }
  if (data.brandViewership !== undefined) {
    patch.brandViewership = mergeBrandViewershipHydrate(
      prevViewershipForBrands,
      data.brandViewership
    );
  }
}

/** Toplu sync'e dahil edilmeyen anahtarlar (izlenme sunucu/row-persist ile yazılır). */
const SYNC_EXCLUDE_KEYS = new Set<string>([
  "brandLinks",
  "linkSnapshots",
  "brandViewership",
]);

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
  return out;
}

function commitViewershipHydrate(
  server: Pick<
    AppHydratePayload,
    "brands" | "brandLinks" | "linkSnapshots" | "brandViewership"
  >
) {
  const serverBrands = server.brands ?? useStore.getState().brands;
  const validBrandIds = new Set(serverBrands.map((b) => b.id));
  const rich = preferRicherViewership(
    {
      brandLinks: server.brandLinks ?? [],
      linkSnapshots: server.linkSnapshots ?? [],
      brandViewership: server.brandViewership ?? [],
    },
    readViewershipCache(),
    validBrandIds
  );
  const patch: Record<string, unknown> = {};
  applyViewershipToPatch(patch, { ...server, ...rich });
  const next: Partial<{
    brands: Brand[];
    brandLinks: BrandLink[];
    linkSnapshots: typeof rich.linkSnapshots;
    brandViewership: typeof rich.brandViewership;
  }> = {};
  if (patch.brands !== undefined) next.brands = patch.brands as Brand[];
  if (patch.brandLinks !== undefined) next.brandLinks = patch.brandLinks as BrandLink[];
  if (patch.linkSnapshots !== undefined) next.linkSnapshots = patch.linkSnapshots as typeof rich.linkSnapshots;
  if (patch.brandViewership !== undefined) {
    next.brandViewership = patch.brandViewership as typeof rich.brandViewership;
  }
  if (Object.keys(next).length > 0) useStore.setState(next);
  writeViewershipCache(rich);
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
      const payrollLinked = reconcilePayrollSettledContentExtras(
        s.salaryExtras,
        s.contentExpenses,
      );
      const fixed = reconcileRentExtrasForAllEmployees(
        s.employees,
        payrollLinked.salaryExtras,
      );
      const brandLinks = mergeCanonicalBrandLinks(s.brandLinks, s.brands);
      const cache = readViewershipCache();
      const changed =
        fixed !== s.salaryExtras ||
        payrollLinked.contentExpenses !== s.contentExpenses ||
        brandLinks !== s.brandLinks ||
        !!cache;
      if (changed) {
        skipSync.current = true;
        useStore.setState({
          salaryExtras: fixed,
          contentExpenses: payrollLinked.contentExpenses,
          brandLinks,
        });
        if (cache) commitViewershipHydrate(cache);
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
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    setBootstrapOk(false);
    skipSync.current = true;
    setReady(false);

    (async () => {
      try {
        stallTimer = setTimeout(() => {
          if (cancelled) return;
          setReady(true);
          setBootstrapOk(false);
          setSyncError("İlk yükleme zaman aşımına uğradı. Ağ bağlantısını kontrol edip tekrar deneyin.");
        }, BOOTSTRAP_STALL_TIMEOUT_MS);

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
        const contentExpenses = mergeCanonicalContentExpenses(
          (patch.contentExpenses ?? useStore.getState().contentExpenses) as ContentExpense[],
        );
        patch.contentExpenses = contentExpenses;
        let salaryExtras = dedupeSalaryExtrasByContentExpense(
          (patch.salaryExtras ?? useStore.getState().salaryExtras) as SalaryExtra[],
          contentExpenses
        );
        const payrollLinked = reconcilePayrollSettledContentExtras(
          salaryExtras,
          contentExpenses,
        );
        salaryExtras = payrollLinked.salaryExtras;
        patch.contentExpenses = payrollLinked.contentExpenses;
        salaryExtras = mergeCanonicalSalaryExtras(salaryExtras);
        salaryExtras = reconcileRentExtrasForAllEmployees(employees, salaryExtras);
        patch.salaryExtras = salaryExtras;
        patch.paymentStatuses = mergeCanonicalPaymentStatuses(
          (patch.paymentStatuses ?? useStore.getState().paymentStatuses) as import("@/store/store").MonthPaymentStatus[],
        );
        useStore.setState(patch);
        try {
          const vr = await fetchJsonWithRetry("/api/bootstrap/viewership", {
            credentials: "include",
          });
          if (vr.ok) {
            const vd = (await vr.json()) as Pick<
              AppHydratePayload,
              "brands" | "brandLinks" | "linkSnapshots" | "brandViewership"
            >;
            if (!cancelled) commitViewershipHydrate(vd);
          } else if (!cancelled) {
            const cache = readViewershipCache();
            if (cache) commitViewershipHydrate(cache);
          }
        } catch {
          if (!cancelled) {
            const cache = readViewershipCache();
            if (cache) commitViewershipHydrate(cache);
          }
        }
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
      } finally {
        if (stallTimer) {
          clearTimeout(stallTimer);
          stallTimer = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (stallTimer) clearTimeout(stallTimer);
    };
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
        commitViewershipHydrate(vd);
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
