"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Handshake,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCcw,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { useStore } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
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

type StatusTab = "pending" | "accepted" | "rejected" | "all";

const TAB_STATUS: Record<StatusTab, BrandOfferStatus[] | null> = {
  pending: ["pending", "negotiating"],
  accepted: ["accepted"],
  rejected: ["rejected", "withdrawn", "expired"],
  all: null,
};

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "pending", label: "Bekleyen" },
  { id: "accepted", label: "Kabul edilen" },
  { id: "rejected", label: "Reddedilen" },
  { id: "all", label: "Tümü" },
];

export default function YayinciTekliflerPage() {
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const brands = useStore((s) => s.brands);
  const isAdminView = user?.role === "admin" && !!panelViewAs;

  const [offers, setOffers] = useState<BrandOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const data = await fetchOffers({ role: "streamer" });
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

  const filtered = useMemo(() => {
    const allowed = TAB_STATUS[tab];
    const arr = allowed ? offers.filter((o) => allowed.includes(o.status)) : offers;
    return arr.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [offers, tab]);

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === selectedId) ?? null,
    [offers, selectedId]
  );

  const brandLabel = useCallback(
    (brandId: string) => brands.find((b) => b.id === brandId)?.name ?? brandId,
    [brands]
  );

  if (!user || (!isAdminView && user.role !== "streamer")) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Bu sayfa yalnızca yayıncı hesapları içindir.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#FF6B00]" />
              Marka teklifleri
            </CardTitle>
            <CardDescription>
              Markaların size gönderdiği iş birliği teklifleri.
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
              const allowed = TAB_STATUS[t.id];
              const count = allowed
                ? offers.filter((o) => allowed.includes(o.status)).length
                : offers.length;
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
      ) : filtered.length === 0 ? (
        <EmptyOffers />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((o) => (
            <OfferCard
              key={o.id}
              offer={o}
              brandName={brandLabel(o.brandId)}
              brandId={o.brandId}
              onOpen={() => setSelectedId(o.id)}
            />
          ))}
        </div>
      )}

      <OfferDetailModal
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        offerId={selectedId}
        viewer={{
          role: "streamer",
          displayName: user.name,
          isInitiator: selectedOffer?.initiator === "streamer",
        }}
        brandLabel={
          selectedOffer ? brandLabel(selectedOffer.brandId) : undefined
        }
        streamerLabel={user.name}
        onMutated={() => void load()}
      />
    </div>
  );
}

function OfferCard({
  offer,
  brandName,
  brandId,
  onOpen,
}: {
  offer: BrandOffer;
  brandName: string;
  brandId: string;
  onOpen: () => void;
}) {
  return (
    <Card className="transition-all hover:border-[#FF6B00]/40 hover:shadow-[0_0_22px_-8px_rgba(255,107,0,0.55)]">
      <CardHeader className="flex flex-row items-start gap-3 pb-3">
        <BrandLogo brandId={brandId} title={brandName} size={40} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="truncate text-base">{offer.title}</CardTitle>
            <Badge
              variant="outline"
              className={cn("border", BRAND_OFFER_STATUS_BADGE_CLS[offer.status])}
            >
              {BRAND_OFFER_STATUS_LABELS[offer.status]}
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-1.5">
            <Handshake size={11} /> {brandName}
            <span>·</span>
            <span>{BRAND_OFFER_TYPE_LABELS[offer.offerType]}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {offer.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {offer.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <Mini
            label="Bütçe"
            value={offer.budgetUsd != null ? fmtBrandMoney(offer.budgetUsd, "USD") : "—"}
          />
          <Mini
            label="Deliverable"
            value={`${offer.deliverables.reduce((s, d) => s + d.count, 0)} adet`}
          />
          <Mini label="Güncel" value={fmtDateTime(offer.updatedAt)} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {offer.initiator === "brand" ? "Marka başlattı" : "Sizin başlattığınız teklif"}
          </span>
          <Button size="xs" className="gap-1" onClick={onOpen}>
            <Eye size={11} /> Detay
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function EmptyOffers() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <Inbox size={28} className="mx-auto mb-2 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">Şu an teklif yok</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Markalar size teklif gönderdiğinde burada görünür. Havuz profilinizi
        yayında tutmayı unutmayın.
      </p>
    </div>
  );
}
