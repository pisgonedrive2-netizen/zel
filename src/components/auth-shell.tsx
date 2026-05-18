"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, canAccess, landingFor } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { useSidebar } from "@/store/sidebar";
import { PanelViewBanner } from "@/components/panel-view-banner";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import Sidebar from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, Menu, X } from "lucide-react";

/**
 * Tüm uygulamayı saran kabuk:
 *  - Zustand persist hidratasyonu bittikten sonra çalışır.
 *  - /login ekranı için sidebar göstermez.
 *  - Yetkisiz kullanıcıyı login'e veya kendi landing sayfasına yönlendirir.
 *  - Yayıncı, admin rotalarına ulaşmak isterse /yayinci'ya yönlendirilir.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const router   = useRouter();
  const pathname = usePathname();

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isSupabaseClientMode()) {
      setHydrated(true);
      return;
    }
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { user: typeof user }) => {
        if (data.user) useAuth.setState({ user: data.user });
      })
      .finally(() => setHydrated(true));
  }, []);

  // Yönlendirme mantığı
  useEffect(() => {
    if (!hydrated) return;

    // Login ekranındaysa ve kullanıcı varsa → kendi landing'e
    if (pathname === "/login" && user) {
      router.replace(landingFor(user.role));
      return;
    }

    // Login ekranı dışında ve kullanıcı yoksa → login
    if (pathname !== "/login" && !user) {
      router.replace("/login");
      return;
    }

    // Erişim yetkisi yoksa kendi landing'e
    if (user && !canAccess(pathname, user.role, panelViewAs)) {
      router.replace(landingFor(user.role));
    }
  }, [hydrated, user, pathname, router, panelViewAs]);

  // Yükleniyor
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Login ekranı (sidebar yok)
  if (pathname === "/login") {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    );
  }

  // Kullanıcı yoksa boş — yönlendirme gerçekleşene kadar
  if (!user) return null;

  // Yetkisi yoksa boş — yönlendirme gerçekleşene kadar
  if (!canAccess(pathname, user.role, panelViewAs)) return null;

  // Normal kabuk: sidebar + main (arada boşluk)
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden md:gap-5 lg:gap-6 xl:gap-8">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background px-3 pt-1.5 pb-4 sm:px-6 sm:pt-2 md:px-8 md:pt-2.5 lg:px-10">
        <div className="sticky top-0 z-30 -mx-3 mb-2 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-1.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6 sm:py-1.5 md:-mx-8 md:justify-end md:px-8 lg:-mx-10 lg:px-10">
          <MobileSidebarTrigger />
          <ThemeToggle variant="icon" />
        </div>
        {pathname.startsWith("/yayinci") && <PanelViewBanner />}
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </main>
    </div>
  );
}

function MobileSidebarTrigger() {
  const open = useSidebar((s) => s.open);
  const toggleOpen = useSidebar((s) => s.toggleOpen);
  return (
    <button
      type="button"
      onClick={toggleOpen}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
      aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
    >
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
  );
}
