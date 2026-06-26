"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Uyumluluk modülü marka panelinden kaldırıldı.
 * Doğrudan URL ile gelinirse marka anasayfasına yönlendirilir.
 */
export default function MarkaUyumlulukPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/marka/anasayfa");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Yönlendiriliyor…
    </div>
  );
}
