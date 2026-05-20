"use client";

import { useMemo } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export type BrandMarqueeItem = {
  id: string;
  name: string;
  shortName: string;
};

function MarqueeTrack({
  items,
  direction = "left",
}: {
  items: BrandMarqueeItem[];
  direction?: "left" | "right";
}) {
  const doubled = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="overflow-hidden w-full min-h-[44px] flex items-center">
      <div
        className={cn(
          "flex w-max shrink-0 items-center gap-3 sm:gap-5 motion-reduce:translate-x-0",
          direction === "left" ? "animate-brand-marquee-left" : "animate-brand-marquee-right"
        )}
        aria-hidden
      >
        {doubled.map((b, i) => (
          <div
            key={`${b.id}-${i}`}
            className="inline-flex items-center gap-2.5 rounded-full border border-orange-500/40 bg-black/80 px-4 py-2.5 shadow-[0_0_24px_rgba(255,107,0,0.15)] backdrop-blur-md"
          >
            <BrandLogo brandId={b.id} title={b.name} size={30} className="rounded-full" />
            <span className="text-sm font-bold tracking-wide text-white whitespace-nowrap drop-shadow-sm">
              {b.shortName}
            </span>
            <span className="hidden sm:inline text-xs text-orange-200/80 font-medium whitespace-nowrap">
              {b.name}
            </span>
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
}: {
  brands: BrandMarqueeItem[];
  className?: string;
  label?: string;
}) {
  if (brands.length === 0) return null;

  const sorted = useMemo(
    () => [...brands].sort((a, b) => a.shortName.localeCompare(b.shortName, "tr")),
    [brands]
  );

  return (
    <section
      className={cn("relative w-full select-none", className)}
      aria-label={label}
    >
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90 mb-3 drop-shadow-md">
        {label}
      </p>

      <div className="flex flex-col gap-2.5">
        <MarqueeTrack items={sorted} direction="left" />
        <MarqueeTrack items={[...sorted].reverse()} direction="right" />
      </div>
    </section>
  );
}
