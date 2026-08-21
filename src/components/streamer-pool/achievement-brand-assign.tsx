"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  assignAchievementItemsToBrand,
  mergeAssignedAchievementIntoStore,
} from "@/lib/achievement-api";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import type { ActivityDayItem } from "@/lib/streamer-activity-dates";
import type { Brand } from "@/store/store";

const selectCls =
  "h-7 max-w-[11rem] rounded-md border border-input bg-background px-2 text-[11px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function assignableBrandsForPicker(brands: Brand[], lockedBrandId?: string): Brand[] {
  const list = brands.filter((b) => b.status !== "inactive");
  list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  if (lockedBrandId) return list.filter((b) => b.id === lockedBrandId);
  return list;
}

export function AchievementBrandAssignBar({
  employeeId,
  date,
  items,
  lockedBrandId,
  assignable,
  onItemsPatched,
}: {
  employeeId: string;
  date: string;
  items: ActivityDayItem[];
  lockedBrandId?: string;
  assignable: Brand[];
  onItemsPatched: (next: ActivityDayItem[]) => void;
}) {

  const unassigned = items.filter((it) => !it.brandId);
  const [bulkBrandId, setBulkBrandId] = useState(lockedBrandId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function assign(brandId: string, targets: ActivityDayItem[]) {
    if (!brandId || targets.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await assignAchievementItemsToBrand({
        employeeId,
        brandId,
        date,
        items: targets.map((it) => ({ id: it.id, url: it.url, platform: it.platform })),
      });
      mergeAssignedAchievementIntoStore(result);
      if (result.assigned === 0) {
        setMessage(result.errors[0] ?? "Atama yapılamadı");
        return;
      }
      const assignedIds = new Set([
        ...(result.reelPatches ?? []).map((p) => p.id),
        ...targets.filter((t) => t.id.startsWith("post-")).map((t) => t.id),
      ]);
      const assignedUrls = new Set(
        (result.links ?? []).map((l) => l.url.trim().toLowerCase())
      );
      onItemsPatched(
        items.map((it) => {
          const patch = (result.reelPatches ?? []).find((p) => p.id === it.id);
          if (patch) {
            return {
              ...it,
              brandId: patch.brandId,
              brandLinkId: patch.brandLinkId,
              views: patch.views ?? it.views,
              source: "link" as const,
            };
          }
          if (
            result.assigned > 0 &&
            (assignedIds.has(it.id) || assignedUrls.has(it.url.trim().toLowerCase()))
          ) {
            const link = (result.links ?? []).find(
              (l) => l.url.trim().toLowerCase() === it.url.trim().toLowerCase()
            );
            return {
              ...it,
              brandId,
              brandLinkId: link?.id ?? it.brandLinkId,
              source: it.source === "post" ? it.source : "link",
            };
          }
          return it;
        })
      );
      const brandName = assignable.find((b) => b.id === brandId)?.name ?? "marka";
      const extra =
        result.errors.length > 0 ? ` · ${result.errors.length} uyarı` : "";
      setMessage(
        `${result.assigned} paylaşım ${brandName} izlenmesine yazıldı${
          result.refreshed ? ` · ${result.refreshed} izlenme yenilendi` : ""
        }${extra}`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Atama başarısız");
    } finally {
      setBusy(false);
    }
  }

  if (assignable.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Sistemde aktif marka yok — marka eklenince burada seçilir.
      </p>
    );
  }

  const bulkId = lockedBrandId || bulkBrandId;
  const lockedName = assignable[0]?.name;

  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/80 p-2">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Marka seçince paylaşım o markanın izlenme sayfasına yazılır; izlenme paylaşım
        tarihinden takip edilir. Yeni eklenen markalar listede görünür.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {lockedBrandId ? (
          <span className="text-[11px] font-medium text-foreground">{lockedName}</span>
        ) : (
          <select
            className={selectCls}
            value={bulkBrandId}
            disabled={busy}
            onChange={(e) => setBulkBrandId(e.target.value)}
            aria-label="Toplu marka"
          >
            <option value="">Marka seç…</option>
            {assignable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shortName || b.name}
              </option>
            ))}
          </select>
        )}
        <Button
          type="button"
          size="xs"
          disabled={busy || !bulkId || unassigned.length === 0}
          onClick={() => void assign(bulkId, unassigned)}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : null}
          Atanmamışları yaz
          {unassigned.length > 0 ? ` (${unassigned.length})` : ""}
        </Button>
        {bulkId ? (
          <Link
            href={`/izlenme/marka/${bulkId}`}
            className="text-[10px] text-blue-600 hover:underline dark:text-blue-400"
          >
            İzlenme sayfası
          </Link>
        ) : null}
      </div>
      {message ? (
        <p className="text-[10px] text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}

export function AchievementBrandRowSelect({
  employeeId,
  date,
  item,
  items,
  lockedBrandId,
  assignable,
  brandName,
  onItemsPatched,
}: {
  employeeId: string;
  date: string;
  item: ActivityDayItem;
  items: ActivityDayItem[];
  lockedBrandId?: string;
  assignable: Brand[];
  brandName?: string;
  onItemsPatched: (next: ActivityDayItem[]) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onChange(brandId: string) {
    if (!brandId || brandId === (item.brandId ?? "")) return;
    setBusy(true);
    try {
      const result = await assignAchievementItemsToBrand({
        employeeId,
        brandId,
        date,
        items: [{ id: item.id, url: item.url, platform: item.platform }],
      });
      mergeAssignedAchievementIntoStore(result);
      if (result.assigned === 0) return;
      const patch = result.reelPatches?.[0];
      onItemsPatched(
        items.map((it) =>
          it.id === item.id
            ? {
                ...it,
                brandId,
                brandLinkId: patch?.brandLinkId ?? result.links?.[0]?.id ?? it.brandLinkId,
                views: patch?.views ?? it.views,
                source: it.source === "post" ? it.source : "link",
              }
            : it
        )
      );
    } catch {
      /* mesaj üst barda */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lockedBrandId ? (
        item.brandId === lockedBrandId ? (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            {brandName ?? "Bu marka"}
          </span>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={busy || assignable.length === 0}
            onClick={() => void onChange(lockedBrandId)}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            Bu markaya ata
          </Button>
        )
      ) : (
        <select
          className={selectCls}
          value={item.brandId ?? ""}
          disabled={busy || assignable.length === 0}
          aria-label="Marka"
          onChange={(e) => void onChange(e.target.value)}
        >
          <option value="">{busy ? "Yazılıyor…" : "Marka seç…"}</option>
          {assignable.map((b) => (
            <option key={b.id} value={b.id}>
              {b.shortName || b.name}
            </option>
          ))}
        </select>
      )}
      {item.brandId ? (
        <Link
          href={`/izlenme/marka/${item.brandId}`}
          className="text-[10px] text-blue-600 hover:underline dark:text-blue-400"
        >
          İzlenme
        </Link>
      ) : null}
      {item.views != null && item.views > 0 ? (
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {fmtCompactViews(item.views)} izlenme
        </span>
      ) : null}
    </div>
  );
}
