"use client";

import { useMemo } from "react";
import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuditLog, type AuditEntry } from "@/store/audit-log";

const SECURITY_RE =
  /impersonat|permission|backup|screen|gizli|yetki|denetim/i;

function isSecurityRelevant(entry: AuditEntry): boolean {
  return SECURITY_RE.test(`${entry.action} ${entry.detail}`);
}

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

const ACTION_LABEL: Record<string, string> = {
  user_impersonated: "Hesaba girildi",
  user_impersonation_stopped: "Denetimden çıkıldı",
  backup_exported: "Yedek indirildi",
  backup_imported: "Yedek içe aktarıldı",
  expense_month_lock: "Ay kilidi",
  user_updated: "Kullanıcı güncellendi",
  user_created: "Kullanıcı oluşturuldu",
  user_deleted: "Kullanıcı silindi",
  user_pin_reset: "PIN sıfırlandı",
  screen_share_toggled: "Gizli mod",
};

export function OrkunSecurityPanel() {
  const entries = useAuditLog((s) => s.entries);

  const rows = useMemo(
    () => entries.filter(isSecurityRelevant).slice(0, 50),
    [entries]
  );

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3 gap-2">
        <CardTitle className="text-base inline-flex items-center gap-2">
          <Shield className="size-4" />
          Güvenlik izi
        </CardTitle>
        <CardDescription className="text-xs">
          Impersonate, yedek, yetki ve gizli/ekran paylaşımı ile ilgili son
          kayıtlar. Gizli mod yalnızca Orkun’un sidebar’ından açılır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center space-y-1.5">
            <p className="text-sm text-foreground font-medium">
              Henüz güvenlik kaydı yok
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Hesaba giriş (impersonate), sistem yedeği, yetki değişiklikleri veya
              gizli mod kullanımı burada görünür. Kayıtlar yerel işlem
              günlüğünden okunur; boşsa henüz bu tür bir işlem yapılmamış
              demektir.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Zaman</th>
                  <th className="px-3 py-2 font-medium">Aktör</th>
                  <th className="px-3 py-2 font-medium">İşlem</th>
                  <th className="px-3 py-2 font-medium">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatTime(e.at)}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {e.actorName}
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        {e.actorId}
                      </span>
                    </td>
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
