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
  markAllPanelNotificationsReadPersisted,
  deleteNotificationPersisted,
  deleteNotificationsPersisted,
} from "@/lib/notification-actions";
import { fmtDateTime } from "@/lib/fmt-date";
import type { NotificationPref, NotificationPrefsMap } from "@/lib/notification-preferences";
import { PageShell } from "@/components/page-shell";
import {
  BildirimNavbar,
  bildirimTabFromSearch,
  type BildirimTab,
} from "@/components/bildirim/bildirim-navbar";

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
  api_refresh_alert:  "API izlenme uyarısı",
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
  const canCompose = canSeePanel;
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
  const [activeTab, setActiveTab] = useState<BildirimTab>("akis");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveTab(bildirimTabFromSearch(window.location.search, isAdmin));
  }, [isAdmin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setActiveTab(bildirimTabFromSearch(window.location.search, isAdmin));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isAdmin]);

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

  const composeCandidates = useMemo(
    () => users.filter((u) => u.role === composeRole && u.active),
    [users, composeRole]
  );

  if (!user) return null;
  if (!canSeePanel) {
    return (
      <PageShell size="lg">
        <Card>
          <CardHeader>
            <CardTitle>Bildirim Merkezi</CardTitle>
            <CardDescription>Bu sayfayı yalnızca yöneticiler ve denetçiler görüntüleyebilir.</CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  const sendCompose = async () => {
    if (!canCompose) return;
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

  const clearFiltered = async () => {
    if (!isAdmin) return;
    if (filtered.length === 0) return;
    const label =
      filterRole || filterType || search
        ? `${filtered.length} filtrelenmiş bildirim`
        : `tüm ${filtered.length} bildirim`;
    if (!window.confirm(`${label} kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    const ids = filtered.map((n) => n.id);
    setRefreshing(true);
    try {
      const { deleted, failed } = await deleteNotificationsPersisted(ids);
      if (failed > 0) {
        window.alert(`${deleted} bildirim silindi, ${failed} adet silinemedi. Yenileyip tekrar deneyin.`);
      } else {
        window.alert(`${deleted} bildirim silindi.`);
      }
      await refreshNotificationsFromServer();
    } finally {
      setRefreshing(false);
    }
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

  const panelUnread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const silenced = new Set(settings["notifications.silencedTypes"] ?? []);
  const toggleSilence = (t: AppNotification["type"]) => {
    const set = new Set(silenced);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    setSettings((s) => ({ ...s, "notifications.silencedTypes": Array.from(set) }));
  };

  const headerActions = (
    <>
      {supabaseMode && (
        <Button variant="outline" size="sm" className="h-8" onClick={() => void loadFromServer()} disabled={refreshing}>
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          <span className="hidden sm:inline">Yenile</span>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => void markAllPanelNotificationsReadPersisted()}
        disabled={panelUnread === 0}
      >
        <CheckCheck size={13} />
        <span className="hidden sm:inline">Okundu</span>
      </Button>
    </>
  );

  const filterBar = (
    <div className="flex items-center gap-2 flex-wrap mb-3">
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
      {isAdmin && supabaseMode && filtered.length > 0 && (filterRole || filterType || search) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void clearFiltered()}
          className="text-destructive h-8"
        >
          <Trash2 size={12} /> Sil ({filtered.length})
        </Button>
      )}
      {isAdmin && supabaseMode && (
        <Button variant="outline" size="sm" className="h-8" onClick={purgeOlder} title="Eski bildirimleri sil">
          <Trash2 size={12} />
        </Button>
      )}
    </div>
  );

  const notificationList = (
    <>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">
          Eşleşen bildirim yok.
        </p>
      ) : (
        <div className="space-y-2">
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
                          {n.forUserId && (
                            <Badge variant="outline" className="text-[10px] py-0 text-violet-700 dark:text-violet-300">
                              {users.find((u) => u.id === n.forUserId)?.name ?? "Kullanıcı"}
                            </Badge>
                          )}
                          {!n.read && (
                            <span className="text-[10px] text-primary font-semibold">YENİ</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          {fmtDateTime(n.createdAt)}
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
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => void markNotificationReadPersisted(n.id)}
                            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Okundu işaretle"
                          >
                            <CheckCheck size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void deleteNotificationPersisted(n.id)}
                            className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Bildirimi sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
        </div>
      )}
    </>
  );

  const composePanel = canCompose ? (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone size={14} /> Mesaj / Bildirim Gönder
        </CardTitle>
                <CardDescription className="text-xs">
                  Tek bir yayıncı, denetçi, yönetici veya markaya özel mesaj gönderebilir; ya da
                  rol bütününe duyuru yapabilirsiniz.
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
                <Field label="Tek kullanıcı (opsiyonel)" hint="Boş bırakılırsa role bütününe duyuru gider.">
                  <Select
                    value={composeUser}
                    onChange={(e) => setComposeUser(e.target.value)}
                    options={[
                      {
                        value: "",
                        label: `(Tüm ${ROLE_LABEL[composeRole].toLowerCase()}lara — ${composeCandidates.length})`,
                      },
                      ...composeCandidates.map((u) => ({
                        value: u.id,
                        label: `${u.name} (${u.username})`,
                      })),
                    ]}
                  />
                </Field>
                {composeCandidates.length === 0 && (
                  <p className="text-[11px] text-amber-600 -mt-2">
                    Bu rolde aktif kullanıcı yok.
                  </p>
                )}
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
  ) : null;

  const settingsPanel = (
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
  );

  const prefsPanel = supabaseMode ? (
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
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.email}
                            onChange={(e) => setPref(t, "email", e.target.checked)}
                            className="rounded"
                          />
                          E-posta
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
  ) : (
    <p className="text-sm text-muted-foreground italic py-4">Kişisel tercihler Supabase modunda kullanılabilir.</p>
  );

  return (
    <PageShell size="lg">
      <BildirimNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        total={stats.total}
        unread={panelUnread}
        canCompose={canCompose}
        trailing={headerActions}
      />

      {/* Rol özeti — kompakt chip satırı */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["admin", "auditor", "streamer", "brand"] as ForRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setActiveTab("akis");
              setFilterRole((prev) => (prev === r ? "" : r));
            }}
            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
              filterRole === r
                ? "bg-foreground text-background border-foreground"
                : "bg-muted/40 text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {ROLE_LABEL[r]}: {stats.byRole[r] ?? 0}
          </button>
        ))}
      </div>

      {activeTab === "akis" && (
        <Card className="flex flex-col gap-0 py-0 overflow-hidden max-h-[calc(100dvh-11rem)] min-h-[320px]">
          <CardHeader className="py-3 px-4 pb-2 shrink-0 border-b border-border/60">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter size={14} /> Bildirim akışı
              <Badge variant="outline" className="text-[10px] font-normal">
                {filtered.length} kayıt
              </Badge>
            </CardTitle>
          </CardHeader>
          <div className="px-4 pt-2 shrink-0">{filterBar}</div>
          <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-2">
            {notificationList}
          </CardContent>
        </Card>
      )}

      {activeTab === "gonder" && canCompose && composePanel}

      {activeTab === "ayarlar" && (
        <div className="space-y-4 max-w-2xl">
          {settingsPanel}
          <Card className="gap-2 py-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet size={13} /> Otomatik bildirimler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground pt-0">
              <p className="flex items-center gap-2">
                <Calendar size={12} className="text-primary shrink-0" /> Bordro pencereleri yöneticilere hatırlatma gönderir.
              </p>
              <p className="flex items-center gap-2">
                <Wallet size={12} className="text-primary shrink-0" /> Kasa eşik altına inerse uyarı oluşur.
              </p>
              <p className="flex items-center gap-2">
                <Megaphone size={12} className="text-primary shrink-0" /> Yayıncı harcamaları denetçi paneline iletilir.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "tercihler" && (
        <div className="max-w-2xl">{prefsPanel}</div>
      )}
    </PageShell>
  );
}
