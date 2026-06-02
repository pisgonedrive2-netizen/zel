"use client";

import Link from "next/link";
import { CalendarCheck, FileVideo, Link2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AchievementBrandSyncBar } from "@/components/marka/achievement-brand-sync-bar";
import { MarkaStatGrid } from "@/components/marka/marka-stat-grid";
import { computeMarkaContentInsights, type MarkaStoreSlice } from "@/lib/marka-brand-insights";
import { fmtBrandCount } from "@/lib/brand-monthly-stats";
import { markaHref } from "@/lib/use-marka-view-month";
import { useMemo } from "react";

/** Operasyon / anasayfa için içerik teslimi özeti + senkron CTA. */
export function MarkaContentOverviewCard({
  brandId,
  brandName,
  monthYm,
  monthTitle,
  storeSlice,
  showSync = true,
  compact = false,
}: {
  brandId: string;
  brandName?: string;
  monthYm: string;
  monthTitle: string;
  storeSlice: MarkaStoreSlice;
  showSync?: boolean;
  compact?: boolean;
}) {
  const insights = useMemo(
    () => computeMarkaContentInsights(brandId, monthYm, storeSlice),
    [brandId, monthYm, storeSlice]
  );

  const izlenmeHref = markaHref("/marka/izlenmeler", monthYm);
  const postlarHref = "/marka/postlar";
  const takvimHref = markaHref("/marka/takvim", monthYm);

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck size={16} className="text-emerald-600" />
          İçerik teslimi · {monthTitle}
        </CardTitle>
        <CardDescription>
          Paylaşım günleri, post/reel ve marka linkleri — yayıncı partner performansı
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MarkaStatGrid
          columns={compact ? 4 : 4}
          items={[
            {
              label: "Paylaşım günü",
              value: fmtBrandCount(insights.sharingDaysMonth),
              sub: "achievement takvimi",
              icon: <CalendarCheck size={18} />,
              tone: "green",
              href: izlenmeHref,
            },
            {
              label: "Partner yayıncı",
              value: fmtBrandCount(insights.partnerCount),
              sub: "link sahibi",
              icon: <Users size={18} />,
              tone: "blue",
              href: takvimHref,
            },
            {
              label: "Post / reel",
              value: `${insights.postsMonth} / ${insights.reelsMonth}`,
              sub: "bu ay kayıtlı",
              icon: <FileVideo size={18} />,
              tone: "violet",
              href: postlarHref,
            },
            {
              label: "Aktif link",
              value: fmtBrandCount(insights.activeLinks),
              sub: `${insights.linksWithOwner} yayıncıya atanmış`,
              icon: <Link2 size={18} />,
              tone: "amber",
              href: izlenmeHref,
            },
          ]}
        />
        {showSync && (
          <AchievementBrandSyncBar brandId={brandId} brandName={brandName} compact={compact} />
        )}
        <p className="text-[11px] text-muted-foreground">
          Detaylı takvim ve grafikler için{" "}
          <Link href={izlenmeHref} className="text-primary underline">
            İzlenmeler
          </Link>
          {" · "}
          <Link href={takvimHref} className="text-primary underline">
            Yayıncı takvimi
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
