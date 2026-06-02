"use client";

import Link from "next/link";
import { Activity, Bell, Inbox } from "lucide-react";
import { fmtDateTime } from "@/lib/fmt-date";
import type { AppNotification } from "@/store/store";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Partial<Record<AppNotification["type"], string>> = {
  brand_payment_reminder: "Ödeme",
  schedule_updated: "Takvim",
  expense_paid: "Harcama",
  general: "Duyuru",
  payroll_reminder: "Hatırlatma",
  api_refresh_alert: "İzlenme",
  content_published: "İçerik",
  deliverable_late: "Teslimat",
};

const TYPE_ACCENT: Partial<Record<AppNotification["type"], string>> = {
  brand_payment_reminder: "bg-[#22C55E]/15 text-[#16A34A] dark:text-[#4ADE80]",
  schedule_updated: "bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]",
  expense_paid: "bg-[#FF6B00]/15 text-[#FF6B00] dark:text-[#FF9A4D]",
  general: "bg-[#EC4899]/15 text-[#DB2777] dark:text-[#F472B6]",
  api_refresh_alert: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

interface BrandActivityFeedProps {
  notifications: AppNotification[];
  /** "Tümünü gör" rotası — bildirimler sayfası. */
  href: string;
  /** Maksimum gösterilecek bildirim sayısı. */
  limit?: number;
}

export function BrandActivityFeed({
  notifications,
  href,
  limit = 10,
}: BrandActivityFeedProps) {
  const items = notifications.slice(0, limit);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EC4899]/15 text-[#DB2777] ring-1 ring-[#EC4899]/30 dark:text-[#F472B6]">
            <Activity size={13} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Son aktivite
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              {notifications.length === 0
                ? "Henüz bildirim yok"
                : `${notifications.length} toplam · ${unread} okunmamış`}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#EC4899] hover:bg-[#EC4899]/10 dark:text-[#F472B6]"
        >
          Tümü →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <Inbox className="text-muted-foreground/60" size={22} />
            <p className="text-xs text-muted-foreground">
              Henüz bildirim yok. Ödeme, takvim ve içerik güncellemeleri burada görünecek.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((n) => {
              const label = TYPE_LABEL[n.type] ?? "Bildirim";
              const accent =
                TYPE_ACCENT[n.type] ??
                "bg-muted text-muted-foreground";
              const content = (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                    n.read
                      ? "border-border bg-card hover:bg-accent/30"
                      : "border-[#FF6B00]/30 bg-[#FF6B00]/5 hover:bg-[#FF6B00]/10"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[9px] font-bold uppercase tracking-wide",
                      accent
                    )}
                  >
                    {!n.read && <Bell size={8} />}
                    {label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        {n.message}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {fmtDateTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className="block">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
