"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  title: ReactNode;
  description?: ReactNode;
  /** Başlangıçta açık mı */
  defaultOpen?: boolean;
  /** Dışarıdan kontrol (opsiyonel) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  /** Sağ üst ek aksiyon (filtre, badge vb.) */
  trailing?: ReactNode;
  id?: string;
}

/**
 * Sayfa içi bölümler — uzun scroll’u azaltmak için açılır/kapanır başlık.
 */
export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
  headerClassName,
  trailing,
  id,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  return (
    <section
      id={id}
      className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}
    >
      <div
        className={cn(
          "flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors",
          headerClassName
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(!isOpen)}
          className="flex flex-1 min-w-0 items-start gap-3 text-left"
          aria-expanded={isOpen}
        >
          <ChevronDown
            size={18}
            className={cn(
              "shrink-0 text-muted-foreground mt-0.5 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">{title}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
            )}
          </div>
        </button>
        {trailing && (
          <div className="shrink-0">
            {trailing}
          </div>
        )}
      </div>
      {isOpen && <div className="border-t border-border/60 px-4 py-4">{children}</div>}
    </section>
  );
}
