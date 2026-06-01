"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  LayoutDashboard,
  BarChart3,
  Users,
  Send,
  Handshake,
  CalendarDays,
  Eye,
  Video,
  TrendingUp,
  Contact,
  Briefcase,
  ClipboardList,
  Settings,
  Calculator,
  FileText,
  Wallet,
  UserCog,
  Bell,
  Banknote,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import { clientHasOrgCapability, type OrgCapability } from "@/lib/org-capability";

type NavGroup =
  | "Genel"
  | "İş Birliği"
  | "İzlenme"
  | "Büyüme"
  | "Ekip"
  | "Finans"
  | "Hesap";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: NavGroup;
  cap?: OrgCapability;
};

const NAV: readonly NavItem[] = [
  { href: "/marka/anasayfa", label: "Anasayfa", icon: LayoutDashboard, group: "Genel" },
  { href: "/marka/operasyon", label: "Operasyon özeti", icon: BarChart3, group: "Genel" },

  { href: "/marka/havuz", label: "Yayıncı havuzu", icon: Users, group: "İş Birliği" },
  { href: "/marka/teklifler", label: "Teklifler", icon: Send, group: "İş Birliği" },
  { href: "/marka/anlasmalar", label: "Anlaşmalar", icon: Handshake, group: "İş Birliği" },
  { href: "/marka/takvim", label: "Yayıncı takvimi", icon: CalendarDays, group: "İş Birliği" },

  { href: "/marka/izlenmeler", label: "İzlenmeler", icon: Eye, group: "İzlenme" },
  { href: "/marka/postlar", label: "Postlar", icon: Video, group: "İzlenme" },

  { href: "/marka/affiliate", label: "Affiliate", icon: TrendingUp, group: "Büyüme" },
  { href: "/marka/crm", label: "CRM", icon: Contact, group: "Büyüme", cap: "crm" },

  { href: "/marka/personel", label: "Personel", icon: Briefcase, group: "Ekip", cap: "hr" },
  { href: "/marka/departmanlar", label: "Departmanlar", icon: Building2, group: "Ekip", cap: "hr" },
  { href: "/marka/takip", label: "Görev & Takip", icon: ClipboardList, group: "Ekip", cap: "hr" },
  { href: "/marka/ekip", label: "Ekip & yetkiler", icon: Settings, group: "Ekip", cap: "team" },

  { href: "/marka/muhasebe", label: "Muhasebe", icon: Calculator, group: "Finans", cap: "finance" },
  { href: "/marka/faturalar", label: "Faturalar", icon: FileText, group: "Finans", cap: "finance" },
  { href: "/marka/bordro", label: "Bordro", icon: Banknote, group: "Finans", cap: "finance" },
  { href: "/marka/odemeler", label: "Ödeme planı", icon: Wallet, group: "Finans" },

  { href: "/marka/profil", label: "Marka profili", icon: UserCog, group: "Hesap" },
  { href: "/marka/bildirimler", label: "Bildirimler", icon: Bell, group: "Hesap" },
];

const GROUP_ORDER: NavGroup[] = [
  "Genel",
  "İş Birliği",
  "İzlenme",
  "Büyüme",
  "Ekip",
  "Finans",
  "Hesap",
];

function groupForPath(pathname: string, items: readonly NavItem[]): NavGroup {
  const hit = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  return hit?.group ?? "Genel";
}

function activeItemForPath(pathname: string, items: readonly NavItem[]): NavItem | undefined {
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
}

export function MarkaSubnav() {
  const pathname = usePathname();
  const { user, month, isAdminView, brandId } = useMarkaPortal();
  const orgRole = isAdminView ? "admin" : user?.orgRole;
  const navItems = NAV.filter((item) => !item.cap || clientHasOrgCapability(orgRole, item.cap));

  const pathGroup = useMemo(() => groupForPath(pathname, navItems), [pathname, navItems]);
  const activeItem = useMemo(() => activeItemForPath(pathname, navItems), [pathname, navItems]);
  const [mobileGroup, setMobileGroup] = useState<NavGroup>(pathGroup);

  useEffect(() => {
    setMobileGroup(pathGroup);
  }, [pathGroup]);

  const mobileGroupItems = navItems.filter((n) => n.group === mobileGroup);
  const visibleGroups = GROUP_ORDER.filter((g) => navItems.some((n) => n.group === g));

  return (
    <nav
      aria-label="Marka paneli"
      className={cn(
        "z-30 mb-3 border-b border-border/70 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
        /* PanelViewBanner (üst şerit) ile çakışmasın */
        isAdminView ? "sticky top-10 sm:top-11" : "sticky top-0"
      )}
    >
      {/* Masaüstü: breadcrumb — sidebar zaten tam menüyü gösterir */}
      <div className="mx-auto hidden max-w-[1280px] items-center justify-between gap-3 px-1 py-2 md:flex">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {pathGroup}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {activeItem?.label ?? "Marka paneli"}
          </p>
        </div>
        {isAdminView && brandId && (
          <Link
            href={markaHref(`/izlenme/marka/${brandId}`, month)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent"
          >
            Detaylı izlenme
            <ArrowUpRight size={12} />
          </Link>
        )}
      </div>

      {/* Mobil / tablet: gruplu kısayol — yalnızca seçili gruptaki sayfalar */}
      <div className="mx-auto max-w-[1280px] px-1 py-2 md:hidden">
        {isAdminView && brandId && (
          <Link
            href={markaHref(`/izlenme/marka/${brandId}`, month)}
            className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent"
          >
            Detaylı izlenme paneli
            <ArrowUpRight size={12} />
          </Link>
        )}
        <div
          className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-none"
          role="tablist"
          aria-label="Marka modül grupları"
        >
          {visibleGroups.map((group) => {
            const selected = mobileGroup === group;
            return (
              <button
                key={group}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setMobileGroup(group)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {group}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
          {mobileGroupItems.map((item) => {
            const Icon = item.icon;
            const href = markaHref(item.href, month);
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={14} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
