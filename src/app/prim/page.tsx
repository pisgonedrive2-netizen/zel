"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, landingFor } from "@/store/auth";
import { hasCapability } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { PrimPoolPanel } from "@/components/prim/prim-pool-panel";

export default function PrimPage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = hasCapability(user, "page.prim");

  useEffect(() => {
    if (user && !allowed) {
      router.replace(landingFor(user.role, user));
    }
  }, [user, allowed, router]);

  if (!user || !allowed) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground py-8 text-center">Yükleniyor…</p>
      </PageShell>
    );
  }

  return (
    <PageShell size="2xl">
      <PrimPoolPanel />
    </PageShell>
  );
}
