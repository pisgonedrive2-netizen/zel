"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardEdit,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  TrendingUp,
} from "lucide-react";

import { useStore, type BrandLink, type LinkSnapshot } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { LinkSnapshotForm } from "@/components/link-snapshot-form";
import { ManualLinkFormModal } from "@/components/manual-link-form";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { linkViewsForMonth, totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import { fmtEngagement } from "@/lib/brand-engagement-metrics";
import { needsManualTracking } from "@/lib/link-tracking-mode";
import {
  linkDisplayTitle,
  linkSiteLabel,
  linkViewsGainInMonth,
  totalLinkViewsGainInMonth,
} from "@/lib/link-snapshot-delta";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { cn } from "@/lib/utils";

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

export default function IzlenmeManuelPage() {
  const readOnly = useIsReadOnly();
  const {
    brands,
    brandLinks,
    linkSnapshots,
    employees,
    addLinkSnapshot,
    updateBrandLink,
    addBrandLink,
  } = useStore();
  const {
    viewMonth,
    setViewMonth,
    todayYm,
    linkScope,
    setLinkScope,
    apiDateMode,
    setApiDateMode,
  } = useIzlenmeViewMonth();

  const [snapshotModal, setSnapshotModal] = useState<{
    link: BrandLink;
    snapshot?: LinkSnapshot;
  } | null>(null);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const manualLinks = useMemo(
    () =>
      brandLinks
        .filter((l) => l.status === "active" && needsManualTracking(l))
        .sort((a, b) => {
          const ba = brands.find((x) => x.id === a.brandId)?.name ?? "";
          const bb = brands.find((x) => x.id === b.brandId)?.name ?? "";
          return ba.localeCompare(bb, "tr") || a.platform.localeCompare(b.platform, "tr");
        }),
    [brandLinks, brands]
  );

  const filteredLinks = useMemo(
    () =>
      brandFilter === "all"
        ? manualLinks
        : manualLinks.filter((l) => l.brandId === brandFilter),
    [manualLinks, brandFilter]
  );

  const brandsWithManual = useMemo(() => {
    const ids = new Set(manualLinks.map((l) => l.brandId));
    return brands.filter((b) => ids.has(b.id));
  }, [manualLinks, brands]);

  const totalManualViews = useMemo(
    () => totalLinkViewsForMonth(manualLinks, viewMonth, linkSnapshots, todayYm),
    [manualLinks, viewMonth, linkSnapshots, todayYm]
  );

  const totalManualGain = useMemo(
    () => totalLinkViewsGainInMonth(manualLinks, viewMonth, linkSnapshots, todayYm),
    [manualLinks, viewMonth, linkSnapshots, todayYm]
  );

  const pendingToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return manualLinks.filter((l) => {
      const { snapsInMonth } = linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm);
      if (viewMonth !== todayYm) return snapsInMonth.length === 0;
      return !snapsInMonth.some((s) => s.date.slice(0, 10) === today);
    }).length;
  }, [manualLinks, viewMonth, linkSnapshots, todayYm]);

  const defaultSnapshotDate = useMemo(() => {
    if (viewMonth === todayYm) return new Date().toISOString().slice(0, 10);
    const [y, m] = viewMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${viewMonth}-${String(lastDay).padStart(2, "0")}`;
  }, [viewMonth, todayYm]);

  const saveSnapshot = (link: BrandLink, d: Omit<LinkSnapshot, "id">) => {
    addLinkSnapshot(d);
    updateBrandLink(link.id, {
      lastViews: d.views,
      lastSnapshotDate: d.date.slice(0, 10),
      lastLikes: d.likes,
      lastComments: d.comments,
      lastShares: d.shares,
      autoTrack: false,
    });
  };

  const handleNewLink = (payload: Omit<BrandLink, "id"> & { id?: string }) => {
    const newId = crypto.randomUUID();
    addBrandLink({ ...payload, id: newId });
    const created: BrandLink = {
      ...payload,
      id: newId,
    };
    setSnapshotModal({ link: created });
  };

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Manuel İçerik Takibi</h1>
            <Badge variant="outline" className="text-[10px] gap-1">
              <ClipboardEdit size={10} /> Kick · Twitter · Twitch · diğer
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            API dışı videolar buradan eklenir ve güncellenir. Her kayıtta marka seçilir; snapshot
            kaydedildiğinde <strong>artış</strong> otomatik hesaplanır ve izlenme panosuna yansır.
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" className="gap-1.5 shrink-0" onClick={() => setAddLinkOpen(true)}>
            <Plus size={14} /> Yeni manuel video
          </Button>
        )}
      </header>

      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        linkScope={linkScope}
        onLinkScopeChange={setLinkScope}
        apiDateMode={apiDateMode}
        onApiDateModeChange={setApiDateMode}
        totalBrands={brands.filter((b) => b.status === "active").length}
        totalStreamers={0}
        totalLinks={manualLinks.length}
        totalAllLinks={manualLinks.length}
        totalViews={totalManualViews}
        readOnly={readOnly}
      />

      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs">Manuel link</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{manualLinks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs">{monthTitleYm(viewMonth)} güncel</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{fmtViews(totalManualViews)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-300/60 bg-emerald-50/30 dark:border-emerald-500/35 dark:bg-emerald-950/20">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <TrendingUp size={11} /> {monthTitleYm(viewMonth)} artış
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-emerald-800 dark:text-emerald-300">
              +{fmtViews(totalManualGain)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs">Bugün güncellenmemiş</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-700 dark:text-amber-300">
              {pendingToday}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs">Otomatik API</CardDescription>
            <CardTitle className="text-sm font-medium pt-1">
              <Link href="/izlenme/api" className="text-primary underline underline-offset-2">
                API sekmesi →
              </Link>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {brandsWithManual.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setBrandFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              brandFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-accent/40"
            )}
          >
            Tüm markalar
          </button>
          {brandsWithManual.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBrandFilter(b.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                brandFilter === b.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              )}
            >
              {b.shortName || b.name}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Kontrol listesi</CardTitle>
          <CardDescription className="text-xs">
            Site adı, marka ve video başlığı ile listelenir. Snapshot kaydında artış yeşil olarak
            gösterilir — Genel Özet ve marka panolarına yansır.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLinks.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {manualLinks.length === 0
                  ? "Henüz manuel link yok."
                  : "Bu marka için manuel link yok."}
              </p>
              {!readOnly && manualLinks.length === 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 gap-1"
                  onClick={() => setAddLinkOpen(true)}
                >
                  <Plus size={14} /> İlk manuel videoyu ekle
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredLinks.map((link) => {
                const brand = brands.find((b) => b.id === link.brandId);
                const owner = link.ownerId
                  ? employees.find((e) => e.id === link.ownerId)
                  : null;
                const monthMeta = linkViewsForMonth(link, viewMonth, linkSnapshots, todayYm);
                const { lastViews, refDate, snapsInMonth } = monthMeta;
                const gainMeta = linkViewsGainInMonth(link, viewMonth, linkSnapshots, todayYm);
                const today = new Date().toISOString().slice(0, 10);
                const updatedToday =
                  viewMonth === todayYm &&
                  snapsInMonth.some((s) => s.date.slice(0, 10) === today);
                const snap = snapsInMonth[0];
                const site = linkSiteLabel(link.url);
                const title = linkDisplayTitle(link);

                return (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {brand && (
                      <Link href={`/izlenme/marka/${brand.id}?month=${viewMonth}`} className="shrink-0">
                        <BrandLogo brandId={brand.id} title={brand.name} className="h-9 w-9" />
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {brand && (
                          <Link
                            href={`/izlenme/marka/${brand.id}?month=${viewMonth}`}
                            className="font-semibold text-sm text-foreground hover:underline"
                          >
                            {brand.name}
                          </Link>
                        )}
                        {site && (
                          <Badge variant="secondary" className="text-[9px] font-medium">
                            {site}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px]">
                          {link.platform}
                        </Badge>
                        {owner && (
                          <Badge variant="outline" className="text-[9px]">
                            {owner.name}
                          </Badge>
                        )}
                        {updatedToday ? (
                          <Badge className="text-[9px] gap-0.5 bg-emerald-600/90">
                            <CheckCircle2 size={9} /> bugün
                          </Badge>
                        ) : viewMonth === todayYm ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] gap-0.5 border-amber-300 text-amber-800 dark:text-amber-300"
                          >
                            <Clock size={9} /> bekliyor
                          </Badge>
                        ) : snapsInMonth.length === 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] gap-0.5 border-red-300 text-red-700 dark:text-red-300"
                          >
                            <AlertCircle size={9} /> bu ay yok
                          </Badge>
                        ) : null}
                        {link.url && (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                            title="Videoyu aç"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5 truncate">{title}</p>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">{link.url}</p>
                      {link.notes && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {link.notes}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {snapsInMonth.length} snapshot · {monthTitleYm(viewMonth)}
                        {refDate ? ` · son kayıt: ${refDate}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 min-w-[88px]">
                      <p className="text-sm font-bold tabular-nums">
                        {lastViews > 0 ? fmtViews(lastViews) : "—"}
                      </p>
                      {gainMeta.hasData && gainMeta.gain > 0 && (
                        <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums flex items-center justify-end gap-0.5">
                          <TrendingUp size={10} />+{fmtCompactViews(gainMeta.gain)}
                        </p>
                      )}
                      {snap && (snap.likes || snap.comments || snap.shares) ? (
                        <p className="text-[9px] text-muted-foreground tabular-nums">
                          {snap.likes ? `♥${fmtEngagement(snap.likes)} ` : ""}
                          {snap.comments ? `💬${fmtEngagement(snap.comments)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0"
                        onClick={() => setSnapshotModal({ link, snapshot: snap })}
                      >
                        Snapshot
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ManualLinkFormModal
        open={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        brands={brands}
        employees={employees}
        existingLinks={brandLinks}
        onSave={handleNewLink}
      />

      <Modal
        open={snapshotModal !== null}
        onClose={() => setSnapshotModal(null)}
        title={snapshotModal ? `Snapshot — ${linkDisplayTitle(snapshotModal.link)}` : ""}
      >
        {snapshotModal && (
          <LinkSnapshotForm
            link={snapshotModal.link}
            brandName={brands.find((b) => b.id === snapshotModal.link.brandId)?.name}
            allSnapshots={linkSnapshots}
            initial={snapshotModal.snapshot}
            defaultDateForNew={defaultSnapshotDate}
            suggestedViewsForNew={snapshotModal.link.lastViews}
            onSave={(d) => {
              saveSnapshot(snapshotModal.link, d);
              setSnapshotModal(null);
            }}
            onClose={() => setSnapshotModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
