"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Gamepad2,
  ListTodo,
} from "lucide-react";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
import type { BrandStatsCurrency } from "@/lib/brand-monthly-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ActionQueueItem = {
  id: string;
  label: string;
  description?: string;
  severity: "high" | "medium" | "low";
  href?: string;
  icon: "offer" | "compliance" | "demo" | "affiliate";
};

type Props = {
  items: ActionQueueItem[];
  monthTitle?: string;
};

const ICONS = {
  offer: FileText,
  compliance: ClipboardCheck,
  demo: Gamepad2,
  affiliate: AlertTriangle,
};

const SEVERITY_BADGE: Record<ActionQueueItem["severity"], string> = {
  high: "border-red-300/60 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200",
  medium:
    "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200",
  low: "border-border bg-muted text-muted-foreground",
};

const SEVERITY_LABEL: Record<ActionQueueItem["severity"], string> = {
  high: "Acil",
  medium: "Önemli",
  low: "Bilgi",
};

export function buildActionQueueItems(opts: {
  pendingOffers: number;
  openCompliance: number;
  complianceOverdue?: number;
  lowDemoBalance: boolean;
  demoRemaining?: number;
  demoCurrency?: BrandStatsCurrency;
  affiliateAnomaly?: boolean;
  hrefs?: {
    offers?: string;
    compliance?: string;
    operasyon?: string;
    affiliate?: string;
  };
}): ActionQueueItem[] {
  const items: ActionQueueItem[] = [];

  if (opts.pendingOffers > 0) {
    items.push({
      id: "pending-offers",
      label: `${opts.pendingOffers} bekleyen teklif`,
      description: "Yanıt bekleyen yayıncı teklifleri",
      severity: opts.pendingOffers >= 3 ? "high" : "medium",
      href: opts.hrefs?.offers,
      icon: "offer",
    });
  }

  if (opts.openCompliance > 0) {
    items.push({
      id: "compliance-due",
      label: `${opts.openCompliance} uyumluluk maddesi`,
      description: opts.complianceOverdue
        ? `${opts.complianceOverdue} madde son tarihi geçmiş`
        : "Tamamlanmayı bekleyen kontroller",
      severity: (opts.complianceOverdue ?? 0) > 0 ? "high" : "medium",
      href: opts.hrefs?.compliance,
      icon: "compliance",
    });
  }

  if (opts.lowDemoBalance) {
    items.push({
      id: "low-demo",
      label: "Düşük demo bakiye",
      description:
        opts.demoRemaining != null
          ? `Kalan: ${fmtBrandMoney(opts.demoRemaining, opts.demoCurrency ?? "USD")}`
          : "Canlı yayın demo bakiyesi %20 altında",
      severity: "high",
      href: opts.hrefs?.operasyon,
      icon: "demo",
    });
  }

  if (opts.affiliateAnomaly) {
    items.push({
      id: "affiliate-anomaly",
      label: "Affiliate anomali",
      description: "FTD / kayıt oranında olağandışı sapma",
      severity: "medium",
      href: opts.hrefs?.affiliate,
      icon: "affiliate",
    });
  }

  return items;
}

export function BrandActionQueue({ items, monthTitle }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ListTodo size={16} className="text-amber-600 dark:text-amber-300" />
          Bugün yapılacaklar
        </CardTitle>
        <CardDescription>
          Aksiyon kuyruğu{monthTitle ? ` · ${monthTitle}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">
            Bekleyen kritik aksiyon yok — iyi gidiyor.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const row = (
                <>
                  <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", SEVERITY_BADGE[item.severity])}>
                    {SEVERITY_LABEL[item.severity]}
                  </Badge>
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-start gap-2.5 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/40 transition-colors"
                      )}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-md border border-border/60 px-3 py-2">
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
