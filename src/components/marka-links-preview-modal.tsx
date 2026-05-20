"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search, Users } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SocialPlatformIcon, platformAccentClass } from "@/components/social-platform-icon";
import { linkViewsForMonth } from "@/lib/brand-month-metrics";
import type { Brand, BrandLink, Employee, LinkSnapshot } from "@/store/store";
import { monthLabelTr } from "@/hooks/use-marka-portal";

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

const PREVIEW_PLATFORMS = ["YouTube", "Instagram", "TikTok", "Kick", "Twitch", "Telegram"];

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

  const enriched = useMemo(() => {
    let list = links.map((link) => {
      const meta = linkViewsForMonth(link, monthYm, linkSnapshots, todayYm);
      return { link, ...meta };
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (row) =>
          row.link.platform.toLowerCase().includes(q) ||
          row.link.handle.toLowerCase().includes(q) ||
          row.link.url.toLowerCase().includes(q) ||
          (employees.find((e) => e.id === row.link.ownerId)?.name ?? "")
            .toLowerCase()
            .includes(q)
      );
    }
    return list.sort((a, b) => {
      if (b.lastViews !== a.lastViews) return b.lastViews - a.lastViews;
      return a.link.platform.localeCompare(b.link.platform, "tr");
    });
  }, [links, monthYm, linkSnapshots, todayYm, search, employees]);

  const totalViews = enriched.reduce((s, r) => s + r.lastViews, 0);
  const empName = (id?: string) =>
    id ? employees.find((e) => e.id === id)?.name ?? "—" : "Genel / atanmamış";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`${brand.name} · tüm marka linkleri`}
    >
      <div className="space-y-4 min-h-[280px]">
        <p className="text-sm text-muted-foreground">
          {monthLabelTr(monthYm)} ayı için izlenme önizlemesi · toplam{" "}
          <span className="font-semibold text-foreground tabular-nums">{fmtViews(totalViews)}</span>
        </p>

        <div className="flex flex-wrap gap-2 pb-1 border-b border-border">
          {PREVIEW_PLATFORMS.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium"
            >
              <SocialPlatformIcon platform={p} size={16} />
              {p}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Platform, handle, URL veya yayıncı ara..."
            className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        {enriched.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Bu ay için eşleşen link yok.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 max-h-[min(65vh,520px)] overflow-y-auto pr-1">
            {enriched.map(({ link, lastViews, refDate, stale }) => (
              <div
                key={link.id}
                className={`rounded-xl border px-3 py-3 transition-colors ${platformAccentClass(link.platform)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-background/80 p-2 border border-border/50 shrink-0">
                    <SocialPlatformIcon platform={link.platform} size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{link.platform}</span>
                      <Badge
                        variant={lastViews > 0 ? "secondary" : "outline"}
                        className="tabular-nums shrink-0"
                      >
                        {lastViews > 0 ? fmtViews(lastViews) : "—"}
                      </Badge>
                    </div>
                    {link.handle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{link.handle}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Users size={10} />
                      {empName(link.ownerId)}
                    </p>
                    {stale && monthYm !== todayYm && (
                      <Badge variant="outline" className="text-[9px] mt-1">
                        Bu ay snapshot yok
                      </Badge>
                    )}
                    {refDate && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Referans: {refDate}
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
