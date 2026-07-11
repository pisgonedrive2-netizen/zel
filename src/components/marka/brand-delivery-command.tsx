"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileVideo,
  Handshake,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DeliveryItem = {
  id: string;
  title: string;
  meta: string;
  href: string;
  tone: "warn" | "ok" | "info" | "urgent";
};

/**
 * Marka anasayfa — anlaşma / post / takvim teslimat komuta paneli.
 */
export function BrandDeliveryCommand({
  monthTitle,
  pendingOffers,
  activeDeals,
  pendingPosts,
  weekPlans,
  weekShoots,
  gaps,
  items,
}: {
  monthTitle: string;
  pendingOffers: number;
  activeDeals: number;
  pendingPosts: number;
  weekPlans: number;
  weekShoots: number;
  gaps: number;
  items: DeliveryItem[];
}) {
  return (
    <Card className="relative overflow-hidden border-border/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF6B00]/10 via-transparent to-sky-500/10"
      />
      <CardContent className="relative z-10 space-y-4 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FF6B00]">
              Teslimat komuta
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              {monthTitle} · içerik ve anlaşma durumu
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Bekleyen teklif, aktif anlaşma, post onayı ve haftalık çekim boşlukları
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric
            icon={Handshake}
            label="Teklif"
            value={pendingOffers}
            hint="bekleyen"
            hot={pendingOffers > 0}
          />
          <Metric
            icon={CheckCircle2}
            label="Anlaşma"
            value={activeDeals}
            hint="aktif"
          />
          <Metric
            icon={FileVideo}
            label="Post"
            value={pendingPosts}
            hint="bekleyen"
            hot={pendingPosts > 0}
          />
          <Metric
            icon={CalendarDays}
            label="Plan"
            value={weekPlans}
            hint="bu hafta"
          />
          <Metric
            icon={Clock3}
            label="Çekim"
            value={weekShoots}
            hint={gaps > 0 ? `${gaps} boşluk` : "tamam"}
            hot={gaps > 0}
          />
        </div>

        {items.length > 0 && (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-background/60">
            {items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <ToneDot tone={item.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.meta}
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {items.length === 0 && gaps === 0 && pendingOffers === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
            Şu an bekleyen teslimat yok — takvim ve postlar güncel.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  hot,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  hint: string;
  hot?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        hot
          ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-950/30"
          : "border-border/70 bg-background/70"
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={12} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ToneDot({ tone }: { tone: DeliveryItem["tone"] }) {
  if (tone === "urgent") {
    return <AlertTriangle size={14} className="shrink-0 text-amber-600" />;
  }
  if (tone === "warn") {
    return <Badge className="h-2 w-2 shrink-0 rounded-full bg-amber-400 p-0" />;
  }
  if (tone === "ok") {
    return <Badge className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 p-0" />;
  }
  return <Badge className="h-2 w-2 shrink-0 rounded-full bg-sky-500 p-0" />;
}
