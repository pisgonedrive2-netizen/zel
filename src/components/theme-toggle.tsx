"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lanetkel-theme";

export function ThemeToggle({
  collapsed,
  className,
  variant = "default",
}: {
  collapsed?: boolean;
  className?: string;
  /** `icon`: yuvarlak, kompakt — üst çubuk / köşe için */
  variant?: "default" | "icon";
}) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  };

  if (!mounted) {
    return (
      <div
        className={cn(
          "animate-pulse bg-muted/50",
          variant === "icon" ? "h-9 w-9 shrink-0 rounded-full" : "h-9 w-full rounded-md",
          className
        )}
        aria-hidden
      />
    );
  }

  const isIcon = variant === "icon";

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 text-sm transition-colors",
        isIcon
          ? "h-9 w-9 shrink-0 justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
          : "w-full rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        !isIcon && collapsed && "justify-center px-2",
        className
      )}
      aria-label={dark ? "Açık tema" : "Koyu tema"}
      title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
    >
      {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {!isIcon && !collapsed && <span>{dark ? "Açık tema" : "Koyu tema"}</span>}
    </button>
  );
}
