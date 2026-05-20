"use client";

import { useEffect, useState } from "react";
import { brandChartColor } from "@/lib/brand-viewership-series";
import { cn } from "@/lib/utils";
import styles from "./view-dot-card.module.css";

export type ViewDotCardAccent = "violet" | "blue" | "emerald" | "amber" | "rose";

const ACCENT_VARS: Record<ViewDotCardAccent, { glow: string; accent: string; ray: string }> = {
  violet: { glow: "#6366f1", accent: "#818cf8", ray: "rgba(99, 102, 241, 0.38)" },
  blue: { glow: "#3b82f6", accent: "#60a5fa", ray: "rgba(59, 130, 246, 0.38)" },
  emerald: { glow: "#10b981", accent: "#34d399", ray: "rgba(16, 185, 129, 0.35)" },
  amber: { glow: "#f59e0b", accent: "#fbbf24", ray: "rgba(245, 158, 11, 0.35)" },
  rose: { glow: "#f43f5e", accent: "#fb7185", ray: "rgba(244, 63, 94, 0.35)" },
};

const PADISAH_ID = "br-padi";

/** Animasyon sırasında kısa gösterim (kullanıcı örneğiyle uyumlu). */
export function formatViewDotDisplay(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) return `${Math.floor(count / 1000)}k`;
  return count.toLocaleString("tr-TR");
}

export function brandViewDotLabel(brandId: string, shortName: string): string {
  if (brandId === PADISAH_ID) return "Padisah";
  return shortName;
}

function resolveColors(accent: ViewDotCardAccent, color?: string) {
  if (color) {
    return { glow: color, accent: color, ray: `${color}66` };
  }
  return ACCENT_VARS[accent];
}

export function ViewDotCard({
  target = 0,
  duration = 2000,
  label = "İzlenme",
  metricCaption = "Views",
  sub,
  displayText,
  accent = "violet",
  color,
  size = "md",
  className,
}: {
  target?: number;
  duration?: number;
  label?: string;
  metricCaption?: string | null;
  sub?: string;
  displayText?: string;
  accent?: ViewDotCardAccent;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const colors = resolveColors(accent, color);

  useEffect(() => {
    if (displayText != null) return;
    if (target <= 0) {
      setCount(0);
      return;
    }
    let current = 0;
    const end = Math.round(target);
    const steps = Math.max(1, Math.floor(duration / 50));
    const increment = Math.max(1, Math.ceil(end / steps));
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      setCount(current);
    }, 50);
    return () => clearInterval(timer);
  }, [target, duration, displayText]);

  const display = displayText ?? (target <= 0 ? "—" : formatViewDotDisplay(count));

  return (
    <div
      className={cn(styles.outer, size === "sm" && styles.outerSm, className)}
      style={
        {
          "--vdc-glow": colors.glow,
          "--vdc-accent": colors.accent,
          "--vdc-ray": colors.ray,
        } as React.CSSProperties
      }
    >
      <div className={styles.dot} aria-hidden />
      <div className={styles.card}>
        <div className={styles.ray} aria-hidden />
        {metricCaption ? <div className={styles.metric}>{metricCaption}</div> : null}
        <div className={styles.text}>{display}</div>
        <div className={styles.label}>{label}</div>
        {sub ? <div className={styles.sub}>{sub}</div> : null}
        <div className={cn(styles.line, styles.topl)} aria-hidden />
        <div className={cn(styles.line, styles.leftl)} aria-hidden />
        <div className={cn(styles.line, styles.bottoml)} aria-hidden />
        <div className={cn(styles.line, styles.rightl)} aria-hidden />
      </div>
    </div>
  );
}

export type ViewershipDotMapItem = {
  id: string;
  name: string;
  shortName: string;
  views: number;
  sharePct?: number;
  rank?: number;
};

/** İzlenme haritası — marka başına DotCard ızgarası. */
export function ViewershipDotMap({
  items,
  className,
}: {
  items: ViewershipDotMapItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Bu dönem için izlenme verisi yok.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5",
        className
      )}
    >
      {items.map((row, i) => (
        <ViewDotCard
          key={row.id}
          target={row.views}
          metricCaption="Views"
          label={brandViewDotLabel(row.id, row.shortName)}
          sub={
            row.sharePct != null
              ? `Sıra ${row.rank ?? i + 1} · %${row.sharePct.toFixed(0)} pay`
              : row.rank != null
                ? `Sıra ${row.rank}`
                : undefined
          }
          color={brandChartColor(row.id, i)}
          size={i >= 3 ? "sm" : "md"}
        />
      ))}
    </div>
  );
}
