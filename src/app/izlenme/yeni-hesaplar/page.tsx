"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Users } from "lucide-react";
import { useStore } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { ViewershipReloadBanner } from "@/components/izlenme/viewership-reload-banner";
import { HesapGunlukTakvim } from "@/components/izlenme/hesap-gunluk-takvim";
import { useIzlenmeViewMonth, izlenmeHref } from "@/lib/use-izlenme-view-month";
import { linkViewsForMonth } from "@/lib/brand-month-metrics";
import { applyLinkMetricsToStore } from "@/lib/social-api/link-store-sync";
import type { LinkRefreshResult } from "@/lib/social-api/refresh-runner";
import { resolveRefreshTargetDate } from "@/lib/izlenme-refresh";
import {
  hesapGunlukIstanbulDate,
  shouldAutoBackfillHesapGunluk,
  type HesapGunlukStore,
} from "@/lib/hesap-gunluk-aktivite-shared";
import {
  HESAP_TAG_LABEL,
  YENI_HESAPLAR_BRAND_ID,
  isYeniHesaplarBrandId,
  parseHesapTag,
  yeniHesapPrimaryMetricLabel,
  yeniHesapSecondaryMetricLabel,
} from "@/lib/yeni-hesaplar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

const PLATFORM_ORDER = ["Instagram", "YouTube", "TikTok"] as const;

