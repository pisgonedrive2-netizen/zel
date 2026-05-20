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
    <div
      className={cn(
        "flex w-max shrink-0 items-center gap-3 sm:gap-5",
        direction === "left" ? "animate-brand-marquee-left" : "animate-brand-marquee-right"
      )}
      aria-hidden
    >
      {doubled.map((b, i) => (
        <div
          key={`${b.id}-${i}`}
          className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 px-4 py-2 backdrop-blur-md shadow-lg shadow-black/30"
        >
          <BrandLogo brandId={b.id} title={b.name} size={28} className="rounded-full" />
          <span className="text-sm font-semibold tracking-wide text-white whitespace-nowrap">
            {b.shortName}
          </span>
          <span className="hidden sm:inline text-xs text-white/45 font-normal whitespace-nowrap">
            {b.name}
          </span>
        </div>
      ))}
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
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-3">
        {label}
      </p>

      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex flex-col gap-3">
          <MarqueeTrack items={sorted} direction="left" />
          <MarqueeTrack items={[...sorted].reverse()} direction="right" />
        </div>
      </div>
    </section>
  );
}
