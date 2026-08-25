"use client";

import { Search, Filter } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { cn } from "@/lib/utils";
import type { BrandLinkKindFilter, BrandLinkSortKey } from "@/lib/brand-link-display";
import { BRAND_LINK_KIND_LABEL, type BrandLinkKind } from "@/lib/brand-link-kind";

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

export function BrandLinkListToolbar({
  search,
  onSearchChange,
  platform,
  onPlatformChange,
  platforms,
  ownerId,
  onOwnerChange,
  owners,
  sortKey,
  onSortChange,
  kind,
  onKindChange,
  kindCounts,
  platformSummary,
  monthOnly,
  onMonthOnlyChange,
  showMonthToggle = true,
  className,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  platform: string;
  onPlatformChange: (v: string) => void;
  platforms: string[];
  ownerId: string;
  onOwnerChange: (v: string) => void;
  owners: { id: string; name: string }[];
  sortKey: BrandLinkSortKey;
  onSortChange: (v: BrandLinkSortKey) => void;
  kind?: BrandLinkKindFilter;
  onKindChange?: (v: BrandLinkKindFilter) => void;
  kindCounts?: Partial<Record<BrandLinkKind, number>>;
  platformSummary?: { platform: string; count: number; views: number }[];
  monthOnly?: boolean;
  onMonthOnlyChange?: (v: boolean) => void;
  showMonthToggle?: boolean;
  className?: string;
}) {
  const kindValue = kind ?? "all";
  const kindOptions: { value: BrandLinkKindFilter; label: string }[] = [
    { value: "all", label: "Tümü" },
    { value: "content", label: BRAND_LINK_KIND_LABEL.content },
    { value: "profile", label: BRAND_LINK_KIND_LABEL.profile },
    { value: "other", label: BRAND_LINK_KIND_LABEL.other },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      {platformSummary && platformSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {platformSummary.map((p) => (
            <button
              key={p.platform}
              type="button"
              onClick={() => onPlatformChange(platform === p.platform ? "all" : p.platform)}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left transition-colors",
                platform === p.platform
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <SocialPlatformIcon platform={p.platform} size={12} />
                {p.platform}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtViews(p.views)}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">{p.count} link</p>
            </button>
          ))}
        </div>
      )}

      {onKindChange && (
        <div className="flex flex-wrap gap-1">
          {kindOptions.map((opt) => {
            const count =
              opt.value === "all" ? undefined : kindCounts?.[opt.value as BrandLinkKind];
            if (opt.value !== "all" && count === 0) return null;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onKindChange(opt.value)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  kindValue === opt.value
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
                {count != null ? ` · ${count}` : ""}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Platform, handle, URL, yayıncı…"
            className="!h-8 !text-xs !pl-8"
          />
        </div>
        <Select
          value={platform}
          onChange={(e) => onPlatformChange(e.target.value)}
          className="h-8 text-xs min-w-[110px]"
          options={[
            { value: "all", label: "Tüm platformlar" },
            ...platforms.map((p) => ({ value: p, label: p })),
          ]}
        />
        {owners.length > 0 && (
          <Select
            value={ownerId}
            onChange={(e) => onOwnerChange(e.target.value)}
            className="h-8 text-xs min-w-[120px]"
            options={[
              { value: "all", label: "Tüm yayıncılar" },
              ...owners.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
        )}
        <Select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as BrandLinkSortKey)}
          className="h-8 text-xs min-w-[100px]"
          options={[
            { value: "views", label: "İzlenme ↓" },
            { value: "platform", label: "Platform" },
            { value: "handle", label: "Handle" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {platforms.slice(0, 8).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPlatformChange(platform === p ? "all" : p)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
              platform === p
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
            )}
          >
            <SocialPlatformIcon platform={p} size={14} />
            {p}
          </button>
        ))}
        {showMonthToggle && onMonthOnlyChange != null && (
          <label className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
            <Filter size={11} />
            <input
              type="checkbox"
              checked={monthOnly ?? false}
              onChange={(e) => onMonthOnlyChange(e.target.checked)}
              className="rounded"
            />
            Yalnızca bu ay verisi
          </label>
        )}
      </div>
    </div>
  );
}
