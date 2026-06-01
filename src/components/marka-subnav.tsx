"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

// Sıralama + gruplama src/components/sidebar.tsx içindeki BRAND_NAV ile BİREBİR aynıdır.
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

export function MarkaSubnav() {
  const pathname = usePathname();
  const { user, month, isAdminView, brandId, brand } = useMarkaPortal();
  const orgRole = isAdminView ? "admin" : user?.orgRole;
  const navItems = NAV.filter((item) => !item.cap || clientHasOrgCapability(orgRole, item.cap));

  return (
    <nav
      aria-label="Marka paneli"
      className="sticky top-0 z-40 mb-4 border-b border-border/70 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-1 py-2.5 sm:py-3">
        {isAdminView && brandId && brand && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs dark:border-violet-500/40 dark:bg-violet-950/35">
            <span className="text-violet-900 dark:text-violet-100">
              Yönetici görünümü: <strong>{brand.name}</strong>
            </span>
            <Link
              href={markaHref(`/izlenme/marka/${brandId}`, month)}
              className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline dark:text-violet-300"
            >
              Detaylı izlenme paneli
              <ArrowUpRight size={12} />
            </Link>
          </div>
        )}
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const href = markaHref(item.href, month);
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showDivider = i > 0 && item.group !== navItems[i - 1].group;
            return (
              <div key={item.href} className="flex items-stretch">
                {showDivider && (
                  <span
                    aria-hidden
                    className="mx-1 my-1.5 w-px shrink-0 self-stretch bg-border"
                  />
                )}
                <Link
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
              </div>
            );
          })}
        </div>
        <div className="hidden flex-wrap gap-1 sm:flex">
          {GROUP_ORDER.map((group) => {
            const inGroup = navItems.filter((n) => n.group === group);
            if (inGroup.length === 0) return null;
            return (
              <span
                key={group}
                className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {group}
              </span>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
