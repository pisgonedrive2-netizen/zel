"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BrandQuickAction {
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: "orange" | "green" | "blue" | "pink";
}

const COLOR: Record<
  BrandQuickAction["color"],
  { icon: string; ring: string; hover: string }
> = {
  orange: {
    icon: "bg-[#FF6B00]/15 text-[#FF6B00] dark:text-[#FF9A4D]",
    ring: "ring-[#FF6B00]/30",
    hover:
      "hover:border-[#FF6B00]/40 hover:shadow-[0_0_18px_-6px_rgba(255,107,0,0.55)]",
  },
  green: {
    icon: "bg-[#22C55E]/15 text-[#16A34A] dark:text-[#4ADE80]",
    ring: "ring-[#22C55E]/30",
    hover:
      "hover:border-[#22C55E]/40 hover:shadow-[0_0_18px_-6px_rgba(34,197,94,0.55)]",
  },
  blue: {
    icon: "bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]",
    ring: "ring-[#3B82F6]/30",
    hover:
      "hover:border-[#3B82F6]/40 hover:shadow-[0_0_18px_-6px_rgba(59,130,246,0.55)]",
  },
  pink: {
    icon: "bg-[#EC4899]/15 text-[#DB2777] dark:text-[#F472B6]",
    ring: "ring-[#EC4899]/30",
    hover:
      "hover:border-[#EC4899]/40 hover:shadow-[0_0_18px_-6px_rgba(236,72,153,0.55)]",
  },
};

export function BrandQuickActions({
  actions,
}: {
  actions: BrandQuickAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((a) => {
        const c = COLOR[a.color];
        return (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-all",
              c.hover
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                c.icon,
                c.ring
              )}
            >
              <a.icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {a.label}
              </p>
              {a.description && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {a.description}
                </p>
              )}
            </div>
            <ArrowUpRight
              size={14}
              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        );
      })}
    </div>
  );
}
