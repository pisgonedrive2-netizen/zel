"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, Send, Trash2, Volume2, VolumeX, CheckCheck, RefreshCw,
  AlertCircle, Filter, Megaphone, Wallet, ShieldCheck, Settings,
  Calendar, Inbox, Loader2,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { useStore, unreadNotificationCount, type AppNotification } from "@/store/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, NumberInput } from "@/components/ui/field";
import { logAudit } from "@/store/audit-log";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import {
  refreshNotificationsFromServer,
  markNotificationReadPersisted,
  markAllNotificationsReadPersisted,
  deleteNotificationPersisted,
} from "@/lib/notification-actions";
import type { NotificationPref, NotificationPrefsMap } from "@/lib/notification-preferences";

type ForRole = "admin" | "auditor" | "streamer" | "brand";

const TYPE_LABEL: Record<AppNotification["type"], string> = {
  expense_submitted:  "Harcama gönderildi",
  expense_approved:   "Harcama onaylandı",
  expense_rejected:   "Harcama reddedildi",
  expense_paid:         "Harcama ödendi",
  schedule_updated:   "Takvim güncellendi",
  advance_request:    "Avans talebi",
  kasa_low:           "Kasa düşük",
  payroll_reminder:   "Maaş hatırlatıcı",
  brand_payment_reminder: "Marka ödeme hatırlatıcı",
  password_reset_request: "Şifre sıfırlama talebi",
  account_registration_request: "Hesap kayıt talebi",
  general:            "Genel duyuru",
};

const TYPES = Object.keys(TYPE_LABEL) as AppNotification["type"][];

const ROLE_LABEL: Record<ForRole, string> = {
  admin: "Yönetici",
  auditor: "Denetçi",
  streamer: "Yayıncı",
  brand: "Marka",
};

interface NotifSettings {
  "notifications.kasaLowThreshold": number;
  "notifications.payrollReminderEnabled": boolean;
  "notifications.payrollReminderDaysBefore": number;
  "notifications.silencedTypes": string[];
}

const DEFAULT_SETTINGS: NotifSettings = {
  "notifications.kasaLowThreshold": 5000,
  "notifications.payrollReminderEnabled": true,
  "notifications.payrollReminderDaysBefore": 3,
  "notifications.silencedTypes": [],
};

