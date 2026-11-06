"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuditLog, type AuditAction, type AuditEntry } from "@/store/audit-log";

const ACTION_LABEL: Record<AuditAction, string> = {
  user_created: "Kullanıcı eklendi",
  user_updated: "Kullanıcı güncellendi",
  user_deleted: "Kullanıcı silindi",
  user_pin_reset: "PIN sıfırlandı",
  expense_approved: "Harcama onaylandı",
  expense_rejected: "Harcama reddedildi",
  expense_needs_info: "Harcama · ek bilgi",
  expense_settlement: "Harcama ödeme yolu",
  expense_month_lock: "Harcama ay kilidi",
  backup_exported: "Yedek indirildi",
  backup_imported: "Yedek içe aktarıldı",
  user_impersonated: "Hesaba girildi",
  user_impersonation_stopped: "Denetimden çıkıldı",
  session_idle_logout: "Hareketsizlik çıkışı",
  screen_share_toggled: "Gizli mod",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

function snippet(detail: string, max = 80): string {
  const t = detail.trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function actionLabel(entry: AuditEntry): string {
  return ACTION_LABEL[entry.action] ?? entry.action;
}

export function OrkunAdminFeed() {
  const entries = useAuditLog((s) => s.entries);

  const rows = useMemo(() => entries.slice(0, 40), [entries]);

  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="px-4 pb-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Activity className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Canlı işlem günlüğü</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            Son {rows.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Tüm admin işlemleri — en yeni üstte (en fazla 40 kayıt).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
            <p className="text-sm text-foreground font-medium">Henüz kayıt yok</p>
            <p className="text-xs text-muted-foreground mt-1">
              Kullanıcı, harcama veya güvenlik işlemleri burada görünür.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Zaman</th>
                  <th className="px-3 py-2 font-medium">Aktör</th>
                  <th className="px-3 py-2 font-medium">İşlem</th>
                  <th className="px-3 py-2 font-medium">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {rows.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatTime(e.at)}
                    </td>
                    <td className="px-3 py-2 text-foreground">{e.actorName}</td>
                    <td className="px-3 py-2 text-foreground">{actionLabel(e)}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[24rem] break-words">
                      {snippet(e.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
