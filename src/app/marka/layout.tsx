"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/store/auth";
import { MarkaSubnav } from "@/components/marka-subnav";
import { MarkaOnboardingGate } from "@/components/marka-onboarding-gate";
import { clientIsReadOnly } from "@/lib/org-capability";
import { orgRoleLabel } from "@/lib/org-roles";

export default function MarkaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const readOnly = user?.role === "brand" && clientIsReadOnly(user?.orgRole);

  // Onboarding sayfasında subnav gösterme (tam ekran sihirbaz).
  if (pathname.startsWith("/marka/onboarding")) {
    return (
      <div className="w-full min-w-0">
        <MarkaOnboardingGate />
        {children}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <MarkaOnboardingGate />
      {user?.role === "brand" && pathname.startsWith("/marka/operasyon") && (
        <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-500/40 dark:bg-violet-950/35 px-4 py-2 text-xs text-violet-900 dark:text-violet-100">
          <strong>Marka hesabı:</strong> Bu ay kayıt olan üye, yatırım yapan üye ve tutarları{" "}
          <strong>Operasyon özeti</strong> formundan girip kaydedebilirsiniz. Veriler yöneticiyle senkron olur.
        </div>
      )}
      <MarkaSubnav />
      {readOnly && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-[11px] font-medium text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-950/35 dark:text-indigo-100">
          <ShieldCheck size={14} className="shrink-0" />
          <span>
            <strong>{orgRoleLabel(user?.orgRole)} · salt-okunur</strong> — bu hesap tüm verileri görüntüler, değiştiremez.
          </span>
        </div>
      )}
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Yükleniyor…</div>}>
        {children}
      </Suspense>
    </div>
  );
}
