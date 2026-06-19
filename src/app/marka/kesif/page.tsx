"use client";

import { Sparkles } from "lucide-react";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { SocialDiscoveryPanel } from "@/components/social-discovery-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { PLATFORM_DISCOVERY_MODES } from "@/lib/social-discovery-options";

const TOTAL_DISCOVERY_MODES =
  PLATFORM_DISCOVERY_MODES.youtube.length +
  PLATFORM_DISCOVERY_MODES.instagram.length +
  PLATFORM_DISCOVERY_MODES.tiktok.length;

export default function MarkaKesifPage() {
  const { user, brandId, brand, canViewBrand } = useMarkaPortal();

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto w-full max-w-[960px] px-2 pb-6 sm:px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles size={18} className="text-violet-600 dark:text-violet-300" />
              Premium keşif
            </CardTitle>
            <CardDescription>
              YouTube, Instagram ve TikTok için {TOTAL_DISCOVERY_MODES} keşif modu —
              trend, arama, profil, hashtag, challenge, video/kanal detayı, hikaye, takipçi ve daha fazlası.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SocialDiscoveryPanel />
          </CardContent>
        </Card>
      </div>
    </MarkaPageGuard>
  );
}
