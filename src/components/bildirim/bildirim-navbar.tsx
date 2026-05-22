"use client";

import {
  Bell, Inbox, Megaphone, Settings, SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BildirimTab = "akis" | "gonder" | "ayarlar" | "tercihler";

const TABS: { id: BildirimTab; label: string; icon: typeof Inbox; elevatedOnly?: boolean }[] = [
  { id: "akis", label: "Akış", icon: Inbox },
  { id: "gonder", label: "Gönder", icon: Megaphone, elevatedOnly: true },
  { id: "ayarlar", label: "Ayarlar", icon: Settings },
  { id: "tercihler", label: "Tercihler", icon: SlidersHorizontal },
];

export interface BildirimNavbarProps {
  activeTab: BildirimTab;
  onTabChange: (tab: BildirimTab) => void;
  total: number;
  unread: number;
  canCompose: boolean;
  trailing?: React.ReactNode;
}

export function BildirimNavbar({
  activeTab,
  onTabChange,
  total,
  unread,
  canCompose,
  trailing,
}: BildirimNavbarProps) {
  const visibleTabs = TABS.filter((t) => !t.elevatedOnly || canCompose);

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2 mb-3 bg-background/95 backdrop-blur-md border border-border/60 rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Bell size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Bildirim Merkezi</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {total} kayıt · {unread} okunmamış
            </p>
          </div>
          {unread > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:bg-amber-950/30"
            >
              {unread} yeni
            </Badge>
          )}
        </div>
        {trailing}
      </div>

      <nav
        className="flex items-center gap-0.5 overflow-x-auto pb-0.5 -mb-0.5 scrollbar-none"
        aria-label="Bildirim bölümleri"
      >
        {visibleTabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onTabChange(id);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", id);
                  window.history.replaceState(null, "", url.pathname + url.search);
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** URL ?tab= ile sekme oku */
export function bildirimTabFromSearch(
  search: string,
  canCompose: boolean
): BildirimTab {
  const t = new URLSearchParams(search).get("tab");
  if (t === "gonder" && canCompose) return "gonder";
  if (t === "ayarlar") return "ayarlar";
  if (t === "tercihler") return "tercihler";
  return "akis";
}
