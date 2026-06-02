"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Handshake,
  Clock,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaStatGrid } from "@/components/marka/marka-stat-grid";
import { computeOfferStats } from "@/lib/marka-brand-insights";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useStore } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/fmt-date";
import { fetchOffers, isPoolNotReadyError } from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import { OfferDetailModal } from "@/components/streamer-pool/offer-detail-modal";
import {
  BRAND_OFFER_STATUS_BADGE_CLS,
  BRAND_OFFER_STATUS_LABELS,
  BRAND_OFFER_TYPE_LABELS,
  type BrandOfferStatus,
} from "@/types/streamer-pool";
import type { BrandOffer } from "@/store/store";

type StatusTab = "active" | "completed" | "cancelled";

const TAB_STATUSES: Record<StatusTab, BrandOfferStatus[]> = {
  active: ["pending", "negotiating"],
  completed: ["accepted"],
  cancelled: ["rejected", "withdrawn", "expired"],
};

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "active", label: "Aktif" },
  { id: "completed", label: "Tamamlanmış" },
  { id: "cancelled", label: "İptal / Red" },
];

export default function MarkaTekliflerPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand, month } = portal;
  const employees = useStore((s) => s.employees);

  const [offers, setOffers] = useState<BrandOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const data = await fetchOffers({ role: "brand" });
      setOffers(data);
    } catch (err) {
      if (isPoolNotReadyError(err)) {
        setNotReady(true);
        setOffers([]);
      } else {
        setError(err instanceof Error ? err.message : "Yükleme hatası");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const brandOffersFiltered = useMemo(
    () => (brandId ? offers.filter((o) => o.brandId === brandId) : offers),
    [offers, brandId]
  );

  const filteredOffers = useMemo(() => {
    const allowed = new Set(TAB_STATUSES[tab]);
    return brandOffersFiltered
      .filter((o) => allowed.has(o.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [brandOffersFiltered, tab]);

  const employeeLabel = useCallback(
    (employeeId: string): string => {
      const e = employees.find((emp) => emp.id === employeeId);
      return e?.name ?? employeeId;
    },
    [employees]
  );

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === selectedId) ?? null,
    [offers, selectedId]
  );

  const offerStats = useMemo(
    () => (brandId ? computeOfferStats(offers, brandId, month) : null),
    [offers, brandId, month]
  );

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          {offerStats && (
            <MarkaStatGrid
              columns={4}
              items={[
                {
                  label: "Bekleyen",
                  value: fmtBrandCount(offerStats.pending),
                  sub: "yeni teklif",
                  icon: <Clock size={18} />,
                  tone: "amber",
                },
                {
                  label: "Müzakere",
                  value: fmtBrandCount(offerStats.negotiating),
                  sub: fmtBrandMoney(offerStats.activeBudgetUsd, "USD") + " bütçe",
                  icon: <MessageSquare size={18} />,
                  tone: "blue",
                },
                {
                  label: "Kabul (ay)",
                  value: fmtBrandCount(offerStats.acceptedThisMonth),
                  sub: `${offerStats.accepted} toplam`,
                  icon: <CheckCircle2 size={18} />,
                  tone: "green",
                },
                {
                  label: "Red",
                  value: fmtBrandCount(offerStats.rejected),
                  icon: <Handshake size={18} />,
                  tone: "zinc",
                },
              ]}
            />
          )}

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#FF6B00]" />
                  Teklifler
                </CardTitle>
                <CardDescription>
                  {brand.name} markası için gelen ve gönderilen teklifler.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCcw size={12} className={loading ? "animate-spin" : undefined} />
                Yenile
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 overflow-x-auto border-b border-border">
                {TABS.map((t) => {
                  const count = offers.filter((o) =>
                    TAB_STATUSES[t.id].includes(o.status)
                  ).length;
                  const active = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "relative shrink-0 px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span>{t.label}</span>
                      <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
                        ({count})
                      </span>
                      {active && (
                        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#FF6B00]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {notReady && <PoolServerBanner />}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Yükleniyor…
            </div>
          ) : filteredOffers.length === 0 ? (
            <EmptyOffers tab={tab} notReady={notReady} />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Yayıncı</th>
                      <th className="px-4 py-2 font-medium">Başlık</th>
                      <th className="px-4 py-2 font-medium">Tip</th>
                      <th className="px-4 py-2 text-right font-medium">Bütçe</th>
                      <th className="px-4 py-2 font-medium">Son aktivite</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                      <th className="px-4 py-2 text-right font-medium">Eylem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffers.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">
                            {employeeLabel(o.employeeId)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {o.initiator === "brand"
                              ? "Marka başlattı"
                              : "Yayıncı başlattı"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 max-w-[280px]">
                          <div className="truncate font-medium text-foreground">
                            {o.title}
                          </div>
                          {o.description && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {o.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {BRAND_OFFER_TYPE_LABELS[o.offerType]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {o.budgetUsd != null
                            ? fmtBrandMoney(o.budgetUsd, "USD")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {fmtDateTime(o.updatedAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border text-[10px]",
                              BRAND_OFFER_STATUS_BADGE_CLS[o.status]
                            )}
                          >
                            {BRAND_OFFER_STATUS_LABELS[o.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            size="xs"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setSelectedId(o.id)}
                          >
                            <Eye size={11} /> Detay
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <OfferDetailModal
            open={selectedId !== null}
            onClose={() => setSelectedId(null)}
            offerId={selectedId}
            viewer={{
              role: "brand",
              displayName: brand.name,
              isInitiator: selectedOffer?.initiator === "brand",
            }}
            brandLabel={brand.name}
            streamerLabel={
              selectedOffer ? employeeLabel(selectedOffer.employeeId) : undefined
            }
            onMutated={() => void load()}
          />
        </div>
      )}
    </MarkaPageGuard>
  );
}

function EmptyOffers({ tab, notReady }: { tab: StatusTab; notReady: boolean }) {
  if (notReady) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <Inbox size={28} className="mx-auto mb-2 text-muted-foreground/70" />
        <p className="text-sm font-medium text-foreground">Henüz teklif yok</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sunucu hazırlandıktan sonra teklifler burada görünecek.
        </p>
      </div>
    );
  }
  const labelByTab: Record<StatusTab, { title: string; sub: string }> = {
    active: {
      title: "Aktif teklif yok",
      sub: "Yayıncı havuzundan yeni teklif başlatabilirsiniz.",
    },
    completed: {
      title: "Tamamlanmış teklif yok",
      sub: "Kabul edilen teklifler burada birikir.",
    },
    cancelled: {
      title: "İptal/red teklif yok",
      sub: "Reddedilen veya geri çekilen teklifler burada görünür.",
    },
  };
  const info = labelByTab[tab];
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <Inbox size={28} className="mx-auto mb-2 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">{info.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{info.sub}</p>
    </div>
  );
}
