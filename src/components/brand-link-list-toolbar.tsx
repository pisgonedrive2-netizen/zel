"use client";

import { Search, Filter } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { cn } from "@/lib/utils";
import type { BrandLinkSortKey } from "@/lib/brand-link-display";

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
  monthOnly?: boolean;
  onMonthOnlyChange?: (v: boolean) => void;
  showMonthToggle?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
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
