"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  Clapperboard,
  Eye,
  Home,
  Link2,
  Menu,
  Search,
  Send,
  UserCog,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { useStore, visibleNotificationsForRole } from "@/store/store";

type NavItem = {
  href: string;
  label: string;
  match: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/yayinci/anasayfa", label: "Anasayfa", match: "anasayfa", icon: Home },
  { href: "/yayinci/maas", label: "Maaş", match: "maas", icon: Wallet },
  { href: "/yayinci/harcamalar", label: "Harcamalar", match: "harcamalar", icon: Clapperboard },
  { href: "/yayinci/takvim", label: "Takvim", match: "takvim", icon: CalendarDays },
];

const MORE_NAV: NavItem[] = [
  { href: "/yayinci/izlenmeler", label: "İzlenmeler", match: "izlenmeler", icon: Eye },
  { href: "/yayinci/istatistikler", label: "İstatistikler", match: "istatistikler", icon: BarChart3 },
  { href: "/yayinci/hesaplar", label: "Hesaplar", match: "hesaplar", icon: Link2 },
  { href: "/yayinci/marka-linkleri", label: "Marka linkleri", match: "marka-linkleri", icon: Activity },
  { href: "/yayinci/kesif", label: "Premium keşif", match: "kesif", icon: Search },
  { href: "/yayinci/profil", label: "Havuz profili", match: "profil", icon: UserCog },
  { href: "/yayinci/teklifler", label: "Teklifler", match: "teklifler", icon: Send },
  { href: "/yayinci/postlar", label: "Postlar", match: "postlar", icon: Video },
  { href: "/yayinci/gecmis", label: "Geçmiş aylar", match: "gecmis", icon: CalendarRange },
  { href: "/yayinci/bildirimler", label: "Mesajlar", match: "bildirimler", icon: Bell },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function YayinciLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const contentExpenses = useStore((s) => s.contentExpenses);
  const notifications = useStore((s) => s.notifications);
  const employees = useStore((s) => s.employees);
  const brandOffers = useStore((s) => s.brandOffers);
  const [moreOpen, setMoreOpen] = useState(false);

  const targetEmployeeId = panelViewAs?.employeeId ?? user?.employeeId;
  const me = employees.find((e) => e.id === targetEmployeeId);
  const myExpenses = me ? contentExpenses.filter((e) => e.employeeId === me.id) : [];
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
  const unreadOffers = me
    ? brandOffers.filter(
        (o) =>
          o.employeeId === me.id &&
          (o.status === "pending" || o.status === "negotiating")
      ).length
    : 0;

  const moreActive = useMemo(
    () => MORE_NAV.some((item) => isActive(pathname, item.href)),
    [pathname]
  );

  const badgeFor = (match: string): number => {
    if (match === "harcamalar") return harcamalarBadge;
    if (match === "bildirimler") return unreadMessages;
    if (match === "teklifler") return unreadOffers;
    return 0;
  };

  return (
    <div className="w-full min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      {children}

      {/* Mobil alt menü */}
      <nav
        aria-label="Yayıncı hızlı menü"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const dotCount = badgeFor(item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon size={18} />
                  {dotCount > 0 && (
                    <span className="absolute -right-2 -top-1 rounded-full bg-amber-400 px-1 py-0 text-[8px] font-bold text-amber-950 tabular-nums">
                      {dotCount > 9 ? "9+" : dotCount}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
              moreActive || moreOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span className="relative">
              <Menu size={18} />
              {(unreadMessages > 0 || unreadOffers > 0) && (
                <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </span>
            <span className="truncate">Daha fazla</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[min(70vh,520px)] overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl md:hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Tüm bölümler</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-2">
                {MORE_NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  const dotCount = badgeFor(item.match);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {dotCount > 0 && (
                        <span className="rounded-full bg-amber-400 px-1.5 py-0 text-[10px] font-bold text-amber-950 tabular-nums">
                          {dotCount > 9 ? "9+" : dotCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
