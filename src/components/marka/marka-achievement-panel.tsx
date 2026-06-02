"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { PostActivityCalendar } from "@/components/streamer-pool/post-activity-calendar";
import { AchievementBrandSyncBar } from "@/components/marka/achievement-brand-sync-bar";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Select } from "@/components/ui/field";
import {
  brandActivityDatesList,
  brandPartnerEmployeeIds,
  buildBrandAggregatedActivity,
  buildBrandStreamerActivity,
  scopeBrandActivityData,
} from "@/lib/brand-activity-dates";
import { useStore } from "@/store/store";
import type { BrandPost } from "@/store/store";

export function MarkaAchievementPanel({
  brandId,
  brandName,
  monthYm,
  showSync = true,
  showStreamerSelect = true,
  defaultEmployeeId = "",
  extraPosts,
  employeeIdsFilter,
  embedded = false,
  defaultOpen = true,
  title = "Paylaşım takvimi",
  description,
}: {
  brandId: string;
  brandName?: string;
  monthYm: string;
  showSync?: boolean;
  showStreamerSelect?: boolean;
  defaultEmployeeId?: string;
  /** API'den gelen postlar (store ile birleştirilir). */
  extraPosts?: BrandPost[];
  /** Yalnızca bu yayıncılar (ör. takvim partner listesi). */
  employeeIdsFilter?: string[];
  embedded?: boolean;
  defaultOpen?: boolean;
  title?: string;
  description?: string;
}) {
  const { weekBrandReels, brandPosts, brandLinks, brandDeals, employees } = useStore();
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || "all");

  useEffect(() => {
    if (defaultEmployeeId) setEmployeeId(defaultEmployeeId);
  }, [defaultEmployeeId]);

  const scope = useMemo(
    () =>
      scopeBrandActivityData(brandId, {
        weekBrandReels,
        brandPosts,
        brandLinks,
        brandDeals,
      }),
    [brandId, weekBrandReels, brandPosts, brandLinks, brandDeals]
  );

  const partnerIds = useMemo(() => {
    const all = brandPartnerEmployeeIds(scope);
    if (!employeeIdsFilter?.length) return all;
    const allowed = new Set(employeeIdsFilter);
    return all.filter((id) => allowed.has(id));
  }, [scope, employeeIdsFilter]);

  const streamerOptions = useMemo(
    () => [
      { value: "all", label: "Tüm yayıncılar" },
      ...partnerIds.map((id) => ({
        value: id,
        label: employees.find((e) => e.id === id)?.name ?? id,
      })),
    ],
    [partnerIds, employees]
  );

  const activity = useMemo(() => {
    if (employeeId && employeeId !== "all") {
      return buildBrandStreamerActivity(employeeId, scope, extraPosts);
    }
    return buildBrandAggregatedActivity(scope, partnerIds, extraPosts);
  }, [employeeId, scope, extraPosts, partnerIds]);

  const activityDates = useMemo(
    () => brandActivityDatesList(activity.byDate),
    [activity.byDate]
  );

  const desc =
    description ??
    (employeeId !== "all"
      ? `${employees.find((e) => e.id === employeeId)?.name ?? "Yayıncı"} — bu marka için paylaşım günleri`
      : `${brandName ?? "Marka"} — tüm partner yayıncıların paylaşım günleri`);

  const calendar = (
    <div className="space-y-3">
      {showSync && (
        <AchievementBrandSyncBar
          brandId={brandId}
          brandName={brandName}
          employeeId={employeeId !== "all" ? employeeId : undefined}
        />
      )}
      {showStreamerSelect && streamerOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <Users size={14} className="text-muted-foreground shrink-0" />
          <Select
            value={employeeId || "all"}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-8 text-xs max-w-[220px]"
            options={streamerOptions}
          />
        </div>
      )}
      <PostActivityCalendar
        activityDates={activityDates}
        byDate={activity.byDate}
        initialMonthYm={monthYm}
        title={title}
        description={desc}
        embedded={embedded}
      />
    </div>
  );

  if (embedded) return calendar;

  return (
    <CollapsibleSection
      defaultOpen={defaultOpen}
      title={title}
      description={desc}
    >
      {calendar}
    </CollapsibleSection>
  );
}
