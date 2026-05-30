"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";

/**
 * Yeni kayıt olan (onboarding tamamlanmamış) marka kullanıcısını ilk girişte
 * onboarding sihirbazına yönlendirir. Dahili ajans markaları (onboardingCompleted=true)
 * etkilenmez.
 */
export function MarkaOnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const organizations = useStore((s) => s.organizations);

  useEffect(() => {
    if (user?.role !== "brand") return;
    if (!user.organizationId) return;
    if (pathname.startsWith("/marka/onboarding")) return;
    const org = organizations.find((o) => o.id === user.organizationId);
    if (org && !org.onboardingCompleted) {
      router.replace("/marka/onboarding");
    }
  }, [user, organizations, pathname, router]);

  return null;
}
