"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Download, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/fmt-date";
import { isSupabaseClientMode } from "@/lib/supabase-client";

type BackupSnapshot = {
  id: string;
  createdAt: string;
  triggeredBy: "cron" | "manual";
  status: "success" | "partial" | "failed";
  totalRows: number;
  tableCount: number;
  durationMs?: number;
};

const STATUS_LABEL: Record<BackupSnapshot["status"], string> = {
  success: "Başarılı",
  partial: "Kısmen",
  failed: "Başarısız",
};

const STATUS_CLASS: Record<BackupSnapshot["status"], string> = {
  success: "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/40 dark:bg-green-950/30",
  partial: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-950/30",
  failed: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/40 dark:bg-red-950/30",
};

export function SystemBackupStatusCard({ compact }: { compact?: boolean }) {
  const supabaseMode = isSupabaseClientMode();
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!supabaseMode) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backup/history", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { snapshots?: BackupSnapshot[] };
      setSnapshots(data.snapshots ?? []);
    } finally {
      setLoading(false);
    }
  }, [supabaseMode]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const runPersistedBackup = async () => {
    setRunBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup/run", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        snapshot?: BackupSnapshot;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Yedekleme başarısız.");
        return;
      }
      setMessage("Yedek alındı ve veritabanına kaydedildi. Bildirim gönderildi.");
      await loadHistory();
    } catch {
      setMessage("Yedekleme sırasında ağ hatası.");
    } finally {
      setRunBusy(false);
    }
  };

  const downloadSnapshot = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/backup/snapshots/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `foxstream-sistem-yedegi-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Yedek indirilemedi.");
    }
  };

  if (!supabaseMode) return null;

  const latest = snapshots[0];

  return (
    <Card className={compact ? "gap-3 py-4" : undefined}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={15} className="text-green-600 dark:text-green-400" />
          Otomatik Sistem Yedekleri
        </CardTitle>
        <CardDescription>
          Günde 2 kez (02:00 ve 14:00) tam yedek alınır, veritabanında saklanır ve Orkun&apos;a bildirim gider.
          İş verileri senkronizasyonda toplu silinmez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void runPersistedBackup()}
            disabled={runBusy}
          >
            <HardDrive size={13} />
            {runBusy ? "Yedekleniyor…" : "Şimdi yedekle ve kaydet"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => void loadHistory()}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Yenile
          </Button>
        </div>

        {message && <p className="text-xs text-muted-foreground">{message}</p>}

        {latest ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Database size={13} className="text-muted-foreground" />
              <span className="font-medium">Son yedek:</span>
              <span>{fmtDateTime(latest.createdAt)}</span>
              <Badge variant="outline" className={STATUS_CLASS[latest.status]}>
                {STATUS_LABEL[latest.status]}
              </Badge>
              <Badge variant="outline">
                {latest.triggeredBy === "cron" ? "Otomatik" : "Manuel"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {latest.totalRows.toLocaleString("tr-TR")} satır · {latest.tableCount} tablo
              {latest.durationMs != null ? ` · ${(latest.durationMs / 1000).toFixed(1)} sn` : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {loading ? "Yedek geçmişi yükleniyor…" : "Henüz kayıtlı yedek yok — ilk cron veya manuel yedekten sonra görünür."}
          </p>
        )}

        {!compact && snapshots.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Son yedekler
            </p>
            {snapshots.slice(0, 8).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-medium">{fmtDateTime(s.createdAt)}</span>
                  <span className="text-muted-foreground ml-2">
                    {s.totalRows.toLocaleString("tr-TR")} satır
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 gap-1 shrink-0"
                  onClick={() => void downloadSnapshot(s.id)}
                >
                  <Download size={12} />
                  İndir
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
