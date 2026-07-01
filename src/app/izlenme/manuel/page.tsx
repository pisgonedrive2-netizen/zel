"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardEdit,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { useStore, type BrandLink, type LinkSnapshot } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { LinkSnapshotForm } from "@/components/link-snapshot-form";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { linkViewsForMonth, totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import { fmtEngagement } from "@/lib/brand-engagement-metrics";
import { needsManualTracking } from "@/lib/link-tracking-mode";

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

const monthTitleYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

export default function IzlenmeManuelPage() {
  const readOnly = useIsReadOnly();
  const { brands, brandLinks, linkSnapshots, employees, addLinkSnapshot, updateBrandLink } =
    useStore();
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

  const totalManualViews = useMemo(
    () => totalLinkViewsForMonth(manualLinks, viewMonth, linkSnapshots, todayYm),
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

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <header className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Manuel Snapshot</h1>
          <Badge variant="outline" className="text-[10px] gap-1">
            <ClipboardEdit size={10} /> Kick · Twitter · diğer
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
          YouTube, Instagram ve TikTok dışındaki linkler API ile otomatik çekilmez. Personel bu
          sayfadan linki açıp güncel izlenme (ve varsa beğeni/yorum) sayısını girer. Aynı link +
          gün için tek kayıt tutulur; API snapshot&apos;larıyla çift sayım olmaz.
        </p>
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

      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs">Manuel link</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{manualLinks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs">{monthTitleYm(viewMonth)} izlenme</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{fmtViews(totalManualViews)}</CardTitle>
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Kontrol listesi</CardTitle>
          <CardDescription className="text-xs">
            Her link için platformdaki güncel sayıyı kontrol edin, tarihi seçip kaydedin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {manualLinks.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">
              Manuel takip gerektiren aktif link yok. Kick, Twitter vb. linkler marka detayından
              eklenebilir veya mevcut linklerde &quot;Otomatik takip&quot; kapatılabilir.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {manualLinks.map((link) => {
                const brand = brands.find((b) => b.id === link.brandId);
                const owner = link.ownerId
                  ? employees.find((e) => e.id === link.ownerId)
                  : null;
                const monthMeta = linkViewsForMonth(link, viewMonth, linkSnapshots, todayYm);
                const { lastViews, refDate, snapsInMonth } = monthMeta;
                const today = new Date().toISOString().slice(0, 10);
                const updatedToday =
                  viewMonth === todayYm &&
                  snapsInMonth.some((s) => s.date.slice(0, 10) === today);
                const snap = snapsInMonth[0];

                return (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {brand && (
                      <BrandLogo brandId={brand.id} title={brand.name} className="h-8 w-8 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-sm">{link.platform}</span>
                        {link.handle && (
                          <span className="text-xs text-muted-foreground truncate">{link.handle}</span>
                        )}
                        {brand && (
                          <Badge variant="outline" className="text-[9px]">
                            {brand.shortName || brand.name}
                          </Badge>
                        )}
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
                            title="Linki aç"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {snapsInMonth.length} snapshot · {monthTitleYm(viewMonth)}
                        {refDate ? ` · son: ${refDate}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 min-w-[72px]">
                      <p className="text-sm font-bold tabular-nums">
                        {lastViews > 0 ? fmtViews(lastViews) : "—"}
                      </p>
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
                        onClick={() =>
                          setSnapshotModal({
                            link,
                            snapshot: snap,
                          })
                        }
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

      <Modal
        open={snapshotModal !== null}
        onClose={() => setSnapshotModal(null)}
        title={snapshotModal ? `${snapshotModal.link.platform} snapshot` : ""}
      >
        {snapshotModal && (
          <LinkSnapshotForm
            link={snapshotModal.link}
            initial={snapshotModal.snapshot}
            defaultDateForNew={defaultSnapshotDate}
            suggestedViewsForNew={snapshotModal.link.lastViews}
            onSave={(d) => {
              addLinkSnapshot(d);
              updateBrandLink(snapshotModal.link.id, {
                lastViews: d.views,
                lastSnapshotDate: d.date.slice(0, 10),
                lastLikes: d.likes,
                lastComments: d.comments,
                lastShares: d.shares,
                autoTrack: false,
              });
              setSnapshotModal(null);
            }}
            onClose={() => setSnapshotModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
