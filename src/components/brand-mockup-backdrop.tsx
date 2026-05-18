"use client";

import { cn } from "@/lib/utils";
import { brandLogoSrc } from "@/lib/brand-assets";

/**
 * Marka logosunu kart arka planında mockup olarak gösterir.
 * Siyah zeminli PNG'lerde `mix-blend-screen` (dark) / `multiply` (light) siyahı yumuşatır.
 */
export function BrandMockupBackdrop({
  brandId,
  className,
}: {
  brandId: string;
  className?: string;
}) {
  const src = brandLogoSrc(brandId);
  if (!src) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          "absolute -right-4 top-1/2 h-[min(72%,220px)] w-[min(55%,280px)] -translate-y-1/2",
          "object-contain object-right opacity-[0.14] dark:opacity-[0.18]",
          "mix-blend-multiply dark:mix-blend-screen",
          "select-none"
        )}
      />
    </div>
  );
}
