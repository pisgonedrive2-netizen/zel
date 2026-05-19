"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Brand } from "@/store/store";
import type { AppUser } from "@/store/auth";

export function MarkaPageGuard({
  user,
  canViewBrand,
  brandId,
  brand,
  children,
}: {
  user: AppUser | null;
  canViewBrand: boolean;
  brandId: string | undefined;
  brand: Brand | undefined;
  children: React.ReactNode;
}) {
  if (!user || !canViewBrand) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <Lock className="text-muted-foreground" size={28} />
        <p className="text-sm text-muted-foreground">Bu sayfa yalnızca marka hesapları içindir.</p>
      </div>
    );
  }

  if (!brandId || !brand) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Marka atanmamış</CardTitle>
          <CardDescription>
            Hesabınıza marka bağlı değil. Yönetici{" "}
            <Link href="/kullanicilar" className="text-primary underline">
              Kullanıcılar
            </Link>{" "}
            sayfasından <strong>Marka</strong> rolü ve marka seçimi atamalıdır.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <>{children}</>;
}
