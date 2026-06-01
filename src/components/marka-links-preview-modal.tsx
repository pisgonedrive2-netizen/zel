"use client";

import { useCallback, useMemo, useState } from "react";
import { ExternalLink, Loader2, Pencil, RefreshCw, Sparkles, Users } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLinkListToolbar } from "@/components/brand-link-list-toolbar";
import { BrandLinkThumb } from "@/components/brand-link-thumb";
import { SocialPlatformIcon, platformAccentClass } from "@/components/social-platform-icon";
import { LinkDetailsModal } from "@/components/link-details-modal";
import { LinkSnapshotForm } from "@/components/link-snapshot-form";
import {
  enrichBrandLinksForMonth,
  filterBrandLinksDisplay,
  platformOptionsFromLinks,
  sortBrandLinksDisplay,
  type BrandLinkSortKey,
} from "@/lib/brand-link-display";
import { useStore, type Brand, type BrandLink, type Employee, type LinkSnapshot } from "@/store/store";
import { useAuth } from "@/store/auth";
import { defaultSnapshotDateInMonth } from "@/lib/data";
import { monthLabelTr } from "@/hooks/use-marka-portal";
import { resolveRefreshTargetDate } from "@/lib/izlenme-refresh";
import {
  applyLinkMetricsToStore,
  type LinkMetricsStoreUpdate,
} from "@/lib/social-api/link-store-sync";

type LinkRefreshResult = {
  linkId: string;
  linkUpdate?: LinkMetricsStoreUpdate;
};

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

export interface MarkaLinksPreviewModalProps {
  brand: Brand;
  open: boolean;
  onClose: () => void;
  monthYm: string;
  todayYm: string;
  links: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  employees: Employee[];
}

