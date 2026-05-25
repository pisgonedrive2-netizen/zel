"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/store/auth";
import { MarkaSubnav } from "@/components/marka-subnav";

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
      <MarkaSubnav />
      {children}
    </div>
  );
}
