"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/store/auth";

type Status = "ok" | "warn" | "error" | "exhausted" | "unknown";

interface PlatformBrief {
  platform: string;
  label: string;
  requestsUsed: number;
  monthlyLimit: number;
  monthlyBudget: number;
  batchSizePerRun: number;
  health: {
    status: Status;
    successCount24h: number;
    errorCount24h: number;
    lastError: string | null;
  } | null;
}

/**
 * Yöneticinin her sayfada görebileceği küçük API durum çipi.
 *
 * - RAPIDAPI_KEY yoksa hiç görünmez.
 * - 5 dakikada bir status endpoint'ini polluna eder.
 * - En kötü platformun durumuna göre renk değişir
 *   (exhausted/error > warn > ok).
 * - Tıklayınca /izlenme'ye gider (Otomatik yenileme paneli orada).
 *
 * /marka, /yayinci, /login, /icerik-iste-eski-mock kapsamı dışında — bunlar
 * impersonation chip / kendi UI'ı olan sayfalar.
 */
export function ApiHealthChip({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [data, setData] = useState<{ enabled: boolean; platforms: PlatformBrief[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "auditor";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/refresh-status", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setData({
          enabled: Boolean(json.rapidApiEnabled),
          platforms: (json.platforms ?? []) as PlatformBrief[],
        });
      } catch {
        // sessiz — sadece sinyal/UI öğesi
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchStatus();
    const id = setInterval(fetchStatus, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAdmin]);

  const worst = useMemo<Status>(() => {
    if (!data) return "unknown";
    const order: Status[] = ["exhausted", "error", "warn", "unknown", "ok"];
    let best: Status = "ok";
    for (const p of data.platforms) {
      const s = p.batchSizePerRun === 0 ? "exhausted" : p.health?.status ?? "unknown";
      if (order.indexOf(s) < order.indexOf(best)) best = s;
    }
    return best;
  }, [data]);

  if (!isAdmin) return null;
  if (!data) return null;
  if (!data.enabled) return null;
  if (data.platforms.length === 0) return null;
  // Bu sayfalarda zaten panel görünüyor; çift göstermeyelim.
  if (pathname === "/izlenme" || pathname === "/login") return null;
  if (pathname.startsWith("/marka") || pathname.startsWith("/yayinci")) return null;

  const meta = STYLES[worst];

  // Hata özeti
  const errored = data.platforms.filter((p) => (p.health?.errorCount24h ?? 0) > 0);
  const exhausted = data.platforms.filter((p) => p.batchSizePerRun === 0);

  const summary =
    worst === "ok"
      ? "Tüm API'lar çalışıyor"
      : worst === "exhausted"
        ? `${exhausted.map((p) => p.label).join(", ")} kotası doldu`
        : worst === "error"
          ? `${errored.map((p) => p.label).join(", ")} hata veriyor`
          : worst === "warn"
            ? "API'lar uyarı veriyor"
            : "API durumu bilinmiyor";

  return (
    <Link
      href="/izlenme"
      title={`API durumu — ${summary}`}
      className={`flex max-w-[min(calc(100vw-5rem),280px)] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] shadow-sm backdrop-blur ${
        embedded ? "" : "fixed right-[max(env(safe-area-inset-right),12px)] top-[max(calc(env(safe-area-inset-top)+48px),56px)] z-[55]"
      } ${meta.cls}`}
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" />
      ) : worst === "ok" ? (
        <CheckCircle2 size={11} />
      ) : worst === "warn" || worst === "exhausted" || worst === "error" ? (
        <AlertTriangle size={11} />
      ) : (
        <Activity size={11} />
      )}
      <span className="font-medium">API</span>
      <span className="opacity-80 hidden sm:inline truncate">· {summary}</span>
    </Link>
  );
}

const STYLES: Record<Status, { cls: string }> = {
  ok: {
    cls: "border-emerald-300/70 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/45 dark:bg-emerald-950/70 dark:text-emerald-100",
  },
  warn: {
    cls: "border-amber-300/70 bg-amber-50/90 text-amber-900 dark:border-amber-500/45 dark:bg-amber-950/70 dark:text-amber-100",
  },
  error: {
    cls: "border-red-300/70 bg-red-50/90 text-red-900 dark:border-red-500/45 dark:bg-red-950/70 dark:text-red-100",
  },
  exhausted: {
    cls: "border-red-300/70 bg-red-50/90 text-red-900 dark:border-red-500/45 dark:bg-red-950/70 dark:text-red-100",
  },
  unknown: {
    cls: "border-border bg-card text-muted-foreground",
  },
};
