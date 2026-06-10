"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type BrandMarqueeItem = {
  id: string;
  name: string;
  shortName: string;
};

const PADISAH_BRAND_ID = "br-padi";

/** Landing / partner şeridinde gösterilen çekirdek 5 marka. */
export const CORE_PARTNER_BRAND_IDS = [
  "br-padi",
  "br-boffice",
  "br-gala",
  "br-hit",
  "br-pipo",
] as const;

export function filterCorePartnerBrands(brands: BrandMarqueeItem[]): BrandMarqueeItem[] {
  const byId = new Map(brands.map((b) => [b.id, b]));
  return CORE_PARTNER_BRAND_IDS.map((id) => byId.get(id)).filter(
    (b): b is BrandMarqueeItem => !!b
  );
}

/** Marquee'de gösterilecek kısa isim (Padi → Padisah). */
export function marqueeDisplayName(brand: BrandMarqueeItem): string {
  if (brand.id === PADISAH_BRAND_ID) return "Padisah";
  return brand.shortName;
}

/** Padisah her zaman 1. sırada, sonra alfabetik. */
export function sortBrandsForMarquee(brands: BrandMarqueeItem[]): BrandMarqueeItem[] {
  return [...brands].sort((a, b) => {
    if (a.id === PADISAH_BRAND_ID) return -1;
    if (b.id === PADISAH_BRAND_ID) return 1;
    return marqueeDisplayName(a).localeCompare(marqueeDisplayName(b), "tr");
  });
}

function BrandChip({ brand }: { brand: BrandMarqueeItem }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-black/45 px-4 py-2 shadow-lg shadow-black/30 backdrop-blur-md">
      <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-white">
        {marqueeDisplayName(brand)}
      </span>
    </div>
  );
}

function repeatItems(items: BrandMarqueeItem[], copies: number) {
  return Array.from({ length: copies }).flatMap(() => items);
}

/** Sabit geniş track: her grup viewport'tan geniş, animasyon bir grubu kaydırır. */
function MarqueeRow({
  items,
  direction = "left",
}: {
  items: BrandMarqueeItem[];
  direction?: "left" | "right";
}) {
  const group = useMemo(() => repeatItems(items, 8), [items]);

  return (
    <div
      className="brand-marquee-window w-full overflow-hidden"
      aria-hidden
    >
      <div
        className={cn(
          "brand-marquee-track flex w-max items-center gap-4",
          direction === "right" && "brand-marquee-track--reverse",
        )}
      >
        {[0, 1].map((groupIndex) => (
          <div key={groupIndex} className="brand-marquee-group flex min-w-screen shrink-0 items-center justify-around gap-4 pr-4">
            {group.map((b, i) => (
              <BrandChip key={`${direction}-${groupIndex}-${b.id}-${i}`} brand={b} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandMarquee({
  brands,
  className,
  label = "Partner markalarımız",
  dualRow = false,
}: {
  brands: BrandMarqueeItem[];
  className?: string;
  label?: string;
  /** İki satır (ters yön). Varsayılan tek satır — daha sade landing. */
  dualRow?: boolean;
}) {
  const sorted = useMemo(() => sortBrandsForMarquee(brands), [brands]);

  if (sorted.length === 0) return null;

  return (
    <section
      className={cn("relative w-full select-none", className)}
      aria-label={label}
    >
      {label ? (
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
          {label}
        </p>
      ) : null}

      <div className={cn("flex w-full flex-col", dualRow ? "gap-3" : "")}>
        <MarqueeRow items={sorted} direction="left" />
        {dualRow && <MarqueeRow items={[...sorted].reverse()} direction="right" />}
      </div>
    </section>
  );
}
