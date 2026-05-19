"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";

const NAV = [
  { href: "/marka/operasyon", label: "Operasyon özeti" },
  { href: "/marka/izlenmeler", label: "İzlenmeler" },
  { href: "/marka/takvim", label: "Yayıncı takvimi" },
  { href: "/marka/odemeler", label: "Ödeme planı" },
  { href: "/marka/bildirimler", label: "Bildirimler" },
] as const;

export default function MarkaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="w-full min-w-0">
      {user?.role === "brand" && pathname.startsWith("/marka/operasyon") && (
        <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-500/40 dark:bg-violet-950/35 px-4 py-2 text-xs text-violet-900 dark:text-violet-100">
          <strong>Marka hesabı:</strong> Bu ay kayıt olan üye, yatırım yapan üye ve tutarları{" "}
          <strong>Operasyon özeti</strong> formundan girip kaydedebilirsiniz. Veriler yöneticiyle senkron olur.
        </div>
      )}
      <nav
        aria-label="Marka paneli"
        className="sticky top-0 z-40 mb-4 border-b border-border/70 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
      >
        <div className="mx-auto flex max-w-[1200px] gap-2 overflow-x-auto px-1 py-2.5 sm:py-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
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
      </nav>
      {children}
    </div>
  );
}
