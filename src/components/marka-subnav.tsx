"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import { clientHasOrgCapability } from "@/lib/org-capability";
import { MARKA_NAV_GROUP_ORDER, MARKA_NAV_ITEMS, type MarkaNavGroup } from "@/lib/marka-nav";
import { markaNavIcon } from "@/lib/marka-nav-icons";
import { isMainAdmin } from "@/lib/user-guards";

type NavGroup = MarkaNavGroup;

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: NavGroup;
  cap?: (typeof MARKA_NAV_ITEMS)[number]["cap"];
};

const NAV: readonly NavItem[] = MARKA_NAV_ITEMS.map((item) => ({
  href: item.href,
  label: item.label,
  icon: markaNavIcon(item.icon),
  group: item.group,
  cap: item.cap,
}));

const GROUP_ORDER = MARKA_NAV_GROUP_ORDER;

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
  const mainAdmin = user ? isMainAdmin(user) : false;
  const navItems = NAV.filter(
    (item) => !item.cap || clientHasOrgCapability(orgRole, item.cap, { isMainAdmin: mainAdmin })
  );

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
