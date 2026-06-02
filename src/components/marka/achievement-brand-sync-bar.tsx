"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncMarkaAchievementFromLinks } from "@/lib/marka-achievement-sync-api";
import { useStore } from "@/store/store";
import type { WeekBrandReel } from "@/store/store";

function mergeBrandReelsIntoStore(reels: WeekBrandReel[], brandId: string) {
  useStore.setState((s) => {
    const others = s.weekBrandReels.filter((r) => r.brandId !== brandId);
    const byId = new Map(others.map((r) => [r.id, r]));
    for (const r of reels) byId.set(r.id, r);
    return { weekBrandReels: [...byId.values()] };
  });
}

/**
 * Marka kapsamındaki yayıncı linklerinden achievement / week_brand_reels senkronu.
 */
export function AchievementBrandSyncBar({
  brandId,
  brandName,
  employeeId,
  compact = false,
}: {
  brandId: string;
  brandName?: string;
  /** Yalnızca bu yayıncının linkleri (opsiyonel). */
  employeeId?: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const run = async () => {
    if (!brandId || loading) return;
    setLoading(true);
    setHint(null);
    try {
      const res = await syncMarkaAchievementFromLinks(brandId, employeeId);
      if (res.reels?.length) mergeBrandReelsIntoStore(res.reels, brandId);
      const s = res.summary;
      if (s) {
        setHint(
          `${s.synced} güncellendi · ${s.skipped} atlandı` +
            (s.failed > 0 ? ` · ${s.failed} hata` : "") +
            (s.errors[0] ? ` — ${s.errors[0]}` : "")
        );
      } else {
        setHint("Senkron tamamlandı.");
      }
      if (res.warning) setHint((h) => (h ? `${h} · ${res.warning}` : res.warning ?? null));
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Senkron başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-2"
          : "flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      {!compact && (
        <p className="text-xs text-muted-foreground max-w-xl">
          <Sparkles size={12} className="inline mr-1 text-emerald-600" />
          <strong>{brandName ?? "Marka"}</strong> için atanmış içerik linkleri taranır; yayın günü
          paylaşım takvimine yazılır.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-[11px] gap-1.5"
          disabled={loading}
          onClick={() => void run()}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Marka linklerinden doldur
        </Button>
        {hint && (
          <span className="text-[10px] text-muted-foreground max-w-[280px]">{hint}</span>
        )}
      </div>
    </div>
  );
}
