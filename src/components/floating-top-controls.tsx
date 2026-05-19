"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { ApiHealthChip } from "@/components/api-health-chip";

/** Sağ üst: tema + API durumu — tek sütunda, çakışma yok. */
export function FloatingTopControls() {
  return (
    <div
      className="fixed z-[60] flex flex-col items-end gap-2 top-[max(env(safe-area-inset-top),12px)] right-[max(env(safe-area-inset-right),12px)]"
      aria-label="Üst kontroller"
    >
      <ThemeToggle variant="embedded" />
      <ApiHealthChip embedded />
    </div>
  );
}
