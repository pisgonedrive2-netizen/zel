"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestViewershipReload } from "@/lib/viewership-reload";

export function ViewershipReloadBanner({
  snapshotCount,
  linkCount,
  viewMonth,
}: {
  snapshotCount: number;
  linkCount: number;
  viewMonth: string;
}) {
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);
  const filledLinks = linkCount;
  const noLinks = filledLinks === 0;
  const missingSnapshots = snapshotCount === 0 && filledLinks > 0;
  const needsRestore = noLinks || missingSnapshots;

  useEffect(() => {
    if (!needsRestore || autoTried.current) return;
    autoTried.current = true;
    requestViewershipReload();
  }, [needsRestore]);

  if (!needsRestore) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <div className="flex flex-wrap items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {noLinks
              ? "Link ve izlenme verileri yüklenemedi"
              : "İzlenme sayıları ekranda görünmüyor"}
          </p>
          <p className="mt-1 text-xs opacity-90">
            Veritabanındaki kayıtlar silinmez; bu oturumda veri henüz gelmemiş olabilir.
            {viewMonth ? ` Seçili ay: ${viewMonth}.` : ""} Otomatik yenileme denendi — hâlâ
            boşsa düğmeyle sunucudan (veya son yerel yedekten) geri yükleyin.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-400/60"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            requestViewershipReload();
            window.setTimeout(() => setBusy(false), 4000);
          }}
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
          Verileri geri yükle
        </Button>
      </div>
    </div>
  );
}
