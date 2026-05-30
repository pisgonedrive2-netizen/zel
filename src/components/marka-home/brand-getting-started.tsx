"use client";

import Link from "next/link";
import { Check, Circle, ArrowRight, Rocket } from "lucide-react";

export interface GettingStartedStep {
  label: string;
  description: string;
  href: string;
  done: boolean;
  /**
   * İsteğe bağlı modül adımı (ör. role/capability'ye göre eklenen Personel,
   * CRM, Muhasebe, Ekip). İlerleme yüzdesine ve panelin gizlenmesine dahil
   * edilmez; her zaman bir CTA olarak gösterilir.
   */
  optional?: boolean;
}

/**
 * Yeni marka için aksiyon odaklı başlangıç kontrol listesi. Tüm adımlar
 * tamamlandığında üst bileşen bunu gizler.
 */
export function BrandGettingStarted({
  brandName,
  steps,
}: {
  brandName: string;
  steps: GettingStartedStep[];
}) {
  const coreSteps = steps.filter((s) => !s.optional);
  const doneCount = coreSteps.filter((s) => s.done).length;
  const pct =
    coreSteps.length > 0 ? Math.round((doneCount / coreSteps.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Rocket size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Başlangıç adımları — {brandName}
          </h3>
          <p className="text-xs text-muted-foreground">
            Markanı kurmak için {coreSteps.length} adım · {doneCount}/{coreSteps.length} tamamlandı
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-primary">{pct}%</span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {steps.map((step) => (
          <li key={step.href}>
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
                  step.done ? "bg-emerald-500 text-white" : "text-muted-foreground"
                }`}
              >
                {step.done ? <Check size={13} /> : <Circle size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`flex items-center gap-1.5 text-[13px] font-medium ${
                    step.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {step.label}
                  {step.optional && !step.done && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      İsteğe bağlı
                    </span>
                  )}
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
