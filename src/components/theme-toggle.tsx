"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lanetkel-theme";

const floatingBase =
  "fixed z-[60] h-10 w-10 shrink-0 justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md backdrop-blur-sm hover:bg-accent hover:text-accent-foreground top-[max(env(safe-area-inset-top),12px)] right-[max(env(safe-area-inset-right),12px)]";

export function ThemeToggle({
  collapsed,
  className,
  variant = "default",
}: {
  collapsed?: boolean;
  className?: string;
  /** `icon`: kompakt · `floating`: sağ üst sabit (tüm sayfalar) */
  variant?: "default" | "icon" | "floating";
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
          variant === "floating" && floatingBase,
          variant === "icon" && "h-9 w-9 shrink-0 rounded-full",
          variant === "default" && "h-9 w-full rounded-md",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 text-sm transition-colors",
        variant === "floating" && floatingBase,
        variant === "icon" &&
          "h-9 w-9 shrink-0 justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
        variant === "default" &&
          "w-full rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        variant === "default" && collapsed && "justify-center px-2",
        className
      )}
      aria-label={dark ? "Açık tema" : "Koyu tema"}
      title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
    >
      {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {variant === "default" && !collapsed && <span>{dark ? "Açık tema" : "Koyu tema"}</span>}
    </button>
  );
}
