"use client";

import { PLATFORM_LABEL, fmtClipMoney, type ClipCampaign } from "@/lib/clip-farm/types";
import { videoEarning } from "@/lib/clip-farm/rewards";
import { cn } from "@/lib/utils";

export const CLIP_KEY_STORAGE = "fox.clipKey";

export function rateLines(c: ClipCampaign): string[] {
  const out: string[] = [];
  if (c.ratePer1kViews > 0) out.push(`Her 1.000 izlenme: ${fmtClipMoney(c.ratePer1kViews, c.currency)}`);
  if (c.ratePerLike > 0) out.push(`Her beğeni: ${fmtClipMoney(c.ratePerLike, c.currency)}`);
  if (c.ratePerComment > 0) out.push(`Her yorum: ${fmtClipMoney(c.ratePerComment, c.currency)}`);
  if (c.ratePerShare > 0) out.push(`Her paylaşım: ${fmtClipMoney(c.ratePerShare, c.currency)}`);
  if (c.minViews > 0) out.push(`Min. ${c.minViews.toLocaleString("tr-TR")} izlenme`);
  if (c.maxPerVideo) out.push(`Video üst limit: ${fmtClipMoney(c.maxPerVideo, c.currency)}`);
  if (c.maxPerCreatorMonth) out.push(`Aylık üst limit: ${fmtClipMoney(c.maxPerCreatorMonth, c.currency)}`);
  return out;
}

/** Admin / iç panel — oran detayı. */
export function CampaignCard({ c, active, onClick }: { c: ClipCampaign; active?: boolean; onClick?: () => void }) {
  const example = videoEarning({ views: 100_000, likes: 5_000, comments: 300, shares: 200 }, c);
  const lines = rateLines(c);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border bg-card hover:border-foreground/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{c.title}</h3>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {c.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}
        </span>
      </div>
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="text-primary">•</span>
              {l}
            </li>
          ))}
        </ul>
      )}
      {example > 0 && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Örnek (100k izlenme): <strong className="text-foreground">{fmtClipMoney(example, c.currency)}</strong>
        </p>
      )}
    </button>
  );
}

/** Public videoyolla — clip farm, kısa. */
export function PublicCampaignCard({
  c,
  active,
  onClick,
}: {
  c: ClipCampaign;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-colors backdrop-blur-md",
        active
          ? "border-orange-400/50 bg-orange-500/15 ring-1 ring-orange-400/30"
          : "border-white/10 bg-white/5 hover:border-white/25"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{c.title}</h3>
        <span className="shrink-0 text-[11px] text-white/50">
          {c.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-white/65">
        Lanetkel yayın / reels kliplerini kendi hesabında paylaş → linki gönder → ödül.
      </p>
    </button>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";
