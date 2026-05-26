"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Users } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { BrandLinkListToolbar } from "@/components/brand-link-list-toolbar";
import { BrandLinkThumb } from "@/components/brand-link-thumb";
import { SocialPlatformIcon, platformAccentClass } from "@/components/social-platform-icon";
import {
  enrichBrandLinksForMonth,
  filterBrandLinksDisplay,
  platformOptionsFromLinks,
  sortBrandLinksDisplay,
  type BrandLinkSortKey,
} from "@/lib/brand-link-display";
import type { Brand, BrandLink, Employee, LinkSnapshot } from "@/store/store";
import { monthLabelTr } from "@/hooks/use-marka-portal";

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

export interface MarkaLinksPreviewModalProps {
  brand: Brand;
  open: boolean;
  onClose: () => void;
  monthYm: string;
  todayYm: string;
  links: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  employees: Employee[];
}

export function MarkaLinksPreviewModal({
  brand,
  open,
  onClose,
  monthYm,
  todayYm,
  links,
  linkSnapshots,
  employees,
}: MarkaLinksPreviewModalProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [ownerId, setOwnerId] = useState("all");
  const [sortKey, setSortKey] = useState<BrandLinkSortKey>("views");
  const [monthOnly, setMonthOnly] = useState(true);

  const enriched = useMemo(
    () => enrichBrandLinksForMonth(links, monthYm, linkSnapshots, todayYm, employees),
    [links, monthYm, linkSnapshots, todayYm, employees]
  );

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of links) {
      const id = l.ownerId ?? "_none";
      const name = l.ownerId
        ? employees.find((e) => e.id === l.ownerId)?.name ?? "?"
        : "Genel / atanmamış";
      map.set(id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [links, employees]);

  const platforms = useMemo(() => platformOptionsFromLinks(links), [links]);

  const filtered = useMemo(() => {
    const list = filterBrandLinksDisplay(enriched, {
      search,
      platform,
      ownerId,
      monthOnly,
      monthYm,
      todayYm,
    });
    return sortBrandLinksDisplay(list, sortKey);
  }, [enriched, search, platform, ownerId, monthOnly, monthYm, todayYm, sortKey]);

  const totalViews = filtered.reduce((s, r) => s + r.lastViews, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`${brand.name} · marka linkleri`}
    >
      <div className="space-y-4 min-h-[280px]">
        <p className="text-sm text-muted-foreground">
          {monthLabelTr(monthYm)} · {filtered.length} / {links.length} link · toplam{" "}
          <span className="font-semibold text-foreground tabular-nums">{fmtViews(totalViews)}</span>
        </p>

        <BrandLinkListToolbar
          search={search}
          onSearchChange={setSearch}
          platform={platform}
          onPlatformChange={setPlatform}
          platforms={platforms}
          ownerId={ownerId}
          onOwnerChange={setOwnerId}
          owners={owners}
          sortKey={sortKey}
          onSortChange={setSortKey}
          monthOnly={monthOnly}
          onMonthOnlyChange={setMonthOnly}
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Filtrelere uyan link yok. &quot;Bu ay verisi&quot; kutusunu kaldırmayı deneyin.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 max-h-[min(65vh,520px)] overflow-y-auto pr-1">
            {filtered.map((link) => (
              <div
                key={link.id}
                className={`rounded-xl border px-3 py-3 transition-colors ${platformAccentClass(link.platform)}`}
              >
                <div className="flex items-start gap-3">
                  <BrandLinkThumb link={link} className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm inline-flex items-center gap-1">
                        <SocialPlatformIcon platform={link.platform} size={16} />
                        {link.platform}
                      </span>
                      <Badge
                        variant={link.lastViews > 0 ? "secondary" : "outline"}
                        className="tabular-nums shrink-0"
                      >
                        {link.lastViews > 0 ? fmtViews(link.lastViews) : "—"}
                      </Badge>
                    </div>
                    {link.handle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{link.handle}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Users size={10} />
                      {link.ownerName}
                    </p>
                    {link.stale && monthYm !== todayYm && (
                      <Badge variant="outline" className="text-[9px] mt-1">
                        Bu ay snapshot yok
                      </Badge>
                    )}
                    {link.refDate && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Referans: {link.refDate}
                      </p>
                    )}
                    {link.url ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 mt-1.5 break-all hover:underline"
                      >
                        {link.url.replace(/^https?:\/\/(www\.)?/, "")}
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground mt-1">URL henüz yok</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
