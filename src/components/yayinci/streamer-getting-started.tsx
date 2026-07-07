"use client";

import Link from "next/link";
import { Check, Circle, ArrowRight, Rocket } from "lucide-react";

export interface StreamerGettingStartedStep {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

/**
 * Yeni yayıncı için aksiyon odaklı başlangıç kontrol listesi. Tüm adımlar
 * tamamlandığında üst bileşen bunu gizler.
 */
export function StreamerGettingStarted({
  streamerName,
  steps,
}: {
  streamerName: string;
  steps: StreamerGettingStartedStep[];
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const pct =
    steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Rocket size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Başlangıç adımları — {streamerName}
          </h3>
          <p className="text-xs text-muted-foreground">
            Yayıncı panelini kurmak için {steps.length} adım · {doneCount}/
            {steps.length} tamamlandı
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-primary">
          {pct}%
        </span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                step.done
                  ? "border-emerald-300/50 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-950/20"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  step.done
                    ? "bg-emerald-500 text-white"
                    : "text-muted-foreground"
                }`}
              >
                {step.done ? <Check size={13} /> : <Circle size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[13px] font-medium ${
                    step.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {step.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {step.description}
                </span>
              </span>
              {!step.done && (
                <ArrowRight
                  size={14}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
