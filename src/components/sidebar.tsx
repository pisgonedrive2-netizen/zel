"use client";

import { useState, useEffect } from "react";
import { AppLink as Link } from "@/components/app-link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, ArrowUpRight,
  FolderKanban, Receipt, CalendarRange,
  FileSpreadsheet, ChevronLeft, ChevronRight,
  Search, X, CalendarDays, Eye, EyeOff,
  Wallet, Clapperboard, LogOut, ShieldCheck,
  Bell, Headphones, KeyRound, Link2, Activity, BarChart3,
  Send, Handshake, Video, TrendingUp, UserCog,
  Briefcase, ClipboardList, Contact, Calculator, FileText, Settings,
  Banknote, Building2, Zap, Plug, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clientHasOrgCapability, type OrgCapability } from "@/lib/org-capability";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { useSidebar } from "@/store/sidebar";
import { useUiPrefs } from "@/store/ui-prefs";
import { DeveloperAttribution } from "@/components/developer-attribution";
import { useStore, unreadNotificationCount, visibleNotificationsForRole } from "@/store/store";
import {
  markNotificationReadPersisted,
  markAllNotificationsReadPersisted,
  deleteNotificationPersisted,
  deleteNotificationsPersisted,
} from "@/lib/notification-actions";
import { fmtDateShort } from "@/lib/fmt-date";
import { MARKA_NAV_ITEMS } from "@/lib/marka-nav";
import { markaNavIcon } from "@/lib/marka-nav-icons";
import { notificationsHrefForRole } from "@/lib/notification-href";
import { isMainAdmin, canAccessPrim } from "@/lib/user-guards";

type NavItem = {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
  group:
    | "Kontrol" | "Bordro" | "Yayın" | "Muhasebe" | "Sistem"
    | "Yönetim" | "Finans" | "Yayıncı" | "Denetim" | "Marka"
    | "Genel" | "İş Birliği" | "İzlenme" | "Büyüme" | "Ekip" | "Hesap";
  cap?:  OrgCapability;
  /** Yalnızca ana yönetici (orkun) görür. */
  mainAdminOnly?: boolean;
  /** Para/finansal hassas öğe — "ekran paylaşımı (gizli mod)" açıkken gizlenir. */
  sensitive?: boolean;
};

const ADMIN_NAV: NavItem[] = [
  { href: "/ozet",                 label: "Özet",               icon: LayoutDashboard, group: "Kontrol", mainAdminOnly: true, sensitive: true },
  { href: "/prim",                 label: "Prim Havuzu",        icon: Trophy,          group: "Kontrol", mainAdminOnly: true, sensitive: true },
  { href: "/gorevler",             label: "Görevler",           icon: ClipboardList,   group: "Kontrol" },
  { href: "/maaslar",              label: "Maaşlar",            icon: Users,           group: "Bordro", sensitive: true },
  { href: "/rapor",                label: "Ödeme Raporu",       icon: FileSpreadsheet, group: "Bordro", sensitive: true },
  { href: "/kasa",                 label: "Kasa",               icon: Wallet,          group: "Bordro", sensitive: true },
  { href: "/takvim",               label: "Haftalık Takvim",    icon: CalendarDays,    group: "Yayın" },
  { href: "/izlenme",              label: "İzlenme özeti",       icon: Eye,             group: "Yayın" },
  { href: "/izlenme/markalar",     label: "Markalar",            icon: BarChart3,       group: "Yayın" },
  { href: "/izlenme/grafikler",    label: "İzlenme grafikleri",  icon: Activity,      group: "Yayın" },
  { href: "/izlenme/operatorler",  label: "Operatörler",         icon: Users,           group: "Yayın" },
  { href: "/izlenme/api",          label: "API & keşif",         icon: Search,          group: "Yayın" },
  { href: "/icerik-harcamalari",   label: "İçerik Harcamaları", icon: Clapperboard,    group: "Yayın", sensitive: true },
  { href: "/dis-gelir",            label: "Dış Gelir (Geçmiş)", icon: ArrowUpRight,    group: "Muhasebe", sensitive: true },
  { href: "/ic-gelir",             label: "İç Gelir",           icon: FolderKanban,    group: "Muhasebe", sensitive: true },
  { href: "/giderler",             label: "Giderler",           icon: Receipt,         group: "Muhasebe", sensitive: true },
  { href: "/planlanan",            label: "Planlanan",          icon: CalendarRange,   group: "Muhasebe", sensitive: true },
  { href: "/kullanicilar",         label: "Kullanıcılar",       icon: KeyRound,        group: "Sistem" },
  { href: "/bildirimler",          label: "Bildirim Merkezi",   icon: Bell,            group: "Sistem" },
];

