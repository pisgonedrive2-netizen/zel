"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Upload, FileJson } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseLanetkelBackup } from "@/lib/app-backup";
import { syncImportedUsersToServer } from "@/lib/users-sync";
import { mergeUsersWithPinCache } from "@/lib/admin-pin-cache";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { useStore } from "@/store/store";
import { useAuth, type AppUser } from "@/store/auth";
import { logAudit } from "@/store/audit-log";

/**
 * Orkun Yedek sekmesi — JSON yedek geri yükleme.
 * Tam akış Kullanıcılar sayfasındakinin aynısı; buradan da dosya seçilebilir.
 */
export function OrkunBackupRestoreCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrateFromBackup = useStore((s) => s.hydrateFromBackup);
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabaseMode = isSupabaseClientMode();

  const refreshUsers = async () => {
    if (!supabaseMode) return;
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { users?: AppUser[] };
      if (!data.users) return;
      useAuth.setState({
        users: mergeUsersWithPinCache(data.users, useAuth.getState().users),
      });
    } catch {
      /* sessiz */
    }
  };

  const runImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        setBusy(true);
        setMessage(null);
        try {
          const raw = JSON.parse(String(reader.result));
          const parsed = parseLanetkelBackup(raw);
          if (!parsed) {
            setMessage("Yedek dosyası tanınmadı veya bozuk.");
            return;
          }
          if (
            !window.confirm(
              "Mevcut mali veri (maaş, kasa, harcamalar) bu yedekle değişecek. Kullanıcı listesi de yedektekilerle güncellenir. Devam edilsin mi?"
            )
          ) {
            return;
          }
          hydrateFromBackup(parsed.app);
          const cur = useAuth.getState().user;
          const nextUsers = parsed.auth.users;
          const row = cur ? nextUsers.find((u) => u.id === cur.id) : null;
          const mergedUser = row && cur ? { ...cur, ...row } : null;
          useAuth.setState({
            users: nextUsers,
            user: mergedUser?.active ? mergedUser : null,
          });
          if (supabaseMode) {
            try {
              await syncImportedUsersToServer(nextUsers);
              await refreshUsers();
            } catch (syncErr) {
              setMessage(
                `Yedek yüklendi; kullanıcılar sunucuya yazılamadı: ${
                  syncErr instanceof Error ? syncErr.message : "bilinmeyen hata"
                }`
              );
              return;
            }
          }
          logAudit({
            actorId: cur?.id ?? user?.id ?? "system",
            actorName: cur?.name ?? user?.name ?? "?",
            action: "backup_imported",
            detail: `Yedek zamanı: ${parsed.exportedAt} · orkun-panel`,
          });
          setMessage(
            supabaseMode
              ? "Yedek yüklendi ve Supabase ile senkronize edildi."
              : "Yedek yüklendi (yerel mod)."
          );
        } catch {
          setMessage("Dosya okunamadı.");
        } finally {
          setBusy(false);
        }
      })();
    };
    reader.readAsText(file);
  };

  return (
    <Card className="border-border/80 shadow-sm" id="backup-restore">
      <CardHeader className="pb-3">
        <CardTitle className="text-base inline-flex items-center gap-2">
          <FileJson className="size-4" />
          Yedek geri yükle
        </CardTitle>
        <CardDescription className="text-xs">
          FoxStream JSON yedeğini (`foxstream-yedek-…json`) buradan veya Kullanıcılar sayfasındaki
          yükle düğmesinden içe aktarın.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
          <li>Önce güncel bir yedek aldığınızdan emin olun.</li>
          <li>JSON dosyasını seçin — mali veri ve kullanıcı listesi değişir.</li>
          <li>Supabase modunda kullanıcılar sunucuya da yazılır.</li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) runImport(f);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            {busy ? "Yükleniyor…" : "JSON yedek yükle"}
          </Button>
          <Link
            href="/kullanicilar#backup"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <ExternalLink className="size-3.5" />
            Kullanıcılar · yedek
          </Link>
        </div>

        {message && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
