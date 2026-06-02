"use client";

import { useMemo } from "react";
import { PostActivityCalendar } from "@/components/streamer-pool/post-activity-calendar";
import { AchievementBrandSyncBar } from "@/components/marka/achievement-brand-sync-bar";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  brandActivityDatesList,
  buildDealActivity,
  scopeBrandActivityData,
} from "@/lib/brand-activity-dates";
import { useStore } from "@/store/store";
import type { BrandDeal, BrandPost } from "@/store/store";

/** Anlaşma detayında yayıncı + teslimat postlarının paylaşım takvimi. */
export function MarkaDealAchievementPanel({
  deal,
  posts,
  monthYm,
  brandName,
}: {
  deal: BrandDeal;
  posts: BrandPost[];
  monthYm: string;
  brandName?: string;
}) {
  const { weekBrandReels, brandPosts, brandLinks, brandDeals } = useStore();

  const scope = useMemo(
    () =>
      scopeBrandActivityData(deal.brandId, {
        weekBrandReels,
        brandPosts,
        brandLinks,
        brandDeals,
      }),
    [deal.brandId, weekBrandReels, brandPosts, brandLinks, brandDeals]
  );

  const activity = useMemo(
    () => buildDealActivity(deal, scope, posts),
    [deal, scope, posts]
  );

  const activityDates = useMemo(
    () => brandActivityDatesList(activity.byDate),
    [activity.byDate]
  );

  return (
    <CollapsibleSection
      defaultOpen
      title="Teslimat takvimi"
      description="Anlaşma postları ve yayıncının bu marka için paylaşım günleri"
    >
      <div className="space-y-3">
        {deal.employeeId && (
          <AchievementBrandSyncBar
            brandId={deal.brandId}
            brandName={brandName}
            employeeId={deal.employeeId}
            compact
          />
        )}
        <PostActivityCalendar
          activityDates={activityDates}
          byDate={activity.byDate}
          initialMonthYm={monthYm}
          title="Paylaşım günleri"
          description="Deliverable ve gerçek paylaşım günleri"
          embedded
        />
      </div>
    </CollapsibleSection>
  );
}
