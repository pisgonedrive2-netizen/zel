"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MarkaStatTone = "green" | "zinc" | "amber" | "primary" | "blue" | "rose" | "violet";

export type MarkaStatItem = {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: MarkaStatTone;
  href?: string;
};

const TONE_CLS: Record<MarkaStatTone, string> = {
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export function MarkaStatGrid({
  items,
  columns = 4,
  className,
}: {
  items: MarkaStatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const colCls =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : columns === 5
          ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
          : columns === 6
            ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-3 grid-cols-1", colCls, className)}>
      {items.map((item) => {
        const card = (
          <Card className={cn(item.href && "transition hover:border-primary/40 hover:shadow-sm")}>
            <CardContent className="flex items-center gap-3 py-4">
              {item.icon && (
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    TONE_CLS[item.tone ?? "primary"]
                  )}
                >
                  {item.icon}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-xl font-bold tabular-nums truncate">{item.value}</p>
                {item.sub && (
                  <p className="truncate text-[11px] text-muted-foreground">{item.sub}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className="block">
              {card}
            </Link>
          );
        }
        return <div key={item.label}>{card}</div>;
      })}
    </div>
  );
}
