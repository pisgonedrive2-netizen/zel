"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type BrandKpiColor = "orange" | "green" | "blue" | "pink";

export interface BrandKpiMetric {
  label: string;
  value: string;
  /** Opsiyonel ikinci satır (örn. "% değişim", "k görüntüleme"). */
  sub?: string;
}

interface BrandKpiCardProps {
  color: BrandKpiColor;
  /** Lucide ikon bileşeni. */
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle?: string;
  metrics: BrandKpiMetric[];
  /** "Detay →" linki ve etiketi. */
  href?: string;
  linkLabel?: string;
  /** Faz C için kilitli durum (placeholder). */
  locked?: boolean;
  badge?: string;
}

const PALETTE: Record<
  BrandKpiColor,
  {
    /** Soldaki dikey aksent + ikon background. */
    accent: string;
    /** İkon (ana renk). */
    ring: string;
    /** Başlık vurgu rengi (sayı). */
    text: string;
    /** Buton hover & link hint. */
    chip: string;
    /** Kart hover'da hafif glow. */
    glow: string;
  }
> = {
  orange: {
    accent: "bg-[#FF6B00]/15 text-[#FF6B00]",
    ring: "ring-[#FF6B00]/30",
    text: "text-[#FF6B00] dark:text-[#FF9A4D]",
    chip: "bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00]/15 dark:text-[#FF9A4D]",
    glow: "hover:shadow-[0_0_22px_-8px_rgba(255,107,0,0.55)]",
  },
  green: {
    accent: "bg-[#22C55E]/15 text-[#16A34A] dark:text-[#4ADE80]",
    ring: "ring-[#22C55E]/30",
    text: "text-[#16A34A] dark:text-[#4ADE80]",
    chip: "bg-[#22C55E]/10 text-[#16A34A] hover:bg-[#22C55E]/15 dark:text-[#4ADE80]",
    glow: "hover:shadow-[0_0_22px_-8px_rgba(34,197,94,0.55)]",
  },
  blue: {
    accent: "bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]",
    ring: "ring-[#3B82F6]/30",
    text: "text-[#2563EB] dark:text-[#60A5FA]",
    chip: "bg-[#3B82F6]/10 text-[#2563EB] hover:bg-[#3B82F6]/15 dark:text-[#60A5FA]",
    glow: "hover:shadow-[0_0_22px_-8px_rgba(59,130,246,0.55)]",
  },
  pink: {
    accent: "bg-[#EC4899]/15 text-[#DB2777] dark:text-[#F472B6]",
    ring: "ring-[#EC4899]/30",
    text: "text-[#DB2777] dark:text-[#F472B6]",
    chip: "bg-[#EC4899]/10 text-[#DB2777] hover:bg-[#EC4899]/15 dark:text-[#F472B6]",
    glow: "hover:shadow-[0_0_22px_-8px_rgba(236,72,153,0.55)]",
  },
};

export function BrandKpiCard({
  color,
  icon: Icon,
  title,
  subtitle,
  metrics,
  href,
  linkLabel = "Detay",
  locked = false,
  badge,
}: BrandKpiCardProps) {
  const p = PALETTE[color];
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all",
        !locked && p.glow,
        locked && "opacity-80"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full",
          p.accent.split(" ")[0]
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
              p.accent,
              p.ring
            )}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground/80 leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {(badge || locked) && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              locked
                ? "bg-muted text-muted-foreground"
                : cn(p.chip, "border border-current/20")
            )}
          >
            {locked && <Lock size={9} />}
            {badge ?? "Faz C"}
          </span>
        )}
      </div>

      <div className="mt-3 grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
        {metrics.map((m, i) => (
          <div key={i} className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
              {m.label}
            </p>
            <p
              className={cn(
                "text-lg font-bold tabular-nums leading-tight",
                locked ? "text-muted-foreground" : p.text
              )}
            >
              {m.value}
            </p>
            {m.sub && (
              <p className="text-[10px] text-muted-foreground/80 truncate">
                {m.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {href && !locked && (
        <Link
          href={href}
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
            p.chip
          )}
        >
          {linkLabel}
          <ArrowRight size={11} />
        </Link>
      )}
      {locked && (
        <p className="mt-3 text-[11px] font-medium text-muted-foreground">
          Yakında — Affiliate Tracking
        </p>
      )}
    </div>
  );
}
