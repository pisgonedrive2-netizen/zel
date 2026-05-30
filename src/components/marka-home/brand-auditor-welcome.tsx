"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Eye,
  Lock,
  ArrowRight,
  BarChart3,
  Wallet,
  Receipt,
  TrendingUp,
  X,
} from "lucide-react";
import { markaHref } from "@/lib/use-marka-view-month";

interface AuditorLink {
  href: string;
  label: string;
  description: string;
  icon: typeof BarChart3;
}

/**
 * Marka-içi denetçi (orgRole: "auditor") için ilk giriş karşılaması.
 * Salt-okunur erişimi, neyi görüp göremeyeceğini açıklar ve denetim için
 * en sık kullanılan modüllere kısayol verir. Kapatıldığında (localStorage)
 * tekrar gösterilmez.
 */
export function BrandAuditorWelcome({
  brandName,
  brandId,
  month,
}: {
  brandName: string;
  brandId: string;
  month: string;
}) {
  const storageKey = `foxstream:auditor-welcome:${brandId}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* yoksay */
    }
    setDismissed(true);
  };

  const links: AuditorLink[] = [
    {
      href: markaHref("/marka/operasyon", month),
      label: "Operasyon & KPI",
      description: "Kayıt, FTD, yatırım — aylık göstergeler",
      icon: BarChart3,
    },
    {
      href: "/marka/muhasebe",
      label: "Muhasebe",
      description: "Gelir/gider defteri ve faturalar",
      icon: Receipt,
    },
    {
      href: markaHref("/marka/odemeler", month),
      label: "Ödemeler",
      description: "Taksitler ve ödeme durumu",
      icon: Wallet,
    },
    {
      href: markaHref("/marka/izlenmeler", month),
      label: "İzlenmeler",
      description: "Link metrikleri ve snapshotlar",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-300/50 bg-gradient-to-br from-indigo-50/70 to-card p-5 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/30">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Karşılamayı kapat"
        title="Karşılamayı kapat"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X size={15} />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="text-sm font-semibold text-foreground">
            Denetçi paneline hoş geldiniz — {brandName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bu hesap <strong>salt-okunur denetim</strong> erişimine sahiptir. Markanın
            tüm modüllerini görebilir, ancak hiçbir veriyi değiştiremezsiniz.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
          <Eye size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Görebilirsiniz:</span> operasyon,
            muhasebe, ödemeler, izlenmeler, personel, CRM ve affiliate verileri.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Yapamazsınız:</span> kayıt
            ekleme/silme, tutar değiştirme, ekip yönetimi. Ekleme/düzenleme butonları gizlidir.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors hover:border-indigo-400/50 hover:bg-muted/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-foreground">{l.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {l.description}
                </span>
              </span>
              <ArrowRight
                size={13}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
              />
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-indigo-700"
        >
          Anladım, başla
        </button>
      </div>
    </div>
  );
}
