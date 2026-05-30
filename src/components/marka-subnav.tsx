"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import { clientHasOrgCapability, type OrgCapability } from "@/lib/org-capability";
import { ArrowUpRight } from "lucide-react";

type NavItem = { href: string; label: string; cap?: OrgCapability };

const NAV: readonly NavItem[] = [
  // Genel
  { href: "/marka/anasayfa", label: "Anasayfa" },
  { href: "/marka/operasyon", label: "Operasyon özeti" },
  // İş birliği akışı
  { href: "/marka/havuz", label: "Yayıncı havuzu" },
  { href: "/marka/teklifler", label: "Teklifler" },
  { href: "/marka/anlasmalar", label: "Anlaşmalar" },
  { href: "/marka/takvim", label: "Yayıncı takvimi" },
  // Performans & içerik
  { href: "/marka/izlenmeler", label: "İzlenmeler" },
  { href: "/marka/postlar", label: "Postlar" },
  { href: "/marka/affiliate", label: "Affiliate" },
  // Ekip & personel
  { href: "/marka/personel", label: "Personel", cap: "hr" },
  { href: "/marka/takip", label: "Görev & Takip", cap: "hr" },
  { href: "/marka/crm", label: "CRM", cap: "crm" },
  // Finans & hesap
  { href: "/marka/muhasebe", label: "Muhasebe", cap: "finance" },
  { href: "/marka/faturalar", label: "Faturalar", cap: "finance" },
  { href: "/marka/odemeler", label: "Ödeme planı" },
  // Yönetim & hesap
  { href: "/marka/ekip", label: "Ekip & yetkiler", cap: "team" },
  { href: "/marka/profil", label: "Marka profili" },
  { href: "/marka/bildirimler", label: "Bildirimler" },
];

export function MarkaSubnav() {
  const pathname = usePathname();
  const { user, month, isAdminView, brandId, brand } = useMarkaPortal();
  // Admin marka görünümünde tüm modülleri görür; marka kullanıcısı org rolüne göre.
  const orgRole = isAdminView ? "admin" : user?.orgRole;
  const navItems = NAV.filter((item) => !item.cap || clientHasOrgCapability(orgRole, item.cap));

  return (
    <nav
      aria-label="Marka paneli"
      className="sticky top-0 z-40 mb-4 border-b border-border/70 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-1 py-2.5 sm:py-3">
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
        <div className="flex gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const href = markaHref(item.href, month);
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
