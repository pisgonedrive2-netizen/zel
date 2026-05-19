"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabelTr } from "@/hooks/use-marka-portal";

export function MarkaMonthNav({
  month,
  onPrev,
  onNext,
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-1 flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/95 py-2.5 backdrop-blur-sm">
      <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 w-8 p-0" type="button" title="Önceki ay">
        <ChevronLeft size={14} />
      </Button>
      <div className="min-w-[140px] rounded-md border border-border bg-card px-3 py-1.5 text-center text-sm font-medium capitalize">
        {monthLabelTr(month)}
      </div>
      <Button variant="ghost" size="sm" onClick={onNext} className="h-8 w-8 p-0" type="button" title="Sonraki ay">
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}
