"use client";

import { useMemo } from "react";
import { Handshake, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StreamerPoolCard } from "@/components/streamer-pool/streamer-pool-card";
import { streamerBrandRelation, type MarkaStoreSlice } from "@/lib/marka-brand-insights";
import { streamerLastShareDate } from "@/lib/marka-content-alerts";
import type { StreamerPoolProfile } from "@/store/store";

export function MarkaPoolCard({
  profile,
  brandId,
  monthYm,
  storeSlice,
  onOfferClick,
}: {
  profile: StreamerPoolProfile;
  brandId: string;
  monthYm: string;
  storeSlice: MarkaStoreSlice & { brandOffers?: import("@/store/store").BrandOffer[] };
  onOfferClick?: (p: StreamerPoolProfile) => void;
}) {
  const rel = useMemo(
    () => streamerBrandRelation(brandId, profile.employeeId, monthYm, storeSlice),
    [brandId, profile.employeeId, monthYm, storeSlice]
  );

  const lastShare = useMemo(
    () => streamerLastShareDate(brandId, profile.employeeId, storeSlice),
    [brandId, profile.employeeId, storeSlice]
  );

  return (
    <div className="flex h-full flex-col gap-1.5">
      <StreamerPoolCard profile={profile} onOfferClick={onOfferClick} />
      {(rel.offersActive > 0 || rel.dealsActive > 0 || rel.sharingDaysMonth > 0) && (
        <div className="flex flex-wrap gap-1 px-1">
          {rel.sharingDaysMonth > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 font-normal">
              <Sparkles size={9} className="text-emerald-600" />
              {rel.sharingDaysMonth} paylaşım günü
            </Badge>
          )}
          {rel.offersActive > 0 && (
            <Badge variant="outline" className="text-[9px] gap-0.5 font-normal">
              <MessageSquare size={9} />
              {rel.offersActive} teklif
            </Badge>
          )}
          {rel.dealsActive > 0 && (
            <Badge variant="outline" className="text-[9px] gap-0.5 font-normal border-green-500/40">
              <Handshake size={9} />
              {rel.dealsActive} anlaşma
            </Badge>
          )}
          {lastShare && (
            <Badge variant="secondary" className="text-[9px] font-normal text-muted-foreground">
              Son paylaşım: {lastShare}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
