"use client";

import { cn } from "@/lib/utils";

/** Başlık fontu (Anton) — büyük harf, dar. */
export const VY_DISPLAY = "font-normal uppercase [font-family:var(--font-vy-display),Impact,sans-serif]";

/** Düz kâğıt zemin, mürekkep siyahı. Gradyan, parlama, cam yok. */
export function VideoYollaStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[100dvh] overflow-hidden bg-[#efe9dd] text-[#111] [font-family:var(--font-vy-body),system-ui,sans-serif]",
        className
      )}
    >
      {children}
    </div>
  );
}