const STREAMER_NAV: NavItem[] = [
  { href: "/yayinci/maas",           label: "Maaş",               icon: Wallet,          group: "Yayıncı" },
  { href: "/yayinci/harcamalar",     label: "Harcamalarım",       icon: Clapperboard,    group: "Yayıncı" },
  { href: "/yayinci/takvim",         label: "Haftalık Planım",    icon: CalendarDays,    group: "Yayıncı" },
  { href: "/yayinci/izlenmeler",     label: "İzlenmeler",         icon: Eye,             group: "Yayıncı" },
  { href: "/yayinci/hesaplar",       label: "Hesaplarım",         icon: Link2,           group: "Yayıncı" },
  { href: "/yayinci/marka-linkleri", label: "Marka Linkleri",     icon: Activity,        group: "Yayıncı" },
  { href: "/yayinci/kesif",          label: "Premium Keşif",    icon: Search,          group: "Yayıncı" },
  { href: "/yayinci/gecmis",         label: "Geçmiş Aylar",       icon: CalendarRange,   group: "Yayıncı" },
  { href: "/yayinci/istatistikler",  label: "İstatistiklerim",    icon: BarChart3,       group: "Yayıncı" },
  // İş birliği (yeni B2B özellikleri)
  { href: "/yayinci/teklifler",      label: "Tekliflerim",        icon: Send,            group: "İş Birliği" },
  { href: "/yayinci/postlar",        label: "Postlarım",          icon: Video,           group: "İş Birliği" },
  // Hesap
  { href: "/yayinci/profil",         label: "Havuz Profilim",     icon: UserCog,         group: "Hesap" },
  { href: "/yayinci/bildirimler",    label: "Bildirimlerim",      icon: Bell,            group: "Hesap" },
];

const AUDITOR_NAV: NavItem[] = [
  { href: "/denetci",             label: "Denetim Özeti",     icon: Headphones,      group: "Kontrol" },
  { href: "/kasa",                label: "Kasa",              icon: Wallet,          group: "Bordro" },
  { href: "/izlenme",             label: "Marka link & izlenme", icon: Eye,           group: "Yayın" },
  { href: "/icerik-harcamalari",  label: "İçerik Harcamaları",icon: Clapperboard,    group: "Yayın" },
  { href: "/maaslar",             label: "Maaşlar (Read)",    icon: Users,           group: "Bordro" },
  { href: "/rapor",               label: "Ödeme Raporu",      icon: FileSpreadsheet, group: "Bordro" },
  { href: "/giderler",            label: "Giderler",          icon: Receipt,         group: "Muhasebe" },
  { href: "/bildirimler",         label: "Bildirim Merkezi",  icon: Bell,            group: "Sistem" },
];

const BRAND_NAV: NavItem[] = MARKA_NAV_ITEMS.map((item) => ({
  href: item.href,
  label: item.label,
  icon: markaNavIcon(item.icon),
  group: item.group,
  cap: item.cap,
}));

