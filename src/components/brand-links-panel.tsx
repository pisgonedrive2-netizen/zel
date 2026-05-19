"use client";

import { useMemo, useState } from "react";
import {
  Plus, Pencil, ExternalLink, RefreshCw, History, Search, Users, Bot, AlertCircle, BarChart3,
} from "lucide-react";
import { detectPlatform } from "@/lib/social-api/platform-detect";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { BrandLogo } from "@/components/brand-logo";
import { useStore, type Brand, type BrandLink, type Employee } from "@/store/store";
import { linkViewsForMonth } from "@/lib/brand-month-metrics";
import { LinkDetailsModal } from "@/components/link-details-modal";

function monthTitleYm(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

function daysAgo(iso?: string) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "bugün";
  if (d === 1) return "dün";
  if (d < 30) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function hoursAgo(iso?: string) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.floor(ms / 60_000)} dk önce`;
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} g önce`;
}

export interface BrandLinksPanelProps {
  brand: Brand | null;
  open: boolean;
  onClose: () => void;
  viewMonth: string;
  todayYm: string;
  readOnly: boolean;
  employees: Employee[];
  onAddLink: (brandId: string) => void;
  onEditLink: (link: BrandLink) => void;
  onAddSnapshot: (link: BrandLink) => void;
  onViewHistory: (link: BrandLink) => void;
}

export function BrandLinksPanel({
  brand,
  open,
  onClose,
  viewMonth,
  todayYm,
  readOnly,
  employees,
  onAddLink,
  onEditLink,
  onAddSnapshot,
  onViewHistory,
}: BrandLinksPanelProps) {
  const { brandLinks, linkSnapshots } = useStore();
  const [search, setSearch] = useState("");
  const [detailsLink, setDetailsLink] = useState<BrandLink | null>(null);

  const links = useMemo(() => {
    if (!brand) return [];
    let list = brandLinks.filter((l) => l.brandId === brand.id);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.platform.toLowerCase().includes(q) ||
          l.handle.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          (employees.find((e) => e.id === l.ownerId)?.name ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const oa = employees.find((e) => e.id === a.ownerId)?.name ?? "zzz";
      const ob = employees.find((e) => e.id === b.ownerId)?.name ?? "zzz";
      if (oa !== ob) return oa.localeCompare(ob, "tr");
      return a.platform.localeCompare(b.platform, "tr");
    });
  }, [brand, brandLinks, search, employees]);

  const grouped = useMemo(() => {
    const map = new Map<string, BrandLink[]>();
    for (const l of links) {
      const key = l.ownerId ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      const na = employees.find((e) => e.id === a)?.name ?? "";
      const nb = employees.find((e) => e.id === b)?.name ?? "";
      return na.localeCompare(nb, "tr");
    });
  }, [links, employees]);

  const empName = (id?: string) =>
    id ? employees.find((e) => e.id === id)?.name ?? "—" : "Atanmamış / genel";

  if (!brand) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`${brand.name} · platform linkleri (${links.length})`}
    >
      <div className="space-y-4 min-h-[200px]">
        <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-border">
          <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{brand.name}</p>
            <p className="text-xs text-muted-foreground">
              Tüm yayıncıların eklediği linkler · {monthTitleYm(viewMonth)}
            </p>
          </div>
          {!readOnly && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => onAddLink(brand.id)}>
              <Plus size={14} /> Link ekle
            </Button>
          )}
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

        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Bu marka için henüz link yok. Yayıncı panelinden veya buradan ekleyebilirsiniz.
          </p>
        ) : (
          <div className="space-y-5 max-h-[min(60vh,560px)] overflow-y-auto pr-1">
            {grouped.map(([ownerKey, groupLinks]) => (
              <section key={ownerKey}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2 sticky top-0 bg-card/95 py-1 z-10">
                  <Users size={13} />
                  {empName(ownerKey === "__none__" ? undefined : ownerKey)}
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {groupLinks.length} link
                  </Badge>
                </h3>
                <div className="space-y-1.5">
                  {groupLinks.map((link) => {
                    const { lastViews, refDate, stale } = linkViewsForMonth(
                      link,
                      viewMonth,
                      linkSnapshots,
                      todayYm
                    );
                    const apiSupported = detectPlatform(link.url, link.platform) != null;
                    return (
                      <div key={link.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/80 px-3 py-2.5 hover:bg-accent/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{link.platform}</span>
                            {link.handle && (
                              <span className="text-xs text-muted-foreground">{link.handle}</span>
                            )}
                            {link.autoTrack && apiSupported && (
                              <Badge
                                variant="outline"
                                className="text-[9px] gap-0.5 border-emerald-300 text-emerald-700 dark:border-emerald-500/45 dark:text-emerald-300"
                                title={
                                  link.lastCheckedAt
                                    ? `Son otomatik kontrol: ${hoursAgo(link.lastCheckedAt)}`
                                    : "Otomatik takip açık, henüz kontrol edilmedi"
                                }
                              >
                                <Bot size={9} /> otomatik
                                {link.lastCheckedAt && (
                                  <span className="opacity-75 ml-1">· {hoursAgo(link.lastCheckedAt)}</span>
                                )}
                              </Badge>
                            )}
                            {link.autoTrack && !apiSupported && (
                              <Badge variant="outline" className="text-[9px]" title="URL tipi otomatik API'lerle desteklenmiyor; manuel snapshot gerekir">
                                otomatik (manuel)
                              </Badge>
                            )}
                            {link.status === "inactive" && (
                              <Badge variant="outline" className="text-[9px]">pasif</Badge>
                            )}
                            {link.lastCheckError && (
                              <Badge variant="outline" className="text-[9px] gap-0.5 border-red-300 text-red-700 dark:border-red-500/45 dark:text-red-300" title={link.lastCheckError}>
                                <AlertCircle size={9} /> hata
                              </Badge>
                            )}
                          </div>
                          {link.url ? (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 truncate max-w-full"
                            >
                              {link.url.replace(/^https?:\/\//, "")}
                              <ExternalLink size={10} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">URL yok</span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums">
                            {lastViews > 0 ? fmtViews(lastViews) : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {stale ? (
                              <span className="text-amber-600">bu ay yok</span>
                            ) : (
                              refDate ? daysAgo(refDate) : "—"
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          {apiSupported && (
                            <button
                              type="button"
                              title="Detaylı veri (API'den canlı çek)"
                              className="p-1.5 rounded hover:bg-accent text-emerald-700 dark:text-emerald-300"
                              onClick={() => setDetailsLink(link)}
                            >
                              <BarChart3 size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Geçmiş"
                            className="p-1.5 rounded hover:bg-accent"
                            onClick={() => onViewHistory(link)}
                          >
                            <History size={13} />
                          </button>
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                title="Snapshot"
                                className="p-1.5 rounded hover:bg-accent text-blue-600"
                                onClick={() => onAddSnapshot(link)}
                              >
                                <RefreshCw size={13} />
                              </button>
                              <button
                                type="button"
                                title="Düzenle"
                                className="p-1.5 rounded hover:bg-accent"
                                onClick={() => onEditLink(link)}
                              >
                                <Pencil size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <LinkDetailsModal
        link={detailsLink}
        open={Boolean(detailsLink)}
        onClose={() => setDetailsLink(null)}
      />
    </Modal>
  );
}
