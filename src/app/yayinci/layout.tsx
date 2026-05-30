"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { useStore, visibleNotificationsForRole } from "@/store/store";

const NAV: { href: string; label: string; match: string }[] = [
  { href: "/yayinci/maas",           label: "Maaş",            match: "maas" },
  { href: "/yayinci/harcamalar",     label: "Harcamalar",      match: "harcamalar" },
  { href: "/yayinci/takvim",         label: "Haftalık plan",   match: "takvim" },
  { href: "/yayinci/izlenmeler",     label: "İzlenmeler",      match: "izlenmeler" },
  { href: "/yayinci/istatistikler",  label: "İstatistikler",   match: "istatistikler" },
  { href: "/yayinci/hesaplar",       label: "Hesaplar",        match: "hesaplar" },
  { href: "/yayinci/marka-linkleri", label: "Marka linkleri",  match: "marka-linkleri" },
  { href: "/yayinci/profil",         label: "Havuz profili",   match: "profil" },
  { href: "/yayinci/teklifler",      label: "Teklifler",       match: "teklifler" },
  { href: "/yayinci/postlar",        label: "Postlar",         match: "postlar" },
  { href: "/yayinci/gecmis",         label: "Geçmiş aylar",    match: "gecmis" },
  { href: "/yayinci/bildirimler",    label: "Mesajlar",        match: "bildirimler" },
];

export default function YayinciLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const contentExpenses = useStore((s) => s.contentExpenses);
  const notifications = useStore((s) => s.notifications);
  const employees      = useStore((s) => s.employees);
  const targetEmployeeId = panelViewAs?.employeeId ?? user?.employeeId;
  const me             = employees.find((e) => e.id === targetEmployeeId);
  const myExpenses = me
    ? contentExpenses.filter((e) => e.employeeId === me.id)
    : [];
  const pendingCount = myExpenses.filter((e) => e.reviewStatus === "pending").length;
  const needsInfoCount = myExpenses.filter((e) => e.reviewStatus === "needs_info").length;
  const streamerNotifs = user
    ? visibleNotificationsForRole(notifications, "streamer", user.id)
    : [];
  const unreadMessages = streamerNotifs.filter((n) => !n.read).length;
  const unreadExpenseNotifs = streamerNotifs.filter(
    (n) =>
      !n.read &&
      (n.href?.includes("/yayinci/harcamalar") ||
        n.type === "expense_approved" ||
        n.type === "expense_rejected" ||
        n.type === "expense_paid" ||
        (n.type === "general" && n.title.toLowerCase().includes("harcama")))
  ).length;
  const harcamalarBadge = Math.max(needsInfoCount, unreadExpenseNotifs, pendingCount);

  return (
    <div className="w-full min-w-0">
      <nav
        aria-label="Yayıncı bölümleri"
        className="-mx-3 mb-3 border-b border-border/70 bg-background/95 sm:-mx-6 md:-mx-8 lg:-mx-10"
      >
        <div className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-3 py-2.5 sm:px-6 md:px-8 lg:px-10">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showDot =
              (item.match === "harcamalar" && harcamalarBadge > 0) ||
              (item.match === "bildirimler" && unreadMessages > 0);
            const dotCount =
              item.match === "bildirimler"
                ? unreadMessages
                : item.match === "harcamalar"
                  ? harcamalarBadge
                  : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
                {showDot && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0 text-[10px] font-bold text-amber-950 tabular-nums">
                    {dotCount > 9 ? "9+" : dotCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
