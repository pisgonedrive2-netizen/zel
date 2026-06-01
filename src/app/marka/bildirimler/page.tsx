"use client";

import { useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/fmt-date";
import { Bell, CheckCheck, Filter, Inbox, Trash2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useStore, unreadNotificationCount, visibleNotificationsForRole, type AppNotification } from "@/store/store";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import {
  markAllNotificationsReadPersisted,
  markNotificationReadPersisted,
  deleteNotificationPersisted,
} from "@/lib/notification-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  api_refresh_alert:  "API izlenme uyarısı",
  general:            "Genel duyuru",
};

const TYPE_ACCENT: Partial<Record<AppNotification["type"], string>> = {
  brand_payment_reminder: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
  schedule_updated: "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
  general: "text-violet-700 border-violet-300 bg-violet-50 dark:text-violet-300 dark:border-violet-500/45 dark:bg-violet-950/40",
};

export default function MarkaBildirimlerPage() {
  const { users } = useAuth();
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand, isAdminView } = portal;
  const { notifications } = useStore();
  const [showRead, setShowRead] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"" | AppNotification["type"]>("");

  // Admin impersonation modunda asıl marka kullanıcısının bildirimlerini filtreliyoruz;
  // gerçek brand rolünde ise oturumdaki kullanıcının kendi bildirimleri.
  const targetUserId = useMemo(() => {
    if (!user) return null;
    if (user.role === "brand") return user.id;
    if (user.role === "admin" && brandId) {
      const linked = users.find((u) => u.role === "brand" && u.brandId === brandId);
      return linked?.id ?? null;
    }
    return null;
  }, [user, users, brandId]);

  const myNotifications = useMemo(() => {
    if (!targetUserId) return [];
    return visibleNotificationsForRole(notifications, "brand", targetUserId, brandId ? [brandId] : undefined);
  }, [notifications, targetUserId, brandId]);

  const filtered = useMemo(() => {
    return myNotifications.filter((n) => {
      if (!showRead && n.read) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      return true;
    });
  }, [myNotifications, showRead, typeFilter]);

  const unread = targetUserId
    ? unreadNotificationCount(notifications, "brand", targetUserId, brandId ? [brandId] : undefined)
    : 0;
  const totalForRole = myNotifications.length;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
    <div className="mx-auto max-w-[1100px] space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BrandLogo brandId={brand.id} title={brand.name} size={40} className="rounded-lg shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Bell size={18} /> {brand.name} · Bildirimler
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdminView
                ? "Marka hesabı adına bildirimler — yönetici görünümü."
                : "Ödeme hatırlatmaları, takvim ve içerik bildirimleri."}
            </p>
          </div>
        </div>
        {unread > 0 && targetUserId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void markAllNotificationsReadPersisted("brand", targetUserId)}
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
          label="Marka"
          value={brand.shortName || brand.name}
          icon={Filter}
          accent="text-violet-700 dark:text-violet-300"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <label htmlFor="notif-type-filter" className="text-muted-foreground">Tür:</label>
        <select
          id="notif-type-filter"
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
                        {fmtDateTime(n.createdAt)}
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
      )}
    </MarkaPageGuard>
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
