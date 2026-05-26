"use client";

import { cn } from "@/lib/utils";
import type { Brand } from "@/store/store";
import { BrandLogo } from "@/components/brand-logo";

export function BrandMultiSelect({
  brands,
  value,
  onChange,
  disabled,
  maxVisible = 12,
}: {
  brands: Brand[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  maxVisible?: number;
}) {
  const active = brands.filter((b) => b.status !== "inactive").slice(0, maxVisible);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {active.map((b) => {
          const on = value.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(b.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                on
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-accent/50",
                disabled && "opacity-60 pointer-events-none"
              )}
            >
              <BrandLogo brandId={b.id} title={b.name} size={14} className="rounded-sm" />
              {b.shortName}
            </button>
          );
        })}
      </div>
      {value.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {value.length === 1
            ? "Tek marka — tutarın tamamı bu markaya yazılır."
            : `${value.length} marka — tutar markalar arasında eşit paylaştırılır.`}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Ortak harcama için birden fazla marka seçebilirsiniz.
        </p>
      )}
    </div>
  );
}