export default function Sidebar() {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, logout } = useAuth();

  const open       = useSidebar((s) => s.open);
  const setOpen    = useSidebar((s) => s.setOpen);
  const collapsed  = useSidebar((s) => s.collapsed);
  const toggleCollapsed = useSidebar((s) => s.toggleCollapsed);

  const [search, setSearch] = useState("");

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(true);
      else setOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setOpen]);

  // Mobil sidebar açıkken body scroll'unu kilitle.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (open && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const adminViewingStreamer =
    user?.role === "admin" && !!panelViewAs && pathname.startsWith("/yayinci");
  const adminViewingBrand =
    user?.role === "admin" && !!brandViewAs && pathname.startsWith("/marka");

  // Rol bazlı nav
  const nav: NavItem[] =
    adminViewingStreamer      ? STREAMER_NAV :
    adminViewingBrand         ? BRAND_NAV    :
    user?.role === "admin"    ? ADMIN_NAV    :
    user?.role === "auditor"  ? AUDITOR_NAV  :
    user?.role === "brand"    ? BRAND_NAV    :
    STREAMER_NAV;
  const BRAND_GROUPS: NavItem["group"][] = ["Genel", "İş Birliği", "İzlenme", "Büyüme", "Ekip", "Finans", "Hesap"];
  const STREAMER_GROUPS: NavItem["group"][] = ["Yayıncı", "İş Birliği", "Hesap"];
  const groups: NavItem["group"][] =
    adminViewingStreamer     ? STREAMER_GROUPS :
    adminViewingBrand        ? BRAND_GROUPS :
    user?.role === "admin"   ? ["Kontrol", "Bordro", "Yayın", "Muhasebe", "Sistem"] :
    user?.role === "auditor" ? ["Kontrol", "Bordro", "Yayın", "Muhasebe", "Sistem"] :
    user?.role === "brand"   ? BRAND_GROUPS :
                               STREAMER_GROUPS;

  // Bildirimler
  const notifications = useStore((s) => s.notifications);
  const userBrandIds  = user?.role === "brand"
    ? (user.brandIds && user.brandIds.length ? user.brandIds : user.brandId ? [user.brandId] : [])
    : undefined;
  const unreadCount   = user
    ? unreadNotificationCount(notifications, user.role, user.id, userBrandIds)
    : 0;

  // Marka modüllerinde org-capability gizleme: admin marka görünümünde tümü görünür,
  // marka kullanıcısı org rolüne göre (marka-subnav ile aynı mantık).
  const orgRole = adminViewingBrand ? "admin" : user?.orgRole;
  const isOrkun = user ? isMainAdmin(user) : false;
  const screenShareMode = useUiPrefs((s) => s.screenShareMode);
  const toggleScreenShareMode = useUiPrefs((s) => s.toggleScreenShareMode);
  /** Gizli mod yalnızca ana yönetici (Orkun) kullanabilir. */
  const effectiveScreenShareMode = isOrkun && screenShareMode;
  const filtered = nav.filter(n =>
    (!search || n.label.toLowerCase().includes(search.toLowerCase())) &&
    (!n.mainAdminOnly || canAccessPrim(user)) &&
    (!n.sensitive || !effectiveScreenShareMode) &&
    (!n.cap || clientHasOrgCapability(orgRole, n.cap, { isMainAdmin: isOrkun }))
  );

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full z-40 border-r transition-all duration-300 ease-in-out flex flex-col",
          "bg-sidebar text-sidebar-foreground border-sidebar-border",
          "max-w-[85vw] shadow-2xl md:shadow-none",
          "md:translate-x-0 md:static md:z-auto md:flex-shrink-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-20" : "w-72"
        )}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between p-5 border-b border-sidebar-border bg-sidebar-accent/20">
          {!collapsed && (
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground font-bold text-base">Y</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sidebar-foreground text-base leading-tight">
                  Yayıncı Dashboard
                </span>
                <span className="text-xs text-muted-foreground">Proje Takip</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center mx-auto shadow-sm">
              <span className="text-primary-foreground font-bold text-base">Y</span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-md hover:bg-sidebar-accent transition-all duration-200"
            aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
            title={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
              : <ChevronLeft  className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ara..."
                aria-label="Menüde ara"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* Ekran paylaşımı (gizli mod) — yalnızca Orkun; finansal menüleri gizler */}
        {!collapsed && isOrkun && (
          <div className="px-4 pb-1">
            <button
              type="button"
              onClick={toggleScreenShareMode}
              aria-pressed={effectiveScreenShareMode}
              title={effectiveScreenShareMode ? "Gizli mod açık — finansal menüler gizli" : "Ekran paylaşımı için finansal menüleri gizle"}
              className={cn(
                "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
                effectiveScreenShareMode
                  ? "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-2">
                {effectiveScreenShareMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Gizli mod {effectiveScreenShareMode ? "(açık)" : ""}
              </span>
              <span
                className={cn(
                  "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                  effectiveScreenShareMode ? "bg-amber-500" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                    effectiveScreenShareMode ? "translate-x-3.5" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          </div>
        )}

        {/* Marka değiştir (çok markalı marka kullanıcısı) */}
        {!collapsed && user?.role === "brand" && <BrandSwitcher />}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {groups.map((group) => {
            const items = filtered.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                {!collapsed && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {group}
                  </p>
                )}
                <ul className="space-y-1">
                  {items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => { if (window.innerWidth < 768) setOpen(false); }}
                          title={collapsed ? label : undefined}
                          className={cn(
                            "w-full flex items-center px-3 py-3 rounded-md transition-all duration-200 group",
                            collapsed ? "justify-center px-2" : "space-x-2.5",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          )}
                        >
                          <div className="flex items-center justify-center min-w-[20px]">
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                active
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                          </div>
                          {!collapsed && (
                            <span className={cn("text-sm", active ? "font-medium" : "font-normal")}>
                              {label}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto border-t border-sidebar-border">
          {/* Notification bell */}
          {!collapsed && user && (
            <div className="p-3 border-b border-sidebar-border">
              <NotificationButton unreadCount={unreadCount} />
            </div>
          )}
          {collapsed && user && unreadCount > 0 && (
            <div className="p-2 border-b border-sidebar-border flex justify-center">
              <button
                type="button"
                onClick={() => router.push(notificationsHrefForRole(user.role))}
                aria-label={`Bildirimler (${unreadCount} okunmamış)`}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/40 transition-colors"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </button>
            </div>
          )}

          {/* User panel */}
          {!collapsed && user && (
            <div className="p-3 border-b border-sidebar-border bg-sidebar-accent/10">
              <div className="flex items-center px-3 py-2 rounded-md bg-card border border-border">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm",
                  user.role === "admin"   ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"   :
                  user.role === "auditor" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" :
                  user.role === "brand"   ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300" :
                                            "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                )}>
                  {user.avatar || user.name[0]}
                </div>
                <div className="flex-1 min-w-0 ml-2.5">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {user.role === "admin"   && <ShieldCheck size={9} className="text-blue-600 dark:text-blue-400" />}
                    {user.role === "auditor" && <Headphones size={9} className="text-purple-600 dark:text-purple-400" />}
                    {user.role === "brand"   && <Eye size={9} className="text-violet-600 dark:text-violet-400" />}
                    {user.role === "admin"   ? "Yönetici" : user.role === "auditor" ? "Denetçi" : user.role === "brand" ? "Marka" : "Yayıncı"}
                  </p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full ml-2" title="Online" />
              </div>
            </div>
          )}
          {collapsed && user && (
            <div className="py-3 px-2 border-b border-sidebar-border">
              <div className="flex justify-center">
                <div className="relative">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm",
                    user.role === "admin"   ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"   :
                    user.role === "auditor" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" :
                    user.role === "brand"   ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300" :
                                              "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  )} title={user.name}>
                    {user.avatar || user.name[0]}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-sidebar" />
                </div>
              </div>
            </div>
          )}

          <div className="p-3 space-y-1">
            <button
              onClick={handleLogout}
              aria-label="Çıkış Yap"
              title={collapsed ? "Çıkış Yap" : undefined}
              className={cn(
                "w-full flex items-center rounded-md text-left transition-all duration-200 group",
                "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                collapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2.5"
              )}
            >
              <div className="flex items-center justify-center min-w-[20px]">
                <LogOut className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-destructive" />
              </div>
              {!collapsed && <span className="text-sm">Çıkış Yap</span>}
            </button>
          </div>
          <DeveloperAttribution placement="sidebar" sidebarCollapsed={collapsed} />
        </div>
      </div>
    </>
  );
}

// ── Marka değiştirici (multi-tenant marka kullanıcısı) ───────────────────
function BrandSwitcher() {
  const { user } = useAuth();
  const brands = useStore((s) => s.brands);
  const activeBrandId = usePanelView((s) => s.activeBrandId);
  const setActiveBrand = usePanelView((s) => s.setActiveBrand);

  // Marka oturumunda store.brands zaten erişilebilir markalarla scope'lanmıştır.
  if (!user || user.role !== "brand" || brands.length <= 1) return null;

  const current =
    (activeBrandId && brands.some((b) => b.id === activeBrandId) && activeBrandId) ||
    (user.brandId && brands.some((b) => b.id === user.brandId) && user.brandId) ||
    brands[0]?.id ||
    "";

  return (
    <div className="px-4 pb-2">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Aktif marka
      </label>
      <select
        value={current}
        onChange={(e) => setActiveBrand(e.target.value)}
        aria-label="Aktif markayı değiştir"
        className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Notification button + panel ─────────────────────────────────────────
function NotificationButton({ unreadCount }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { notifications } = useStore();

  if (!user) return null;
  const popupBrandIds =
    user.role === "brand"
      ? (user.brandIds && user.brandIds.length ? user.brandIds : user.brandId ? [user.brandId] : [])
      : undefined;
  const my = visibleNotificationsForRole(notifications, user.role, user.id, popupBrandIds).slice(0, 30);
  const clearAllInPopup = async () => {
    if (my.length === 0) return;
    if (!window.confirm(`${my.length} bildirimi temizlemek istiyor musun?`)) return;
    const { deleted, failed } = await deleteNotificationsPersisted(my.map((n) => n.id));
    if (failed > 0) {
      window.alert(`${deleted} silindi, ${failed} bildirim silinemedi.`);
      return;
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Bildirimler${unreadCount > 0 ? ` (${unreadCount} okunmamış)` : ""}`}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors",
          "bg-card border border-border hover:border-primary/40"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-sm text-foreground">Bildirimler</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{my.length}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 right-0 bottom-full mb-2 z-50 w-[20rem] max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground border border-border rounded-lg shadow-xl"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Son Bildirimler</p>
              <div className="flex items-center gap-2">
                {my.length > 0 && (
                  <button
                    onClick={() => void clearAllInPopup()}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Temizle
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={() => void markAllNotificationsReadPersisted(user.role, user.id)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Okundu
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {my.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-3 py-4 text-center">Bildirim yok.</p>
              ) : (
                my.map((n) => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      void markNotificationReadPersisted(n.id);
                      if (n.href) {
                        setOpen(false);
                        router.push(n.href);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void markNotificationReadPersisted(n.id);
                        if (n.href) {
                          setOpen(false);
                          router.push(n.href);
                        }
                      }
                    }}
                    className={cn(
                      "w-full cursor-pointer text-left px-3 py-2 border-b border-border hover:bg-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                      !n.read && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", !n.read ? "bg-primary" : "bg-muted-foreground/40")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[9px] text-muted-foreground/80 mt-0.5">
                          {fmtDateShort(n.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void deleteNotificationPersisted(n.id); }}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Bildirimi sil"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
