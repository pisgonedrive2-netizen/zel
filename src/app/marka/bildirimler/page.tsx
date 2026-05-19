"use client";

import { useMemo, useState } from "react";
import { Bell, CheckCheck, Filter, Inbox, Trash2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { usePanelView, resolveBrandViewId } from "@/store/panel-view";
import { useStore, unreadNotificationCount, type AppNotification } from "@/store/store";
import {
  markAllNotificationsReadPersisted,
  markNotificationReadPersisted,
  deleteNotificationPersisted,
} from "@/lib/notification-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const TYPE_LABEL: Record<AppNotification["type"], string> = {
  expense_submitted:  "Harcama gönderildi",
  expense_approved:   "Harcama onaylandı",
  expense_rejected:   "Harcama reddedildi",
  expense_paid:       "Harcama ödendi",
  schedule_updated:   "Takvim güncellendi",
  advance_request:    "Avans talebi",
  kasa_low:           "Kasa düşük",
  payroll_reminder:   "Maaş hatırlatıcı",
  brand_payment_reminder: "Marka ödeme hatırlatıcı",
  password_reset_request: "Şifre sıfırlama talebi",
  account_registration_request: "Hesap kayıt talebi",
  general:            "Genel duyuru",
};

const TYPE_ACCENT: Partial<Record<AppNotification["type"], string>> = {
  brand_payment_reminder: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
  schedule_updated: "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
  general: "text-violet-700 border-violet-300 bg-violet-50 dark:text-violet-300 dark:border-violet-500/45 dark:bg-violet-950/40",
};

export default function MarkaBildirimlerPage() {
  const { user } = useAuth();
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const { notifications } = useStore();
  const [showRead, setShowRead] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"" | AppNotification["type"]>("");

  const brandId = resolveBrandViewId(user?.role, user?.brandId, brandViewAs);
  const isAllowed = user?.role === "brand" || (user?.role === "admin" && !!brandViewAs);

  const myNotifications = useMemo(() => {
    if (!user) return [];
    return notifications.filter((n) => {
      if (n.forRole !== "brand") return false;
      if (n.forUserId && n.forUserId !== user.id) return false;
      return true;
    });
  }, [notifications, user]);

  const filtered = useMemo(() => {
    return myNotifications.filter((n) => {
      if (!showRead && n.read) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      return true;
    });
  }, [myNotifications, showRead, typeFilter]);

  const unread = user
    ? unreadNotificationCount(notifications, "brand", user.id)
    : 0;
  const totalForRole = myNotifications.length;

  if (!user || !isAllowed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <Lock className="text-muted-foreground" size={28} />
        <p className="text-sm text-muted-foreground">Bu sayfa yalnızca marka hesapları içindir.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Bell size={18} /> Bildirimler
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {brandViewAs
              ? `${brandViewAs.brandName} markası adına bekleyen bildirimler — yönetici görünümü.`
              : "Ödeme hatırlatmaları, takvim ve içerik bildirimleri."}
          </p>
        </div>
        {unread > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void markAllNotificationsReadPersisted("brand", user.id)}
          >
            <CheckCheck size={14} /> Tümünü okundu işaretle ({unread})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          label="Toplam"
          value={String(totalForRole)}
          icon={Inbox}
          accent="text-foreground"
        />
        <KpiCard
          label="Okunmamış"
          value={String(unread)}
          icon={Bell}
          accent={unread > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}
        />
        <KpiCard
          label="Bağlı marka"
          value={brandId ? brandId.slice(0, 12) + "…" : "—"}
          icon={Filter}
          accent="text-violet-700 dark:text-violet-300"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <span className="text-muted-foreground">Tür:</span>
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
        >
          <option value="">Hepsi</option>
          {Object.entries(TYPE_LABEL).map(([t, label]) => (
            <option key={t} value={t}>
              {label}
            </option>
          ))}
        </select>
        <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showRead}
            onChange={(e) => setShowRead(e.target.checked)}
          />
          Okunmuş olanları göster
        </label>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bildirim akışı</CardTitle>
          <CardDescription>
            {filtered.length} kayıt gösteriliyor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 opacity-50" size={20} />
              Bildirim yok.
            </div>
          ) : (
            filtered.map((n) => {
              const typeCls =
                TYPE_ACCENT[n.type] ??
                "text-muted-foreground border-border bg-muted/30";
              return (
                <div
                  key={n.id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    n.read
                      ? "border-border bg-card"
                      : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className={`text-[10px] ${typeCls}`}>
                          {TYPE_LABEL[n.type]}
                        </Badge>
                        {!n.read && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            yeni
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">
                        {new Date(n.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => void markNotificationReadPersisted(n.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Okundu işaretle"
                        >
                          <CheckCheck size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteNotificationPersisted(n.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Sil"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon size={11} /> {label}
      </p>
      <p className={`text-2xl tabular-nums mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}
