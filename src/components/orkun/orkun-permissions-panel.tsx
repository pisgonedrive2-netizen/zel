"use client";

import { useMemo } from "react";
import Link from "next/link";
import { KeyRound, Shield, ArrowUpRight, History } from "lucide-react";
import {
  CAPABILITY_CATALOG,
  ORKUN_ONLY_CAPABILITIES,
} from "@/lib/permissions";
import { MAIN_ADMIN_PRIVILEGE_GROUPS } from "@/lib/main-admin-privileges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuditLog, type AuditEntry } from "@/store/audit-log";

const PERM_RE = /permission|yetki|capability/i;

function isPermissionChange(entry: AuditEntry): boolean {
  if (entry.action === "user_updated") return true;
  return PERM_RE.test(`${entry.action} ${entry.detail}`);
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

export function OrkunPermissionsPanel() {
  const hardOnly = CAPABILITY_CATALOG.filter((c) =>
    ORKUN_ONLY_CAPABILITIES.has(c.key),
  );
  const entries = useAuditLog((s) => s.entries);
  const permRows = useMemo(
    () => entries.filter(isPermissionChange).slice(0, 30),
    [entries],
  );

  return (
    <div id="permissions" className="space-y-4">
      <Card className="gap-3 py-4 shadow-none">
        <CardHeader className="px-4 pb-0 space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Hard Orkun yetkileri</CardTitle>
            <Badge variant="outline" className="ml-auto">
              Verilemez
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Bu yetkiler başka admin’e capability override ile açılamaz — yalnızca canlı Orkun
            oturumu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <ul className="space-y-2">
            {hardOnly.map((c) => (
              <li
                key={c.key}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.label}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {c.key}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4 shadow-none">
        <CardHeader className="px-4 pb-0 space-y-1">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Platform ayrıcalık grupları</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {MAIN_ADMIN_PRIVILEGE_GROUPS.length} grup
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Diğer kullanıcıların yetkilerini{" "}
            <Link href="/kullanicilar" className="underline underline-offset-2">
              Kullanıcılar
            </Link>{" "}
            sayfasından yönetirsin.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          {MAIN_ADMIN_PRIVILEGE_GROUPS.map((g) => (
            <div
              key={g.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{g.title}</p>
                <p className="text-xs text-muted-foreground">{g.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {g.items.length}
              </Badge>
            </div>
          ))}
          <Link
            href="/kullanicilar"
            className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline underline-offset-2 pt-1"
          >
            Kullanıcı / yetki editörüne git
            <ArrowUpRight className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4 shadow-none">
        <CardHeader className="px-4 pb-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <History className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Yetki değişiklikleri</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              Son {permRows.length}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Kullanıcı güncellemeleri ve yetki/permission ile ilgili son 30 kayıt.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {permRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
              <p className="text-sm text-foreground font-medium">
                Henüz yetki değişikliği yok
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Kullanıcılar sayfasından yetki düzenlendiğinde burada görünür.
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
                  {permRows.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatTime(e.at)}
                      </td>
                      <td className="px-3 py-2 text-foreground">{e.actorName}</td>
                      <td className="px-3 py-2 text-foreground">
                        {e.action === "user_updated"
                          ? "Kullanıcı güncellendi"
                          : e.action}
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
    </div>
  );
}
