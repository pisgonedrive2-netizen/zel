"use client";

import { useState } from "react";
import { ChevronDown, Crown, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ALL_ORG_CAPABILITIES,
  MAIN_ADMIN_PRIVILEGE_GROUPS,
} from "@/lib/main-admin-privileges";
import { ORG_ROLE_LABELS } from "@/lib/org-roles";
import { cn } from "@/lib/utils";

const CAP_LABELS: Record<(typeof ALL_ORG_CAPABILITIES)[number], string> = {
  finance: "Finans (muhasebe, fatura, bordro)",
  hr: "İnsan kaynakları (personel, departman, takip)",
  crm: "CRM & lead yönetimi",
  team: "Ekip & yetki yönetimi",
  compliance: "Uyumluluk & regülasyon",
  affiliate_api: "Affiliate API & entegrasyon",
  streamer_contracts: "Yayıncı sözleşmeleri",
  bonus_ops: "Kampanya & bonus operasyonları",
};

export function MainAdminPrivilegesCard({ className }: { className?: string }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MAIN_ADMIN_PRIVILEGE_GROUPS.map((g) => [g.id, true]))
  );

  const totalItems = MAIN_ADMIN_PRIVILEGE_GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50/90 via-card to-violet-50/50 p-4 shadow-sm dark:border-blue-500/35 dark:from-blue-950/30 dark:via-card dark:to-violet-950/20",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Crown size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Orkun — tam platform yetkileri</h3>
              <Badge className="text-[10px] gap-1 bg-blue-600 hover:bg-blue-600">
                <ShieldCheck size={10} /> Ana yönetici
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Tüm ajans modülleri, tüm markalar ({ORG_ROLE_LABELS.owner} org rolü), RapidAPI keşif,
              kullanıcı yönetimi ve sistem endpoint&apos;leri — {totalItems} ayrı yetki kalemi aktif.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_ORG_CAPABILITIES.map((cap) => (
            <Badge key={cap} variant="outline" className="text-[9px] font-mono">
              {cap}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {MAIN_ADMIN_PRIVILEGE_GROUPS.map((group) => {
          const expanded = openGroups[group.id] ?? false;
          return (
            <div key={group.id} className="rounded-lg border border-border/70 bg-background/60 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [group.id]: !expanded }))
                }
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{group.title}</p>
                  <p className="text-[10px] text-muted-foreground">{group.description}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                />
              </button>
              {expanded && (
                <ul className="border-t border-border/60 divide-y divide-border/40">
                  {group.items.map((item) => (
                    <li key={item.key} className="px-3 py-2">
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Org modül anahtarları:{" "}
        {ALL_ORG_CAPABILITIES.map((c) => CAP_LABELS[c]).join(" · ")}
      </p>
    </div>
  );
}
