"use client";

import { useRouter, usePathname } from "next/navigation";
import { ExternalLink, X } from "lucide-react";
import { usePanelView } from "@/store/panel-view";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";

/** Admin yayıncı panelini görüntürürken üst şerit. */
export function PanelViewBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const exitStreamerPanel = usePanelView((s) => s.exitStreamerPanel);

  if (user?.role !== "admin" || !panelViewAs) return null;

  const onExit = () => {
    exitStreamerPanel();
    if (pathname.startsWith("/yayinci")) {
      router.push("/maaslar");
    }
  };

  return (
    <div className="sticky top-0 z-40 -mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-violet-300/60 bg-violet-50/95 px-5 py-2 backdrop-blur-md dark:border-violet-500/40 dark:bg-violet-950/90 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10">
      <div className="flex items-center gap-2 min-w-0">
        <ExternalLink size={14} className="text-violet-700 dark:text-violet-300 shrink-0" />
        <p className="text-xs sm:text-sm text-violet-950 dark:text-violet-100">
          <span className="font-semibold">{panelViewAs.employeeName}</span>
          <span className="text-violet-800/80 dark:text-violet-200/80"> yayıncı paneli · yönetici görünümü</span>
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={onExit}>
        <X size={12} />
        Yönetici paneline dön
      </Button>
    </div>
  );
}