export default function YeniHesaplarPage() {
  const readOnly = useIsReadOnly();
  const { brands, brandLinks, linkSnapshots, updateBrandLink, upsertLinkSnapshot } = useStore();
  const {
    viewMonth,
    setViewMonth,
    todayYm,
    linkScope,
    setLinkScope,
    apiDateMode,
    setApiDateMode,
  } = useIzlenmeViewMonth();
  const izHref = (path: string) =>
    izlenmeHref(path, viewMonth, { linkScope, apiDateMode });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null);
  const [gunlukStore, setGunlukStore] = useState<HesapGunlukStore | null>(null);
  const [gunlukDate, setGunlukDate] = useState<string | null>(null);
  const [gunlukBusy, setGunlukBusy] = useState(false);
  const [gunlukAuto, setGunlukAuto] = useState(false);
  const [gunlukErr, setGunlukErr] = useState<string | null>(null);
  const autoBackfillStarted = useRef(false);

  async function runBackfill(days: number, opts?: { auto?: boolean; keepDate?: string | null }) {
    if (readOnly || gunlukBusy) return;
    setGunlukBusy(true);
    if (opts?.auto) setGunlukAuto(true);
    setGunlukErr(null);
    try {
      const res = await fetch("/api/admin/hesap-gunluk-aktivite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backfillDays: days }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        store?: HesapGunlukStore;
        filled?: string[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.store) {
        setGunlukErr(json.error ?? "Geçmiş doldurulamadı");
        return;
      }
      setGunlukStore(json.store);
      const keep = opts?.keepDate;
      const pick =
        (keep && json.store.byDate[keep] ? keep : null) ??
        json.filled?.at(-1) ??
        json.store.latestDate;
      setGunlukDate(pick);
    } catch (e) {
      setGunlukErr(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setGunlukBusy(false);
      setGunlukAuto(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/hesap-gunluk-aktivite", { credentials: "include" });
        const j = (await res.json()) as { store?: HesapGunlukStore | null };
        if (cancelled) return;
        const store = j.store ?? null;
        setGunlukStore(store);
        setGunlukDate(store?.latestDate ?? hesapGunlukIstanbulDate());
        if (
          !readOnly &&
          !autoBackfillStarted.current &&
          shouldAutoBackfillHesapGunluk(store)
        ) {
          autoBackfillStarted.current = true;
          await runBackfill(14, { auto: true, keepDate: store?.latestDate ?? null });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + readOnly
  }, [readOnly]);

  async function checkGunlukDay(date: string) {
    if (readOnly || gunlukBusy) return;
    setGunlukBusy(true);
    setGunlukErr(null);
    const today = hesapGunlukIstanbulDate();
    try {
      const res = await fetch("/api/admin/hesap-gunluk-aktivite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify: false,
          date,
          final: date < today,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        store?: HesapGunlukStore;
        report?: { date: string };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.store) {
        setGunlukErr(json.error ?? "Kontrol başarısız");
        return;
      }
      setGunlukStore(json.store);
      setGunlukDate(json.report?.date ?? date);
    } catch (e) {
      setGunlukErr(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setGunlukBusy(false);
    }
  }

  const links = useMemo(
    () =>
      brandLinks
        .filter((l) => isYeniHesaplarBrandId(l.brandId) && l.status === "active")
        .sort((a, b) => a.handle.localeCompare(b.handle, "tr")),
    [brandLinks]
  );

  const sponsorBrandCount = brands.filter(
    (b) => b.status === "active" && !isYeniHesaplarBrandId(b.id)
  ).length;

  const groups = useMemo(() => {
    return PLATFORM_ORDER.map((platform) => {
      const rows = links.filter((l) => l.platform.toLowerCase() === platform.toLowerCase());
      const total = rows.reduce((sum, link) => {
        return sum + linkViewsForMonth(link, viewMonth, linkSnapshots, todayYm).lastViews;
      }, 0);
      return { platform, rows, total };
    }).filter((g) => g.rows.length > 0);
  }, [links, linkSnapshots, todayYm, viewMonth]);

  const grand = groups.reduce((s, g) => s + g.total, 0);

  async function measureAll() {
    if (readOnly || refreshing || links.length === 0) return;
    setRefreshing(true);
    setRefreshLabel("Ölçülüyor…");
    const jobId = `yh-${Date.now()}`;
    const targetDate = resolveRefreshTargetDate(viewMonth, apiDateMode);
    try {
      const res = await fetch("/api/admin/refresh-all-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          brandId: YENI_HESAPLAR_BRAND_ID,
          linkIds: links.map((l) => l.id),
          linkScope: "all",
          targetDate,
          monthYm: viewMonth,
          trigger: "yeni-hesaplar",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        summary?: { succeeded: number; failed: number; results: LinkRefreshResult[] };
      };
      if (json.ok && json.summary) {
        for (const r of json.summary.results) {
          if (r.linkUpdate) {
            applyLinkMetricsToStore(r.linkId, r.linkUpdate, {
              updateBrandLink,
              upsertLinkSnapshot,
            });
          }
        }
        setRefreshLabel(
          `${json.summary.succeeded} hesap güncellendi` +
            (json.summary.failed > 0 ? ` · ${json.summary.failed} hata` : "")
        );
      } else {
        setRefreshLabel(json.error ?? "Ölçüm başarısız");
      }
    } catch (e) {
      setRefreshLabel(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-2 pb-8 sm:px-3 md:px-5">
      <ViewershipReloadBanner
        snapshotCount={linkSnapshots.length}
        linkCount={links.length}
        viewMonth={viewMonth}
      />
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        linkScope={linkScope}
        onLinkScopeChange={setLinkScope}
        apiDateMode={apiDateMode}
        onApiDateModeChange={setApiDateMode}
        totalBrands={sponsorBrandCount}
        totalStreamers={0}
        totalLinks={links.length}
        totalViews={grand}
        readOnly={readOnly}
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Yeni hesaplar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Eski marka linkleri duruyor. Bu sekme yalnızca yeni Instagram, YouTube ve TikTok
            profillerini ölçer. Instagram satırında sayı takipçidir; YouTube ve TikTok satırında
            izlenmedir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {refreshLabel && (
            <span className="text-xs text-muted-foreground">{refreshLabel}</span>
          )}
          <Button
            type="button"
            size="sm"
            disabled={readOnly || refreshing || links.length === 0}
            onClick={() => void measureAll()}
          >
            <RefreshCw size={14} className={cn("mr-1.5", refreshing && "animate-spin")} />
            Hepsini ölç
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Hesap" value={String(links.length)} />
        {groups.map((g) => (
          <Stat
            key={g.platform}
            label={`${g.platform} · ${yeniHesapPrimaryMetricLabel(g.platform)}`}
            value={fmt(g.total)}
          />
        ))}
      </div>

      <HesapGunlukTakvim
        store={gunlukStore}
        selectedDate={gunlukDate}
        onSelectDate={setGunlukDate}
        onCheckDay={(date) => void checkGunlukDay(date)}
        onBackfill={(days) => void runBackfill(days)}
        busy={gunlukBusy}
        autoFilling={gunlukAuto}
        readOnly={readOnly}
        error={gunlukErr}
      />

      {links.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Yeni hesaplar henüz yüklenmedi. Sayfayı yeniledikten sonra liste burada görünür.
        </p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.platform}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold">{group.platform}</h2>
              <Badge variant="secondary">{group.rows.length}</Badge>
              <span className="text-xs text-muted-foreground">
                {yeniHesapPrimaryMetricLabel(group.platform)} {fmt(group.total)}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Hesap</th>
                    <th className="px-3 py-2 font-medium text-right">
                      {yeniHesapPrimaryMetricLabel(group.platform)}
                    </th>
                    <th className="hidden px-3 py-2 font-medium text-right sm:table-cell">
                      {yeniHesapSecondaryMetricLabel(group.platform) ?? ""}
                    </th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Son kontrol</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((link) => {
                    const metric = linkViewsForMonth(link, viewMonth, linkSnapshots, todayYm);
                    const secondary = link.lastShares;
                    const secondaryLabel = yeniHesapSecondaryMetricLabel(link.platform);
                    return (
                      <tr key={link.id} className="border-t border-border/60">
                        <td className="px-3 py-2.5">
                          <div className="inline-flex flex-wrap items-center gap-1.5">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium hover:underline"
                            >
                              <Users size={13} className="text-muted-foreground" />
                              {link.handle || link.url}
                              <ExternalLink size={11} className="text-muted-foreground" />
                            </a>
                            {(() => {
                              const tag = parseHesapTag(link.notes);
                              if (!tag) return null;
                              return (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px]",
                                    tag === "naz"
                                      ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                  )}
                                >
                                  {HESAP_TAG_LABEL[tag]}
                                </Badge>
                              );
                            })()}
                          </div>
                          {link.lastCheckError && (
                            <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">
                              {link.lastCheckError}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                          {metric.stale ? "—" : fmt(metric.lastViews)}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                          {secondaryLabel && secondary != null ? fmt(secondary) : ""}
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                          {metric.refDate ?? link.lastSnapshotDate ?? "Henüz yok"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Marka özeti ve prim bu hesapları saymaz.{" "}
        <a className="underline" href={izHref("/izlenme/markalar")}>
          Markalar
        </a>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
