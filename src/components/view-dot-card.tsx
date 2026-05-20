"use client";

import { useEffect, useState } from "react";
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

/** Animasyon sırasında kısa gösterim (kullanıcı örneğiyle uyumlu). */
export function formatViewDotDisplay(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) return `${Math.floor(count / 1_000)}k`;
  return count.toLocaleString("tr-TR");
}

export function ViewDotCard({
  target = 0,
  duration = 2000,
  label = "İzlenme",
  sub,
  accent = "violet",
  size = "md",
  className,
}: {
  target?: number;
  duration?: number;
  label?: string;
  sub?: string;
  accent?: ViewDotCardAccent;
  size?: "sm" | "md";
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const colors = ACCENT_VARS[accent];

  useEffect(() => {
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
  }, [target, duration]);

  const display = target <= 0 ? "—" : formatViewDotDisplay(count);

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
        <div className={styles.text}>{display}</div>
        <div className={styles.label}>{label}</div>
        {sub && <div className={styles.sub}>{sub}</div>}
        <div className={cn(styles.line, styles.topl)} aria-hidden />
        <div className={cn(styles.line, styles.leftl)} aria-hidden />
        <div className={cn(styles.line, styles.bottoml)} aria-hidden />
        <div className={cn(styles.line, styles.rightl)} aria-hidden />
      </div>
    </div>
  );
}
