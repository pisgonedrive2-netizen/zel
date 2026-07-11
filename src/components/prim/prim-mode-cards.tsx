"use client";

import { Sparkles, Percent, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRIM_SYSTEM_PRESETS, type PrimSystemPreset } from "@/lib/prim-pool";
import { cn } from "@/lib/utils";

/** Kolay seçim: Önerilen / Sadece % / Sabit. */
const EASY_PRESET_KEYS = new Set(["standard", "percent_only", "fixed_legacy"]);

const ICONS: Record<string, typeof Sparkles> = {
  standard: Sparkles,
  percent_only: Percent,
  fixed_legacy: Lock,
};

export function PrimModeCards({
  onSelect,
  activeKey,
}: {
  onSelect: (preset: PrimSystemPreset) => void;
  activeKey?: string | null;
}) {
  const presets = PRIM_SYSTEM_PRESETS.filter((p) => EASY_PRESET_KEYS.has(p.key));

  return (
    <Card id="prim-mod" className="scroll-mt-36 border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Prim sistemi</CardTitle>
        <CardDescription className="text-xs">
          Üç hazır mod — tıkla, uygula. İnce ayar için aşağıda “Uzman”.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {presets.map((p) => {
            const Icon = ICONS[p.key] ?? Sparkles;
            const active = activeKey === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all hover:border-amber-500/40 hover:bg-amber-500/[0.04]",
                  active
                    ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30"
                    : "border-border/70 bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Icon size={16} />
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.tag}
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{p.label}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
