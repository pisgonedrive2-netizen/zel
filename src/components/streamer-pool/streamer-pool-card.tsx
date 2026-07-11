"use client";

import { Eye, Globe2, Star, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtBrandCount, fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import type { StreamerPoolProfile } from "@/store/store";

/**
 * Yayıncı havuzu kart bileşeni — `/marka/havuz` grid'inde ve detay drawer'ın
 * üst bandında kullanılır. Tıklanınca üst-bileşen "Teklif gönder" modalını açar.
 */
export function StreamerPoolCard({
  profile,
  onOfferClick,
  ctaLabel = "Teklif gönder",
}: {
  profile: StreamerPoolProfile;
  onOfferClick?: (p: StreamerPoolProfile) => void;
  ctaLabel?: string;
}) {
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || "?";
  const rateLabel = formatRateRange(profile);
  const countries = profile.countries.slice(0, 3);
  const remainingCountries = Math.max(0, profile.countries.length - countries.length);

  return (
    <div className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-[#FF6B00]/45 hover:shadow-[0_0_28px_-10px_rgba(255,107,0,0.55)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#FF6B00]/18 via-[#EC4899]/8 to-transparent"
      />

      <div className="relative flex items-start gap-3">
        <Avatar src={profile.avatarUrl} initial={initial} large />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-base font-semibold tracking-tight text-foreground">
            {profile.displayName}
          </p>
          {profile.headline && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {profile.headline}
            </p>
          )}
        </div>
      </div>

      {profile.categories.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5">
          {profile.categories.slice(0, 4).map((c) => (
            <Badge
              key={c}
              variant="outline"
              className="rounded-full border-[#FF6B00]/25 bg-[#FF6B00]/5 text-[10px] font-medium text-foreground"
            >
              {c}
            </Badge>
          ))}
          {profile.categories.length > 4 && (
            <span className="text-[10px] text-muted-foreground">
              +{profile.categories.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="relative grid grid-cols-3 gap-2 text-xs">
        <Stat
          icon={Users2}
          label="Takipçi"
          value={fmtCompactViews(profile.followersTotal)}
        />
        <Stat
          icon={Eye}
          label="Ort. izlenme"
          value={fmtCompactViews(profile.avgViews)}
        />
        <Stat
          icon={Star}
          label="Ücret"
          value={rateLabel ?? "—"}
        />
      </div>

      {countries.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <Globe2 size={11} className="text-muted-foreground" />
          {countries.map((c) => (
            <span
              key={c}
              className="rounded-md bg-muted/60 px-1.5 py-0.5 font-medium uppercase"
            >
              {countryFlagEmoji(c)} {c}
            </span>
          ))}
          {remainingCountries > 0 && (
            <span className="text-[10px] text-muted-foreground">
              +{remainingCountries}
            </span>
          )}
        </div>
      )}

      {onOfferClick && (
        <Button
          size="sm"
          className="relative mt-auto gap-1.5 bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90"
          onClick={() => onOfferClick(profile)}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

function Avatar({
  src,
  initial,
  large,
}: {
  src?: string;
  initial: string;
  large?: boolean;
}) {
  const size = large ? "h-14 w-14 text-lg" : "h-12 w-12 text-base";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(size, "shrink-0 rounded-2xl object-cover ring-1 ring-border")}
        draggable={false}
      />
    );
  }
  return (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#EC4899] font-bold uppercase text-white shadow-sm ring-1 ring-[#FF6B00]/40"
      )}
    >
      {initial}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon size={10} />
        <span>{label}</span>
      </div>
      <div className={cn("mt-0.5 truncate text-sm font-semibold tabular-nums")}>{value}</div>
    </div>
  );
}

function formatRateRange(p: StreamerPoolProfile): string | null {
  const cur = (p.rateCurrency as "USD" | "TRY" | "EUR") ?? "USD";
  if (p.rateMinUsd && p.rateMaxUsd) {
    return `${fmtBrandMoney(p.rateMinUsd, cur)} – ${fmtBrandMoney(p.rateMaxUsd, cur)}`;
  }
  if (p.rateMaxUsd) return `≤ ${fmtBrandMoney(p.rateMaxUsd, cur)}`;
  if (p.rateMinUsd) return `≥ ${fmtBrandMoney(p.rateMinUsd, cur)}`;
  if (p.followersTotal === 0 && p.avgViews === 0) return null;
  return "—";
}

/** İki harfli ülke kodu → emoji bayrak. Geçersizse boş döner. */
export function countryFlagEmoji(code: string): string {
  const clean = code.trim().toUpperCase();
  if (clean.length !== 2 || !/^[A-Z]{2}$/.test(clean)) return "";
  const A = 0x1f1e6;
  const codePoints = [...clean].map((c) => A + (c.charCodeAt(0) - 65));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "";
  }
}

export { formatRateRange as formatStreamerRateRange };
