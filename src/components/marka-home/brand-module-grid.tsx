"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  Lock,
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
} from "lucide-react";
import { clientHasOrgCapability, type OrgCapability } from "@/lib/org-capability";
import { markaHref } from "@/lib/use-marka-view-month";
import { cn } from "@/lib/utils";

type ModuleColor = "orange" | "green" | "blue" | "pink" | "violet";

interface ModuleItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: ModuleColor;
  cap?: OrgCapability;
}

interface ModuleSection {
  title: string;
  items: ModuleItem[];
}

// Sidebar BRAND_NAV / marka-subnav ile aynı gruplama ve sıralama mantığı.
const SECTIONS: ModuleSection[] = [
  {
    title: "İş Birliği",
    items: [
      { href: "/marka/havuz", label: "Yayıncı havuzu", description: "Yayıncıları keşfet, filtrele ve teklif gönder", icon: Users, color: "orange" },
      { href: "/marka/teklifler", label: "Teklifler", description: "Gönderdiğin teklifleri ve yanıtları yönet", icon: Send, color: "orange" },
      { href: "/marka/anlasmalar", label: "Anlaşmalar", description: "Aktif iş birliği anlaşmaları ve şartlar", icon: Handshake, color: "orange" },
      { href: "/marka/takvim", label: "Yayıncı takvimi", description: "Haftalık yayın planlarını gör", icon: CalendarDays, color: "orange" },
    ],
  },
  {
    title: "Performans",
    items: [
      { href: "/marka/izlenmeler", label: "İzlenmeler", description: "Link & sosyal platform izlenme takibi", icon: Eye, color: "blue" },
      { href: "/marka/postlar", label: "Postlar", description: "Yayıncı içerik ve reel performansı", icon: Video, color: "blue" },
    ],
  },
  {
    title: "Büyüme & CRM",
    items: [
      { href: "/marka/affiliate", label: "Affiliate", description: "Partner komisyon, FTD ve tıklama takibi", icon: TrendingUp, color: "pink" },
      { href: "/marka/crm", label: "CRM", description: "Lead, fırsat ve müşteri ilişkileri", icon: Contact, color: "pink", cap: "crm" },
    ],
  },
  {
    title: "Ekip & İK",
    items: [
      { href: "/marka/personel", label: "Personel", description: "Personel kayıtları, roller ve detaylar", icon: Briefcase, color: "violet", cap: "hr" },
      { href: "/marka/takip", label: "Görev & Takip", description: "Görev atama ve vardiya takibi", icon: ClipboardList, color: "violet", cap: "hr" },
      { href: "/marka/ekip", label: "Ekip & yetkiler", description: "Ekip üyeleri ve rol yetkileri", icon: Settings, color: "violet", cap: "team" },
    ],
  },
  {
    title: "Finans",
    items: [
      { href: "/marka/muhasebe", label: "Muhasebe", description: "Gelir/gider defteri ve bakiye", icon: Calculator, color: "green", cap: "finance" },
      { href: "/marka/faturalar", label: "Faturalar", description: "Fatura oluştur, gönder ve takip et", icon: FileText, color: "green", cap: "finance" },
      { href: "/marka/odemeler", label: "Ödeme planı", description: "Taksit planı ve ödeme durumu", icon: Wallet, color: "green" },
    ],
  },
];

const COLOR: Record<ModuleColor, { icon: string; ring: string; hover: string }> = {
  orange: {
    icon: "bg-[#FF6B00]/15 text-[#FF6B00] dark:text-[#FF9A4D]",
    ring: "ring-[#FF6B00]/30",
    hover: "hover:border-[#FF6B00]/40 hover:shadow-[0_0_18px_-6px_rgba(255,107,0,0.55)]",
  },
  green: {
    icon: "bg-[#22C55E]/15 text-[#16A34A] dark:text-[#4ADE80]",
    ring: "ring-[#22C55E]/30",
    hover: "hover:border-[#22C55E]/40 hover:shadow-[0_0_18px_-6px_rgba(34,197,94,0.55)]",
  },
  blue: {
    icon: "bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]",
    ring: "ring-[#3B82F6]/30",
    hover: "hover:border-[#3B82F6]/40 hover:shadow-[0_0_18px_-6px_rgba(59,130,246,0.55)]",
  },
  pink: {
    icon: "bg-[#EC4899]/15 text-[#DB2777] dark:text-[#F472B6]",
    ring: "ring-[#EC4899]/30",
    hover: "hover:border-[#EC4899]/40 hover:shadow-[0_0_18px_-6px_rgba(236,72,153,0.55)]",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/30",
    hover: "hover:border-violet-500/40 hover:shadow-[0_0_18px_-6px_rgba(139,92,246,0.55)]",
  },
};

interface BrandModuleGridProps {
  /** Marka kullanıcısının org rolü (admin marka görünümünde "admin"). */
  orgRole: string | undefined | null;
  /** Aktif görünüm ayı — modül linkleri ay-duyarlı. */
  month: string;
}

/**
 * Yeni markanın kullanabileceği tüm modülleri tanıtan keşif ızgarası.
 * Org rolüne/capability'ye göre yalnızca erişilebilir modüller gösterilir;
 * kullanıcının yetkisi olmayan modüller hiç render edilmez (nav ile aynı kural).
 */
export function BrandModuleGrid({ orgRole, month }: BrandModuleGridProps) {
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.cap || clientHasOrgCapability(orgRole, item.cap)
    ),
  })).filter((section) => section.items.length > 0);

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);

  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Compass size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Markanız için modüller
          </h3>
          <p className="text-xs text-muted-foreground">
            Erişiminiz olan {total} modülü keşfedin — her biri tek tıkla açılır.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.title}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => {
                const c = COLOR[item.color];
                return (
                  <Link
                    key={item.href}
                    href={markaHref(item.href, month)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-3 transition-all",
                      c.hover
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                        c.icon,
                        c.ring
                      )}
                    >
                      <item.icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <span className="truncate">{item.label}</span>
                        {item.cap && (
                          <Lock
                            size={10}
                            className="shrink-0 text-muted-foreground/70"
                            aria-label="Yetkiye bağlı modül"
                          />
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ArrowUpRight
                      size={14}
                      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
