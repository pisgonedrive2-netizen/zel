"use client";

import { useRouter, usePathname } from "next/navigation";
import { ExternalLink, Tag, X } from "lucide-react";
import { usePanelView } from "@/store/panel-view";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";

/** Admin yayıncı veya marka panelini görüntürürken üst şerit. */
export function PanelViewBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const exitStreamerPanel = usePanelView((s) => s.exitStreamerPanel);
  const exitBrandPanel = usePanelView((s) => s.exitBrandPanel);

  if (user?.role !== "admin") return null;

  if (panelViewAs) {
    const onExit = () => {
      exitStreamerPanel();
      if (pathname.startsWith("/yayinci")) {
        router.push("/maaslar");
      }
    };
    return (
      <Banner
        accent="violet"
        icon={<ExternalLink size={14} className="text-violet-700 dark:text-violet-300 shrink-0" />}
        title={panelViewAs.employeeName}
        subtitle="yayıncı paneli · yönetici görünümü"
        onExit={onExit}
      />
    );
  }

  if (brandViewAs) {
    const onExit = () => {
      exitBrandPanel();
      if (pathname.startsWith("/marka")) {
        router.push("/izlenme");
      }
    };
    return (
      <Banner
        accent="amber"
        icon={<Tag size={14} className="text-amber-700 dark:text-amber-300 shrink-0" />}
        title={brandViewAs.brandName}
        subtitle="marka paneli · yönetici görünümü"
        onExit={onExit}
      />
    );
  }

  return null;
}

function Banner({
  accent,
  icon,
  title,
  subtitle,
  onExit,
}: {
  accent: "violet" | "amber";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onExit: () => void;
}) {
  const cls =
    accent === "violet"
      ? "border-violet-300/60 bg-violet-50/95 dark:border-violet-500/40 dark:bg-violet-950/90"
      : "border-amber-300/60 bg-amber-50/95 dark:border-amber-500/40 dark:bg-amber-950/90";
  const textCls =
    accent === "violet"
      ? "text-violet-950 dark:text-violet-100"
      : "text-amber-950 dark:text-amber-100";
  const subCls =
    accent === "violet"
      ? "text-violet-800/80 dark:text-violet-200/80"
      : "text-amber-800/80 dark:text-amber-200/80";
  return (
    <div
      className={`sticky top-0 z-40 -mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 border-b backdrop-blur-md px-5 py-2 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 ${cls}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <p className={`text-xs sm:text-sm ${textCls}`}>
          <span className="font-semibold">{title}</span>
          <span className={subCls}> {subtitle}</span>
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={onExit}>
        <X size={12} />
        Yönetici paneline dön
      </Button>
    </div>
  );
}
