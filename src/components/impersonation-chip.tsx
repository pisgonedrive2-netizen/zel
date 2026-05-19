"use client";

import { useRouter, usePathname } from "next/navigation";
import { Tag, UserCog, X } from "lucide-react";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";

/**
 * Global impersonation gösterge çipi.
 * Admin bir yayıncı/marka olarak görüntülerken, hangi sayfada olursa olsun
 * sağ üstte küçük bir chip görünür; tek tıkla impersonation'dan çıkılır.
 *
 * /marka veya /yayinci içindeyken sayfanın üst şeridi (PanelViewBanner)
 * zaten gösterildiği için çift göstermemek adına gizlenir.
 */
export function ImpersonationChip() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const exitStreamerPanel = usePanelView((s) => s.exitStreamerPanel);
  const exitBrandPanel = usePanelView((s) => s.exitBrandPanel);

  if (user?.role !== "admin") return null;
  if (!panelViewAs && !brandViewAs) return null;
  if (pathname.startsWith("/yayinci") || pathname.startsWith("/marka") || pathname === "/login") {
    return null;
  }

  if (panelViewAs) {
    return (
      <Chip
        accent="violet"
        icon={<UserCog size={12} />}
        label={`${panelViewAs.employeeName} · yayıncı paneli`}
        onResume={() => router.push("/yayinci/maas")}
        onExit={() => exitStreamerPanel()}
      />
    );
  }
  if (brandViewAs) {
    return (
      <Chip
        accent="amber"
        icon={<Tag size={12} />}
        label={`${brandViewAs.brandName} · marka paneli`}
        onResume={() => router.push("/marka/izlenmeler")}
        onExit={() => exitBrandPanel()}
      />
    );
  }
  return null;
}

function Chip({
  accent,
  icon,
  label,
  onResume,
  onExit,
}: {
  accent: "violet" | "amber";
  icon: React.ReactNode;
  label: string;
  onResume: () => void;
  onExit: () => void;
}) {
  const cls =
    accent === "violet"
      ? "border-violet-300/70 bg-violet-50/95 text-violet-900 dark:border-violet-500/50 dark:bg-violet-950/90 dark:text-violet-100"
      : "border-amber-300/70 bg-amber-50/95 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/90 dark:text-amber-100";
  return (
    <div
      className={`fixed left-1/2 top-[max(calc(env(safe-area-inset-top)+3.25rem),3.75rem)] z-[55] flex max-w-[min(calc(100vw-6rem),360px)] -translate-x-1/2 items-center gap-1 rounded-full border px-1.5 py-1 text-xs shadow-md backdrop-blur ${cls}`}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onResume}
        className="flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-black/5 dark:hover:bg-white/10"
        title="Panele geri dön"
      >
        {icon}
        <span className="truncate font-medium">{label}</span>
      </button>
      <button
        type="button"
        onClick={onExit}
        title="Yönetici paneline dön"
        aria-label="Yönetici paneline dön"
        className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
      >
        <X size={12} />
      </button>
    </div>
  );
}
