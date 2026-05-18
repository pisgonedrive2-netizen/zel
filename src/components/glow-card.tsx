"use client";

import React, { useEffect, useRef, ReactNode, CSSProperties } from "react";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "blue" | "purple" | "green" | "red" | "orange";
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  /** true ise size prop'u yok sayılır, boyutu className veya width/height verir. */
  customSize?: boolean;
  /** İçeriği grid yerine basit blok olarak yerleştirir (form/dialog/KPI). */
  asBlock?: boolean;
  /** CSS variable veya stil overrides (örn. --backdrop) için. */
  style?: CSSProperties;
}

const glowColorMap = {
  blue:   { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green:  { base: 120, spread: 200 },
  red:    { base: 0,   spread: 200 },
  orange: { base: 30,  spread: 200 },
} as const;

const sizeMap = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
} as const;

// ── Singleton pointer listener ────────────────────────────────────────────
// Tüm GlowCard instance'ları aynı document-level dinleyiciyi paylaşır.
// Pozisyon değerleri `:root` üstüne CSS variable olarak yazılır; her kart
// kendi inline style'ında bu globalleri lokal `--x/--xp/--y/--yp` ile alır.
let listenerRefCount = 0;
let activeListener: ((e: PointerEvent) => void) | null = null;

function attachGlowListener() {
  if (typeof window === "undefined") return;
  if (listenerRefCount === 0) {
    activeListener = (e: PointerEvent) => {
      const root = document.documentElement;
      root.style.setProperty("--__glow_x", e.clientX.toFixed(2));
      root.style.setProperty("--__glow_xp", (e.clientX / window.innerWidth).toFixed(3));
      root.style.setProperty("--__glow_y", e.clientY.toFixed(2));
      root.style.setProperty("--__glow_yp", (e.clientY / window.innerHeight).toFixed(3));
    };
    document.addEventListener("pointermove", activeListener, { passive: true });
  }
  listenerRefCount += 1;
}

function detachGlowListener() {
  if (typeof window === "undefined") return;
  listenerRefCount = Math.max(0, listenerRefCount - 1);
  if (listenerRefCount === 0 && activeListener) {
    document.removeEventListener("pointermove", activeListener);
    activeListener = null;
  }
}

export function GlowCard({
  children,
  className = "",
  glowColor = "blue",
  size = "md",
  width,
  height,
  customSize = false,
  asBlock = false,
  style,
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    attachGlowListener();
    return () => detachGlowListener();
  }, []);

  const { base, spread } = glowColorMap[glowColor];
  const sizeClasses = customSize ? "" : sizeMap[size];

  const baseStyles: CSSProperties = {
    ...({
      "--base": base,
      "--spread": spread,
      "--radius": "14",
      "--border": "3",
      "--backdrop": "hsl(0 0% 60% / 0.12)",
      "--backup-border": "var(--backdrop)",
      "--size": "200",
      "--outer": "1",
      "--border-size": "calc(var(--border, 2) * 1px)",
      "--spotlight-size": "calc(var(--size, 150) * 1px)",
      // Pozisyon değişkenleri document-root'tan inherit ile gelir.
      "--x": "var(--__glow_x, 0)",
      "--xp": "var(--__glow_xp, 0)",
      "--y": "var(--__glow_y, 0)",
      "--yp": "var(--__glow_yp, 0)",
      "--hue": "calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))",
    } as CSSProperties),
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px)
      calc(var(--y, 0) * 1px),
      hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.1)), transparent
    )`,
    backgroundColor: "var(--backdrop, transparent)",
    backgroundSize: "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
    backgroundPosition: "50% 50%",
    backgroundAttachment: "fixed",
    border: "var(--border-size) solid var(--backup-border)",
    position: "relative",
    touchAction: "auto",
  };

  if (width !== undefined) baseStyles.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) baseStyles.height = typeof height === "number" ? `${height}px` : height;

  const mergedStyle: CSSProperties = { ...baseStyles, ...(style ?? {}) };

  const beforeAfterStyles = `
    [data-glow]::before,
    [data-glow]::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent;
      border-radius: calc(var(--radius) * 1px);
      background-attachment: fixed;
      background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
      background-repeat: no-repeat;
      background-position: 50% 50%;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box;
      mask-composite: intersect;
    }
    [data-glow]::before {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 50) * 1%) / var(--border-spot-opacity, 1)), transparent 100%
      );
      filter: brightness(2);
    }
    [data-glow]::after {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(0 100% 100% / var(--border-light-opacity, 1)), transparent 100%
      );
    }
    [data-glow] [data-glow] {
      position: absolute;
      inset: 0;
      will-change: filter;
      opacity: var(--outer, 1);
      border-radius: calc(var(--radius) * 1px);
      border-width: calc(var(--border-size) * 20);
      filter: blur(calc(var(--border-size) * 10));
      background: none;
      pointer-events: none;
      border: none;
    }
    [data-glow] > [data-glow]::before {
      inset: -10px;
      border-width: 10px;
    }
  `;

  const layoutClasses = asBlock
    ? "block"
    : `grid grid-rows-[1fr_auto] gap-4 ${customSize ? "" : "aspect-[3/4]"}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: beforeAfterStyles }} />
      <div
        ref={cardRef}
        data-glow
        style={mergedStyle}
        className={`${sizeClasses} ${layoutClasses} rounded-2xl relative shadow-[0_1rem_2rem_-1rem_black] p-4 ${className}`}
      >
        <div data-glow />
        {children}
      </div>
    </>
  );
}

export default GlowCard;