export function MarkaLinksPreviewModal({
  brand,
  open,
  onClose,
  monthYm,
  todayYm,
  links,
  linkSnapshots,
  employees,
}: MarkaLinksPreviewModalProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [ownerId, setOwnerId] = useState("all");
  const [sortKey, setSortKey] = useState<BrandLinkSortKey>("views");
  const [monthOnly, setMonthOnly] = useState(true);

  const role = useAuth((s) => s.user?.role);
  const canRefreshApi = role === "admin" || role === "auditor";
  const addLinkSnapshot = useStore((s) => s.addLinkSnapshot);
  const updateLinkSnapshot = useStore((s) => s.updateLinkSnapshot);
  const deleteLinkSnapshot = useStore((s) => s.deleteLinkSnapshot);
  const updateBrandLink = useStore((s) => s.updateBrandLink);
  const upsertLinkSnapshot = useStore((s) => s.upsertLinkSnapshot);
  const [detailsLink, setDetailsLink] = useState<BrandLink | null>(null);
  const [snapEdit, setSnapEdit] = useState<{ link: BrandLink; snapshot?: LinkSnapshot } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null);

  const rawLinkById = useMemo(() => {
    const m = new Map<string, BrandLink>();
    for (const l of links) m.set(l.id, l);
    return m;
  }, [links]);

  const monthSnapshotFor = (linkId: string): LinkSnapshot | undefined =>
    linkSnapshots
      .filter((s) => s.linkId === linkId && s.date.startsWith(monthYm))
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);

  const enriched = useMemo(
    () => enrichBrandLinksForMonth(links, monthYm, linkSnapshots, todayYm, employees),
    [links, monthYm, linkSnapshots, todayYm, employees]
  );

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of links) {
      const id = l.ownerId ?? "_none";
      const name = l.ownerId
        ? employees.find((e) => e.id === l.ownerId)?.name ?? "?"
        : "Genel / atanmamış";
      map.set(id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [links, employees]);

  const platforms = useMemo(() => platformOptionsFromLinks(links), [links]);

  const filtered = useMemo(() => {
    const list = filterBrandLinksDisplay(enriched, {
      search,
      platform,
      ownerId,
      monthOnly,
      monthYm,
      todayYm,
    });
    return sortBrandLinksDisplay(list, sortKey);
  }, [enriched, search, platform, ownerId, monthOnly, monthYm, todayYm, sortKey]);

  const totalViews = filtered.reduce((s, r) => s + r.lastViews, 0);

  const activeLinkIds = useMemo(
    () => links.filter((l) => l.status === "active" && l.url?.trim()).map((l) => l.id),
    [links]
  );

  const refreshAllLinks = useCallback(
    async (opts?: { failedOnly?: boolean }) => {
      if (!canRefreshApi || refreshing || activeLinkIds.length === 0) return;
      setRefreshing(true);
      setRefreshLabel("Başlatılıyor…");

      const jobId = `marka-modal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const targetDate = resolveRefreshTargetDate(
        monthYm,
        monthYm === todayYm ? "today" : "view-month"
      );

      const poll = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/refresh-progress?jobId=${jobId}`, {
            credentials: "include",
          });
          const json = (await res.json()) as {
            ok?: boolean;
            found?: boolean;
            job?: {
              status: string;
              current?: { index: number; total: number; handle?: string };
            };
          };
          if (json.ok && json.found && json.job?.current) {
            const { index, total, handle } = json.job.current;
            setRefreshLabel(`${index}/${total}${handle ? ` · ${handle}` : ""}`);
          }
          if (json.job?.status && json.job.status !== "running") {
            clearInterval(poll);
          }
        } catch {
          /* sessiz */
        }
      }, 1500);

      try {
        const res = await fetch("/api/admin/refresh-all-links", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            brandId: brand.id,
            linkIds: activeLinkIds,
            failedOnly: opts?.failedOnly ?? false,
            targetDate,
            linkScope: "month",
            monthYm,
            trigger: "marka-links-modal",
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          summary?: {
            succeeded: number;
            failed: number;
            skippedQuota?: number;
            results: LinkRefreshResult[];
          };
        };
        clearInterval(poll);
        if (!res.ok || !json.ok || !json.summary) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        for (const r of json.summary.results) {
          if (r.linkUpdate) {
            applyLinkMetricsToStore(r.linkId, r.linkUpdate, {
              updateBrandLink,
              upsertLinkSnapshot,
            });
          }
        }
        setRefreshLabel(
          `${json.summary.succeeded} güncellendi` +
            (json.summary.failed > 0 ? ` · ${json.summary.failed} hata` : "") +
            (json.summary.skippedQuota ? ` · ${json.summary.skippedQuota} kota` : "")
        );
      } catch (e) {
        clearInterval(poll);
        setRefreshLabel(e instanceof Error ? e.message : "Yenileme hatası");
      } finally {
        setRefreshing(false);
        setTimeout(() => setRefreshLabel(null), 10_000);
      }
    },
    [
      activeLinkIds,
      brand.id,
      canRefreshApi,
      monthYm,
      refreshing,
      todayYm,
      updateBrandLink,
      upsertLinkSnapshot,
    ]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`${brand.name} · marka linkleri`}
    >
      <div className="space-y-4 min-h-[280px]">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <p className="text-sm text-muted-foreground min-w-0">
            {monthLabelTr(monthYm)} · {filtered.length} / {links.length} link · toplam{" "}
            <span className="font-semibold text-foreground tabular-nums">{fmtViews(totalViews)}</span>
            {canRefreshApi && activeLinkIds.length > 0 && (
              <span className="block text-[11px] mt-0.5">
                API yenileme: {activeLinkIds.length} aktif URL
              </span>
            )}
          </p>
          {canRefreshApi && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {refreshLabel && (
                <span className="text-[11px] text-muted-foreground tabular-nums max-w-[200px] truncate">
                  {refreshing && <Loader2 size={11} className="inline animate-spin mr-1" />}
                  {refreshLabel}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={refreshing || activeLinkIds.length === 0}
                onClick={() => void refreshAllLinks()}
                title="Bu markanın tüm aktif linklerini RapidAPI ile yenile"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Hepsini yenile
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                disabled={refreshing || activeLinkIds.length === 0}
                onClick={() => void refreshAllLinks({ failedOnly: true })}
                title="Son denemede hatalı veya eksik kalan linkleri tekrar dene"
              >
                Bekleyenler
              </Button>
            </div>
          )}
        </div>

        <BrandLinkListToolbar
          search={search}
          onSearchChange={setSearch}
          platform={platform}
          onPlatformChange={setPlatform}
          platforms={platforms}
          ownerId={ownerId}
          onOwnerChange={setOwnerId}
          owners={owners}
          sortKey={sortKey}
          onSortChange={setSortKey}
          monthOnly={monthOnly}
          onMonthOnlyChange={setMonthOnly}
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Filtrelere uyan link yok. &quot;Bu ay verisi&quot; kutusunu kaldırmayı deneyin.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 max-h-[min(65vh,520px)] overflow-y-auto pr-1">
            {filtered.map((link) => (
              <div
                key={link.id}
                className={`rounded-xl border px-3 py-3 transition-colors ${platformAccentClass(link.platform)}`}
              >
                <div className="flex items-start gap-3">
                  <BrandLinkThumb link={link} className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm inline-flex items-center gap-1">
                        <SocialPlatformIcon platform={link.platform} size={16} />
                        {link.platform}
                      </span>
                      <Badge
                        variant={link.lastViews > 0 ? "secondary" : "outline"}
                        className="tabular-nums shrink-0"
                      >
                        {link.lastViews > 0 ? fmtViews(link.lastViews) : "—"}
                      </Badge>
                    </div>
                    {link.handle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{link.handle}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Users size={10} />
                      {link.ownerName}
                    </p>
                    {link.stale && monthYm !== todayYm && (
                      <Badge variant="outline" className="text-[9px] mt-1">
                        Bu ay snapshot yok
                      </Badge>
                    )}
                    {link.refDate && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Referans: {link.refDate}
                      </p>
                    )}
                    {link.url ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 mt-1.5 break-all hover:underline"
                      >
                        {link.url.replace(/^https?:\/\/(www\.)?/, "")}
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground mt-1">URL henüz yok</p>
                    )}

                    {canRefreshApi && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-[10px]"
                          onClick={() => {
                            const raw = rawLinkById.get(link.id);
                            if (raw) setDetailsLink(raw);
                          }}
                          title="API'den detaylı veri çek (1 kota)"
                        >
                          <Sparkles size={10} /> Detay & API'den çek
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 px-2 text-[10px]"
                          onClick={() => {
                            const raw = rawLinkById.get(link.id);
                            if (raw) setSnapEdit({ link: raw, snapshot: monthSnapshotFor(raw.id) });
                          }}
                          title="Bu ayın izlenme snapshot'ını düzenle / ekle"
                        >
                          <Pencil size={10} />
                          {monthSnapshotFor(link.id) ? "Snapshot düzenle" : "Snapshot ekle"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin: tek link API detayı (yeniden çek dahil) */}
      <LinkDetailsModal
        link={detailsLink}
        open={detailsLink !== null}
        onClose={() => setDetailsLink(null)}
      />

      {/* Admin: manuel snapshot düzenleme */}
      <Modal
        open={snapEdit !== null}
        onClose={() => setSnapEdit(null)}
        size="md"
        title={snapEdit?.snapshot ? "Snapshot'ı düzenle" : "Yeni izlenme snapshot'ı"}
      >
        {snapEdit && (
          <LinkSnapshotForm
            key={snapEdit.snapshot?.id ?? `new-${snapEdit.link.id}-${monthYm}`}
            link={snapEdit.link}
            initial={snapEdit.snapshot}
            defaultDateForNew={defaultSnapshotDateInMonth(monthYm)}
            suggestedViewsForNew={
              snapEdit.snapshot
                ? undefined
                : enriched.find((e) => e.id === snapEdit.link.id)?.lastViews
            }
            onSave={(d) => {
              if (snapEdit.snapshot) {
                updateLinkSnapshot(snapEdit.snapshot.id, d);
              } else {
                addLinkSnapshot({ ...d, linkId: snapEdit.link.id });
              }
              setSnapEdit(null);
            }}
            onDelete={
              snapEdit.snapshot
                ? () => {
                    deleteLinkSnapshot(snapEdit.snapshot!.id);
                    setSnapEdit(null);
                  }
                : undefined
            }
            onClose={() => setSnapEdit(null)}
          />
        )}
      </Modal>
    </Modal>
  );
}
