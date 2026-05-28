"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  Eye,
  FileSignature,
  Handshake,
  Loader2,
  RefreshCcw,
  Video,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useStore } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { fmtDateOnly } from "@/lib/fmt-date";
import { fetchDeals, isPoolNotReadyError } from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import {
  BRAND_DEAL_STATUS_BADGE_CLS,
  BRAND_DEAL_STATUS_LABELS,
  BRAND_DEAL_TYPE_LABELS,
  type BrandDealStatus,
} from "@/types/brand-deals";
import type { BrandDeal } from "@/store/store";

type StatusTab = "active" | "completed" | "cancelled";

const TAB_STATUSES: Record<StatusTab, BrandDealStatus[]> = {
  active: ["active", "disputed"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "active", label: "Aktif" },
  { id: "completed", label: "Tamamlanmış" },
  { id: "cancelled", label: "İptal" },
];

export default function MarkaAnlasmalarPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand } = portal;
  const employees = useStore((s) => s.employees);

  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>("active");

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const data = await fetchDeals({ brandId });
      setDeals(data);
    } catch (err) {
      if (isPoolNotReadyError(err)) {
        setNotReady(true);
        setDeals([]);
      } else {
        setError(err instanceof Error ? err.message : "Yükleme hatası");
      }
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const allowed = new Set(TAB_STATUSES[tab]);
    return deals
      .filter((d) => allowed.has(d.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [deals, tab]);

  const employeeLabel = useCallback(
    (employeeId: string): string => {
      const e = employees.find((emp) => emp.id === employeeId);
      return e?.name ?? employeeId;
    },
    [employees]
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
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Handshake size={16} className="text-[#22C55E]" />
                  Anlaşmalar
                </CardTitle>
                <CardDescription>
                  Kabul edilen teklifler bu sayfada aktif anlaşma olarak takip edilir.
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
                  const count = deals.filter((d) =>
                    TAB_STATUSES[t.id].includes(d.status)
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
                        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#22C55E]" />
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
          ) : filtered.length === 0 ? (
            <EmptyDeals tab={tab} notReady={notReady} />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  streamerLabel={employeeLabel(deal.employeeId)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </MarkaPageGuard>
  );
}

function DealCard({
  deal,
  streamerLabel,
}: {
  deal: BrandDeal;
  streamerLabel: string;
}) {
  const pct =
    deal.budgetUsd > 0
      ? Math.min(100, (deal.paidUsd / deal.budgetUsd) * 100)
      : 0;
  return (
    <Card className="transition-all hover:border-[#22C55E]/40 hover:shadow-[0_0_22px_-8px_rgba(34,197,94,0.45)]">
      <CardHeader className="flex flex-col gap-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn("border", BRAND_DEAL_STATUS_BADGE_CLS[deal.status])}
          >
            {BRAND_DEAL_STATUS_LABELS[deal.status]}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {BRAND_DEAL_TYPE_LABELS[deal.dealType]}
          </Badge>
        </div>
        <CardTitle className="line-clamp-2 text-base">{deal.title}</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <Handshake size={11} /> {streamerLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Ödenen</span>
            <span className="tabular-nums">
              <strong className="text-foreground">
                {fmtBrandMoney(deal.paidUsd, "USD")}
              </strong>
              <span className="text-muted-foreground">
                {" "}
                / {fmtBrandMoney(deal.budgetUsd, "USD")}
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <Mini icon={Video} label="Post" value={deal.postsCount.toLocaleString("tr-TR")} />
          <Mini icon={Eye} label="İzlenme" value={fmtCompactViews(Number(deal.totalViews))} />
          <Mini
            icon={CalendarRange}
            label="Tarih"
            value={
              deal.startDate || deal.endDate
                ? `${deal.startDate ? fmtDateOnly(deal.startDate) : "—"}\n${deal.endDate ? fmtDateOnly(deal.endDate) : "—"}`
                : "—"
            }
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/marka/anlasmalar/${deal.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-[#22C55E]/10 px-2 py-1 text-[11px] font-semibold text-[#16A34A] hover:bg-[#22C55E]/15 dark:text-[#4ADE80]"
          >
            <FileSignature size={11} /> Detay
            <ArrowUpRight size={11} />
          </Link>
          {deal.contractUrl && (
            <a
              href={deal.contractUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Sözleşme PDF
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon size={10} />
        <span>{label}</span>
      </div>
      <div className="mt-0.5 whitespace-pre-line text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function EmptyDeals({ tab, notReady }: { tab: StatusTab; notReady: boolean }) {
  if (notReady) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <Handshake size={28} className="mx-auto mb-2 text-muted-foreground/70" />
        <p className="text-sm font-medium text-foreground">Henüz anlaşma yok</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sunucu hazırlandıktan sonra anlaşmalar burada görünecek.
        </p>
      </div>
    );
  }
  const labels: Record<StatusTab, { title: string; sub: string }> = {
    active: {
      title: "Aktif anlaşma yok",
      sub: "Bir teklif kabul edildiğinde otomatik olarak burada görünür.",
    },
    completed: {
      title: "Tamamlanmış anlaşma yok",
      sub: "Anlaşmaları tamamlandı olarak işaretledikçe burada birikir.",
    },
    cancelled: {
      title: "İptal anlaşma yok",
      sub: "İptal edilen anlaşmalar burada görünür.",
    },
  };
  const info = labels[tab];
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <Handshake size={28} className="mx-auto mb-2 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">{info.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{info.sub}</p>
    </div>
  );
}
