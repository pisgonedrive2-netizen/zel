"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAchievementFromBrandLinks } from "@/lib/streamer-achievement-sync-api";
import { useStore } from "@/store/store";
import type { WeekBrandReel } from "@/store/store";

function mergeReelsIntoStore(reels: WeekBrandReel[], employeeId: string) {
  useStore.setState((s) => {
    const others = s.weekBrandReels.filter((r) => r.employeeId !== employeeId);
    const byId = new Map(others.map((r) => [r.id, r]));
    for (const r of reels) byId.set(r.id, r);
    return { weekBrandReels: [...byId.values()] };
  });
}

/**
 * Marka linkleri (içerik URL) → API yayın tarihi → achievement / week_brand_reels.
 * Ramiz / Açelya marka linkleri sayfasındaki reel/post URL'leri ile aynı kaynak.
 */
export function AchievementLinkSyncBar({
  employeeId,
  employeeName,
  compact = false,
}: {
  employeeId: string;
  employeeName?: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const run = async () => {
    if (!employeeId || loading) return;
    setLoading(true);
    setHint(null);
    try {
      const res = await syncAchievementFromBrandLinks(employeeId);
      if (res.reels?.length) mergeReelsIntoStore(res.reels, employeeId);
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
          {employeeName ?? "Yayıncı"} için <strong>marka linklerindeki</strong> içerik URL&apos;leri
          (reel / post / shorts) API ile taranır; yayın günü achievement takvimine yazılır.
          Marka linkleri sayfasıyla aynı veri.
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