export default function NotificationsPage() {
  const { user, users } = useAuth();
  const {
    notifications,
    pushNotification,
  } = useStore();

  const isAdmin = user?.role === "admin";
  const isAuditor = user?.role === "auditor";
  const canSeePanel = isAdmin || isAuditor;
  const supabaseMode = isSupabaseClientMode();

  const [filterRole, setFilterRole] = useState<"" | ForRole>("");
  const [filterType, setFilterType] = useState<"" | AppNotification["type"]>("");
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOk, setSettingsOk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userPrefs, setUserPrefs] = useState<NotificationPrefsMap>({});
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Compose state
  const [composeTitle, setComposeTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeRole, setComposeRole] = useState<ForRole>("streamer");
  const [composeUser, setComposeUser] = useState<string>(""); // boş = role-wide broadcast
  const [composeType, setComposeType] = useState<AppNotification["type"]>("general");
  const [composeHref, setComposeHref] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeOk, setComposeOk] = useState<string | null>(null);

  const loadFromServer = async () => {
    if (!canSeePanel || !supabaseMode) return;
    setRefreshing(true);
    try {
      await refreshNotificationsFromServer();
      const [settingsRes, prefsRes] = await Promise.all([
        fetch("/api/notifications/settings", { credentials: "include" }),
        fetch("/api/notifications/preferences", { credentials: "include" }),
      ]);
      if (settingsRes.ok) {
        const data = (await settingsRes.json()) as { settings: NotifSettings };
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
      }
      if (prefsRes.ok) {
        const prefs = (await prefsRes.json()) as { preferences?: NotificationPrefsMap };
        setUserPrefs(prefs.preferences ?? {});
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!canSeePanel || !supabaseMode) return;
    void loadFromServer();
  }, [canSeePanel, supabaseMode]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications
      .filter((n) => !filterRole || n.forRole === filterRole)
      .filter((n) => !filterType || n.type === filterType)
      .filter((n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      )
      .slice(0, 200);
  }, [notifications, filterRole, filterType, search]);

  const stats = useMemo(() => {
    const byRole: Record<ForRole, number> = { admin: 0, auditor: 0, streamer: 0, brand: 0 };
    let unreadTotal = 0;
    for (const n of notifications) {
      byRole[n.forRole as ForRole] = (byRole[n.forRole as ForRole] ?? 0) + 1;
      if (!n.read) unreadTotal++;
    }
    return { total: notifications.length, byRole, unread: unreadTotal };
  }, [notifications]);

  if (!user) return null;
  if (!canSeePanel) {
    return (
      <div className="p-3 sm:p-6 md:p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Bildirim Merkezi</CardTitle>
            <CardDescription>Bu sayfayı yalnızca yöneticiler ve denetçiler görüntüleyebilir.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sendCompose = async () => {
    if (!isAdmin) return;
    if (!composeTitle.trim() || !composeMessage.trim()) {
      setComposeOk("⚠ Başlık ve mesaj zorunlu.");
      return;
    }
    setComposing(true);
    setComposeOk(null);
    try {
      // Supabase varsa server'a yaz (kalıcı); yoksa store'a (localStorage) yaz.
      if (supabaseMode) {
        const res = await fetch("/api/notifications", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: composeTitle.trim(),
            message: composeMessage.trim(),
            forRole: composeRole,
            forUserId: composeUser || undefined,
            type: composeType,
            href: composeHref || undefined,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { notification: AppNotification };
        // Optimistic: client store'a da ekle (sync zaten yer alacak ama daha hızlı)
        useStore.setState((s) => ({
          notifications: [data.notification, ...s.notifications].slice(0, 200),
        }));
      } else {
        pushNotification({
          type: composeType,
          title: composeTitle.trim(),
          message: composeMessage.trim(),
          forRole: composeRole,
          forUserId: composeUser || undefined,
          href: composeHref || undefined,
        });
      }
      logAudit({
        actorId: user.id,
        actorName: user.name,
        action: "user_updated",
        detail: `Bildirim gönderildi: ${ROLE_LABEL[composeRole]} · ${composeTitle.slice(0, 60)}`,
      });
      setComposeTitle("");
      setComposeMessage("");
      setComposeHref("");
      setComposeOk("✓ Bildirim gönderildi.");
      setTimeout(() => setComposeOk(null), 2500);
    } catch (e) {
      setComposeOk(`⚠ Gönderilemedi: ${e instanceof Error ? e.message : "bilinmeyen hata"}`);
    } finally {
      setComposing(false);
    }
  };

  const saveSettings = async () => {
    if (!isAdmin || !supabaseMode) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      logAudit({
        actorId: user.id,
        actorName: user.name,
        action: "user_updated",
        detail: "Bildirim ayarları güncellendi.",
      });
      setSettingsOk("✓ Ayarlar kaydedildi.");
      setTimeout(() => setSettingsOk(null), 2500);
    } catch (e) {
      setSettingsOk(`⚠ Kaydedilemedi: ${e instanceof Error ? e.message : "hata"}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveUserPrefs = async () => {
    if (!supabaseMode) return;
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: userPrefs }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSettingsOk("✓ Kişisel tercihler kaydedildi.");
      setTimeout(() => setSettingsOk(null), 2500);
    } catch (e) {
      setSettingsOk(`⚠ Tercihler kaydedilemedi: ${e instanceof Error ? e.message : "hata"}`);
    } finally {
      setSavingPrefs(false);
    }
  };

  const setPref = (type: AppNotification["type"], field: keyof NotificationPref, value: boolean) => {
    setUserPrefs((prev) => ({
      ...prev,
      [type]: {
        inApp: prev[type]?.inApp ?? true,
        desktop: prev[type]?.desktop ?? false,
        email: prev[type]?.email ?? false,
        [field]: value,
      },
    }));
  };

  const purgeOlder = async () => {
    if (!isAdmin || !supabaseMode) return;
    const days = window.prompt(
      "Kaç günden eski bildirimleri silelim? (ör. 30)",
      "30"
    );
    if (!days) return;
    const d = parseInt(days, 10);
    if (!Number.isFinite(d) || d < 1) return;
    try {
      const res = await fetch(`/api/notifications?olderThanDays=${d}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { deleted: number };
      useStore.setState((s) => {
        const cutoff = Date.now() - d * 86400000;
        return { notifications: s.notifications.filter((n) => new Date(n.createdAt).getTime() >= cutoff) };
      });
      window.alert(`Silinen: ${data.deleted}`);
    } catch (e) {
      window.alert(`Silinemedi: ${e instanceof Error ? e.message : "bilinmeyen hata"}`);
    }
  };

  const myUnread = unreadNotificationCount(notifications, user.role, user.id);
  const silenced = new Set(settings["notifications.silencedTypes"] ?? []);
  const toggleSilence = (t: AppNotification["type"]) => {
    const set = new Set(silenced);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    setSettings((s) => ({ ...s, "notifications.silencedTypes": Array.from(set) }));
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1240px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-center">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bildirim Merkezi</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Tüm bildirim akışı · duyuru gönderimi · uyarı eşikleri."
                : "Read-only · denetim için bildirim akışı."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {myUnread > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-950/30 gap-1">
              <AlertCircle size={11} /> {myUnread} okunmamış
            </Badge>
          )}
          {supabaseMode && (
            <Button variant="outline" size="sm" onClick={() => void loadFromServer()} disabled={refreshing}>
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Yenile
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void markAllNotificationsReadPersisted(user.role, user.id)}
            disabled={myUnread === 0}
          >
            <CheckCheck size={14} /> Hepsini okundu işaretle
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Inbox size={11} /> Toplam
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats.unread} okunmamış
            </p>
          </CardContent>
        </Card>
        {(["admin", "auditor", "streamer", "brand"] as ForRole[]).map((r) => (
          <Card key={r} className="gap-2 py-5">
            <CardHeader className="pb-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                {r === "admin" ? <ShieldCheck size={11} /> : <Megaphone size={11} />}
                {ROLE_LABEL[r]}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-0">
              <p className="text-2xl font-bold tabular-nums">{stats.byRole[r] ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">bildirim</p>
            </CardContent>
          </Card>
        )).slice(0, 3)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sol: liste */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter size={14} /> Bildirim Akışı
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as "" | ForRole)}
                  options={[
                    { value: "", label: "Tüm roller" },
                    { value: "admin", label: "Yönetici" },
                    { value: "auditor", label: "Denetçi" },
                    { value: "streamer", label: "Yayıncı" },
                    { value: "brand", label: "Marka" },
                  ]}
                  className="!py-1 !text-xs w-28"
                />
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "" | AppNotification["type"])}
                  options={[
                    { value: "", label: "Tüm tipler" },
                    ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
                  ]}
                  className="!py-1 !text-xs w-36"
                />
                <Input
                  placeholder="Ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="!py-1 !text-xs w-36"
                />
                {isAdmin && supabaseMode && (
                  <Button variant="outline" size="sm" onClick={purgeOlder} title="Eski bildirimleri sil">
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center">
                Eşleşen bildirim yok.
              </p>
            ) : (
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                {filtered.map((n) => (
                  <div
                    key={n.id}
                    className={`group border border-border rounded-lg p-3 transition-colors ${
                      n.read ? "bg-background" : "bg-primary/5 border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-[10px] py-0">
                            {TYPE_LABEL[n.type] ?? n.type}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] py-0">
                            {ROLE_LABEL[n.forRole as ForRole] ?? n.forRole}
                          </Badge>
                          {!n.read && (
                            <span className="text-[10px] text-primary font-semibold">YENİ</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          {new Date(n.createdAt).toLocaleString("tr-TR")}
                          {n.href && (
                            <>
                              {" · "}
                              <a
                                href={n.href}
                                className="text-primary hover:underline"
                              >
                                Aç →
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button
                            onClick={() => void markNotificationReadPersisted(n.id)}
                            className="text-[10px] text-muted-foreground hover:text-primary"
                            title="Okundu işaretle"
                          >
                            <CheckCheck size={12} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => void deleteNotificationPersisted(n.id)}
                            className="text-[10px] text-muted-foreground hover:text-destructive"
                            title="Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sağ: compose + settings */}
        <div className="space-y-5">
          {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone size={14} /> Bildirim Gönder
                </CardTitle>
                <CardDescription className="text-xs">
                  Seçili role veya tek kişiye duyuru bırakır.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Başlık" required>
                  <Input
                    placeholder="Örn: Bordro hatırlatıcı"
                    value={composeTitle}
                    onChange={(e) => setComposeTitle(e.target.value)}
                  />
                </Field>
                <Field label="Mesaj" required>
                  <Textarea
                    placeholder="Kısa, net bir açıklama yaz…"
                    value={composeMessage}
                    onChange={(e) => setComposeMessage(e.target.value)}
                    rows={3}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Hedef rol" required>
                    <Select
                      value={composeRole}
                      onChange={(e) => {
                        setComposeRole(e.target.value as ForRole);
                        setComposeUser("");
                      }}
                      options={[
                        { value: "admin", label: "Yöneticiler" },
                        { value: "auditor", label: "Denetçiler" },
                        { value: "streamer", label: "Yayıncılar" },
                        { value: "brand", label: "Markalar" },
                      ]}
                    />
                  </Field>
                  <Field label="Tip">
                    <Select
                      value={composeType}
                      onChange={(e) => setComposeType(e.target.value as AppNotification["type"])}
                      options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
                    />
                  </Field>
                </div>
                <Field label="Tek kullanıcı (opsiyonel)" hint="Boş bırakılırsa role bütününe gönderilir.">
                  <Select
                    value={composeUser}
                    onChange={(e) => setComposeUser(e.target.value)}
                    options={[
                      { value: "", label: "(Tüm role)" },
                      ...users
                        .filter((u) => u.role === composeRole && u.active)
                        .map((u) => ({ value: u.id, label: `${u.name} (${u.username})` })),
                    ]}
                  />
                </Field>
                <Field label="Link (opsiyonel)" hint="Tıklanınca yönlenecek sayfa.">
                  <Input
                    placeholder="/maaslar"
                    value={composeHref}
                    onChange={(e) => setComposeHref(e.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button onClick={sendCompose} disabled={composing} size="sm">
                    {composing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Gönder
                  </Button>
                  {composeOk && (
                    <span className="text-[11px] text-muted-foreground">{composeOk}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings size={14} /> Ayarlar
              </CardTitle>
              <CardDescription className="text-xs">
                {isAdmin
                  ? "Otomatik bildirim eşikleri ve sessize alma."
                  : "Yalnızca görüntüleme — düzenlemek için yönetici girişi gerekli."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Kasa düşük uyarısı (USDT eşiği)" hint="Bakiye bu değerin altına düşerse uyarı oluşur.">
                <NumberInput
                  value={Number(settings["notifications.kasaLowThreshold"] ?? 0)}
                  onChange={(n) => setSettings((s) => ({ ...s, "notifications.kasaLowThreshold": n }))}
                  disabled={!isAdmin}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bordro hatırlatıcı">
                  <Select
                    value={settings["notifications.payrollReminderEnabled"] ? "1" : "0"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        "notifications.payrollReminderEnabled": e.target.value === "1",
                      }))
                    }
                    options={[
                      { value: "1", label: "Açık" },
                      { value: "0", label: "Kapalı" },
                    ]}
                    disabled={!isAdmin}
                  />
                </Field>
                <Field label="Kaç gün önceden">
                  <NumberInput
                    value={Number(settings["notifications.payrollReminderDaysBefore"] ?? 3)}
                    onChange={(n) =>
                      setSettings((s) => ({ ...s, "notifications.payrollReminderDaysBefore": n }))
                    }
                    disabled={!isAdmin}
                  />
                </Field>
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <VolumeX size={12} /> Sessize alınan tipler
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => {
                    const off = silenced.has(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => isAdmin && toggleSilence(t)}
                        disabled={!isAdmin}
                        className={`text-[11px] px-2 py-1 rounded-full border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          off
                            ? "bg-muted/60 text-muted-foreground border-border line-through"
                            : "bg-primary/10 text-primary border-primary/40"
                        }`}
                        title={off ? "Sessizden çıkar" : "Sessize al"}
                      >
                        {off ? <VolumeX size={10} className="inline mr-1" /> : <Volume2 size={10} className="inline mr-1" />}
                        {TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
                  <p className="text-[11px] text-muted-foreground">
                    Bu ayarlar tüm ekibe uygulanır ve sunucuda kalıcı olarak saklanır.
                  </p>
                  <div className="flex items-center gap-2">
                    {settingsOk && (
                      <span className="text-[11px] text-muted-foreground">{settingsOk}</span>
                    )}
                    <Button size="sm" onClick={saveSettings} disabled={savingSettings || !supabaseMode}>
                      {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Kaydet
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {supabaseMode && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell size={14} /> Kişisel tercihlerim
                </CardTitle>
                <CardDescription className="text-xs">
                  Sadece sizin hesabınız için geçerli — hangi bildirimleri uygulama içinde ya da masaüstü pop-up'ı olarak almak istediğinizi seçin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {TYPES.map((t) => {
                  const p: NotificationPref = userPrefs[t] ?? {
                    inApp: true,
                    desktop: false,
                    email: false,
                  };
                  return (
                    <div key={t} className="flex items-center justify-between gap-2 text-xs border-b border-border/50 pb-2 last:border-0">
                      <span className="font-medium text-foreground">{TYPE_LABEL[t]}</span>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.inApp}
                            onChange={(e) => setPref(t, "inApp", e.target.checked)}
                            className="rounded"
                          />
                          Uygulama
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.desktop}
                            onChange={(e) => setPref(t, "desktop", e.target.checked)}
                            className="rounded"
                          />
                          Masaüstü
                        </label>
                      </div>
                    </div>
                  );
                })}
                <Button size="sm" variant="outline" onClick={saveUserPrefs} disabled={savingPrefs}>
                  {savingPrefs ? <Loader2 size={13} className="animate-spin" /> : null}
                  Tercihleri kaydet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick hints */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet size={14} /> Otomatik bildirimler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Calendar size={12} className="text-primary" /> Bordro pencereleri yöneticilere otomatik hatırlatma gönderir.
              </p>
              <p className="flex items-center gap-2">
                <Wallet size={12} className="text-primary" /> Kasa eşik altına inerse <strong>kasa düşük</strong> uyarısı düşer.
              </p>
              <p className="flex items-center gap-2">
                <Megaphone size={12} className="text-primary" /> Yayıncı harcama gönderdikçe denetçi paneline iletilir.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
