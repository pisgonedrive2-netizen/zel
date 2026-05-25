"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, canAccess, landingFor } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { useSidebar } from "@/store/sidebar";
import { PanelViewBanner } from "@/components/panel-view-banner";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import Sidebar from "@/components/sidebar";
import { FloatingTopControls } from "@/components/floating-top-controls";
import { ImpersonationChip } from "@/components/impersonation-chip";
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
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const router   = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isSupabaseClientMode()) {
      setHydrated(true);
      return;
    }
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { user: typeof user }) => {
        useAuth.setState({
          user: data.user ?? null,
          sessionReady: true,
        });
      })
      .catch(() => {
        useAuth.setState({ user: null, sessionReady: true });
      })
      .finally(() => setHydrated(true));
  }, []);

  // Yönlendirme mantığı
  useEffect(() => {
    if (!hydrated) return;

    // Login ekranındaysa ve kullanıcı varsa → kendi landing'e
    if (isLogin && user) {
      router.replace(landingFor(user.role));
      return;
    }

    // Login ekranı dışında ve kullanıcı yoksa → login
    if (!isLogin && !user) {
      router.replace("/login");
      return;
    }

    // Erişim yetkisi yoksa kendi landing'e
    if (user && !canAccess(pathname, user.role, panelViewAs, brandViewAs)) {
      router.replace(landingFor(user.role));
      return;
    }

    // Admin doğrudan /marka/* URL'sine impersonation olmadan gelirse → /izlenme
    if (
      user?.role === "admin" &&
      pathname.startsWith("/marka") &&
      !brandViewAs
    ) {
      router.replace("/izlenme");
      return;
    }
    // Admin doğrudan /yayinci/* URL'sine impersonation olmadan gelirse → /maaslar
    if (
      user?.role === "admin" &&
      pathname.startsWith("/yayinci") &&
      !panelViewAs
    ) {
      router.replace("/maaslar");
      return;
    }

  }, [hydrated, user, pathname, router, panelViewAs, brandViewAs, isLogin]);

  const canView =
    hydrated && user && !isLogin && canAccess(pathname, user.role, panelViewAs, brandViewAs);

  /** Tema + API çipi — içerikle çakışmasın diye üst/sağ boşluk */
  const floatingControlsInset =
    user &&
    (user.role === "admin" || user.role === "auditor") &&
    pathname !== "/login" &&
    pathname !== "/izlenme" &&
    !pathname.startsWith("/marka") &&
    !pathname.startsWith("/yayinci");

  return (
    <>
      {!isLogin && <FloatingTopControls />}
      {!isLogin && <ImpersonationChip />}

      {!hydrated && (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {hydrated && isLogin && (
        <main className="relative flex h-[100dvh] min-h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden bg-black">
          {children}
        </main>
      )}

      {hydrated && !isLogin && !user && null}

      {hydrated && !isLogin && user && !canAccess(pathname, user.role, panelViewAs, brandViewAs) && null}

      {canView && (
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden md:gap-5 lg:gap-6 xl:gap-8">
          <Sidebar />
          <main
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background px-2 pb-3 pt-12 sm:px-4 md:px-6 lg:px-8 max-md:pr-14 ${
              floatingControlsInset
                ? "md:pt-2 md:pr-[4.5rem] lg:pr-[5.5rem]"
                : "md:pt-1 md:pr-3 lg:pr-4"
            }`}
          >
            <MobileSidebarTrigger />
            {(pathname.startsWith("/yayinci") || pathname.startsWith("/marka")) && <PanelViewBanner />}
            <div className="min-h-0 min-w-0 flex-1">{children}</div>
          </main>
        </div>
      )}
    </>
  );
}

function MobileSidebarTrigger() {
  const open = useSidebar((s) => s.open);
  const toggleOpen = useSidebar((s) => s.toggleOpen);
  return (
    <button
      type="button"
      onClick={toggleOpen}
      className="fixed left-[max(env(safe-area-inset-left),12px)] top-[max(env(safe-area-inset-top),12px)] z-[60] inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/95 text-muted-foreground shadow-md backdrop-blur-sm transition hover:bg-accent hover:text-foreground md:hidden"
      aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
    >
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
  );
}
