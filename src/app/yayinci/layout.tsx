"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";

const NAV: { href: string; label: string; match: string }[] = [
  { href: "/yayinci/maas",           label: "Maaş",            match: "maas" },
  { href: "/yayinci/harcamalar",     label: "Harcamalar",      match: "harcamalar" },
  { href: "/yayinci/takvim",         label: "Haftalık plan",   match: "takvim" },
  { href: "/yayinci/izlenmeler",     label: "İzlenmeler",      match: "izlenmeler" },
  { href: "/yayinci/hesaplar",       label: "Hesaplar",        match: "hesaplar" },
  { href: "/yayinci/marka-linkleri", label: "Marka linkleri",  match: "marka-linkleri" },
  { href: "/yayinci/gecmis",         label: "Geçmiş aylar",    match: "gecmis" },
];

export default function YayinciLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const contentExpenses = useStore((s) => s.contentExpenses);
  const employees      = useStore((s) => s.employees);
  const me             = employees.find((e) => e.id === user?.employeeId);
  const pendingCount   = me
    ? contentExpenses.filter((e) => e.employeeId === me.id && e.reviewStatus === "pending").length
    : 0;

  return (
    <div className="w-full min-w-0">
      <nav
        aria-label="Yayıncı bölümleri"
        className="-mx-3 mb-3 border-b border-border/70 bg-background/95 sm:-mx-6 md:-mx-8 lg:-mx-10"
      >
        <div className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-3 py-2.5 sm:px-6 md:px-8 lg:px-10">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showDot = item.match === "harcamalar" && pendingCount > 0;
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
                    {pendingCount > 9 ? "9+" : pendingCount}
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
