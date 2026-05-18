"use client";

import { cn } from "@/lib/utils";
import { brandLogoSrc } from "@/lib/brand-assets";

/**
 * Marka PNG logosu (siyah zeminli görseller · dark/light uyum için ring ile çerçeve).
 */
export function BrandLogo({
  brandId,
  title,
  className,
  size = 40,
}: {
  brandId: string;
  /** Erişilebilirlik etiketi */
  title: string;
  className?: string;
  /** Piksel (width & height) */
  size?: number;
}) {
  const src = brandLogoSrc(brandId);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn(
        "shrink-0 rounded-md bg-black object-contain ring-1 ring-border/80",
        className
      )}
      title={title}
    />
  );
}
