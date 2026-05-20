"use client";

import { useMemo } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { brandChartColor } from "@/lib/brand-viewership-series";
import { cn } from "@/lib/utils";
import styles from "./brand-marquee.module.css";

export type BrandMarqueeItem = {
  id: string;
  name: string;
  shortName: string;
};

const PADISAH_BRAND_ID = "br-padi";

/** Marquee’de gösterilecek kısa isim (Padi → Padisah). */
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

function BrandDotCard({
  brand,
  index,
}: {
  brand: BrandMarqueeItem;
  index: number;
}) {
  const glow = brandChartColor(brand.id, index);
  const display = marqueeDisplayName(brand);

  return (
    <div
      className={styles.itemOuter}
      style={
        {
          "--bm-glow": glow,
          "--bm-accent": glow,
          "--bm-ray": `${glow}55`,
        } as React.CSSProperties
      }
    >
      <div className={styles.dot} aria-hidden />
      <div className={styles.card}>
        <div className={styles.ray} aria-hidden />
        <div className={styles.logoWrap}>
          <BrandLogo brandId={brand.id} title={brand.name} size={26} className="rounded-md" />
        </div>
        <div className={styles.text}>{display}</div>
        <div className={styles.label}>Partner</div>
        <div className={cn(styles.line, styles.topl)} aria-hidden />
        <div className={cn(styles.line, styles.leftl)} aria-hidden />
        <div className={cn(styles.line, styles.bottoml)} aria-hidden />
        <div className={cn(styles.line, styles.rightl)} aria-hidden />
      </div>
    </div>
  );
}

function MarqueeTrack({
  items,
  direction = "left",
}: {
  items: BrandMarqueeItem[];
  direction?: "left" | "right";
}) {
  const doubled = useMemo(() => [...items, ...items], [items]);

  return (
    <div className={styles.track}>
      <div
        className={cn(
          styles.trackInner,
          direction === "left" ? styles.trackInnerLeft : styles.trackInnerRight
        )}
        aria-hidden
      >
        {doubled.map((b, i) => (
          <BrandDotCard key={`${b.id}-${i}`} brand={b} index={i % items.length} />
        ))}
      </div>
    </div>
  );
}

export function BrandMarquee({
  brands,
  className,
  label = "Partner markalarımız",
}: {
  brands: BrandMarqueeItem[];
  className?: string;
  label?: string;
}) {
  const sorted = useMemo(() => sortBrandsForMarquee(brands), [brands]);

  if (sorted.length === 0) return null;

  return (
    <section
      className={cn("relative w-full max-w-[100vw] select-none", className)}
      aria-label={label}
    >
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90 mb-3 drop-shadow-md">
        {label}
      </p>

      <div className="flex flex-col gap-3">
        <MarqueeTrack items={sorted} direction="left" />
        <MarqueeTrack items={[...sorted].reverse()} direction="right" />
      </div>
    </section>
  );
}
