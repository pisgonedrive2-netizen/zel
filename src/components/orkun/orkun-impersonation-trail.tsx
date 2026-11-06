"use client";

import { useMemo } from "react";
import { UserCog } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuditLog, type AuditEntry } from "@/store/audit-log";

const IMPERSONATION_ACTIONS = new Set([
  "user_impersonated",
  "user_impersonation_stopped",
]);

const ACTION_LABEL: Record<string, string> = {
  user_impersonated: "Hesaba girildi (denetim)",
  user_impersonation_stopped: "Denetimden çıkıldı",
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

function isImpersonationEntry(entry: AuditEntry): boolean {
  return IMPERSONATION_ACTIONS.has(entry.action);
}

export function OrkunImpersonationTrail() {
  const entries = useAuditLog((s) => s.entries);

  const rows = useMemo(
    () => entries.filter(isImpersonationEntry).slice(0, 40),
    [entries],
  );

  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="px-4 pb-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <UserCog className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Hesaba giriş izi</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            Son {rows.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Yalnızca denetim (impersonation) giriş/çıkış kayıtları — en fazla 40.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
            <p className="text-sm text-foreground font-medium">
              Henüz hesaba giriş kaydı yok
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Kullanıcılar sayfasından bir hesaba girdiğinde burada görünür.
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
                    <td className="px-3 py-2 text-foreground">
                      {ACTION_LABEL[e.action] ?? e.action}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[28rem] break-words">
                      {e.detail || "—"}
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
