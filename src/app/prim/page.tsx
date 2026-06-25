"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { canAccessPrim } from "@/lib/user-guards";
import { PageShell } from "@/components/page-shell";
import { PrimPoolPanel } from "@/components/prim/prim-pool-panel";

export default function PrimPage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = canAccessPrim(user);

  useEffect(() => {
    if (user && !allowed) {
      router.replace("/ozet");
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
