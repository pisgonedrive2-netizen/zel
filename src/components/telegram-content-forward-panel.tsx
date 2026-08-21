"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Loader2, Save, RefreshCw, PlayCircle, Search, X, Plus, Square } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

type QueueRow = {
  id: string;
  content_url: string;
  platform: string;
  status: string;
  error?: string | null;
  sent_at?: string | null;
  created_at?: string;
  attempts?: number;
};

type GroupChat = {
  id: string;
  title: string;
  type: string;
  isForum?: boolean;
  topics?: Array<{ threadId: number; name: string }>;
  selectedThreadId?: number | null;
};

type WatchAccount = {
  id: string;
  employeeId: string;
  employeeName: string;
  platform: string;
  handle: string;
  url: string;
  status: string;
};

type AccountsPayload = {
  watched: WatchAccount[];
  available: WatchAccount[];
  implicitAll: boolean;
  employees: Array<{ id: string; name: string }>;
};

type Payload = {
  ok: boolean;
  settings?: {
    enabled: boolean;
    chatId: string;
    groups?: GroupChat[];
    lookbackHours: number;
    maxPerRun: number;
  };
  accounts?: AccountsPayload;
  botConfigured?: boolean;
  bot?: { ok: boolean; username?: string; name?: string; error?: string };
  webhook?: { url?: string; pending?: number; error?: string };
  tableReady?: boolean;
  counts?: { pending: number; sent: number; failed: number };
  stats?: {
    today: number;
    week: number;
    month: number;
    lastSentAt: string | null;
    byDay: Array<{ date: string; sent: number }>;
    byPlatform: Array<{ platform: string; sent: number }>;
  };
  recent?: QueueRow[];
  error?: string;
};

function looksLikePersonalId(id: string): boolean {
  const t = id.trim();
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Sunucu boş cevap döndü" : `Sunucu hatası (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "Sunucu geçersiz cevap döndü" : `Sunucu hatası (${res.status})`);
  }
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDay(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}.${m}.${y}`;
}

function selectedTopicLabel(c: GroupChat): string {
  const id = c.selectedThreadId;
  if (!id || id === 1) return "General";
  return c.topics?.find((t) => t.threadId === id)?.name || `Topic ${id}`;
}

export function TelegramContentForwardPanel() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [chatId, setChatId] = useState("");
  const [lookbackHours, setLookbackHours] = useState(48);
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [accounts, setAccounts] = useState<AccountsPayload | null>(null);
  const [pickAccountId, setPickAccountId] = useState("");
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addPlatform, setAddPlatform] = useState("Instagram");
  const [addHandle, setAddHandle] = useState("");
  const [addUrl, setAddUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telegram-content", { credentials: "include" });
      const json = await readJson<Payload>(res);
      setData(json);
      if (json.settings) {
        setEnabled(json.settings.enabled);
        setChatId(json.settings.chatId);
        setLookbackHours(json.settings.lookbackHours);
        setChats(json.settings.groups ?? []);
      }
      if (json.accounts) setAccounts(json.accounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/telegram-content", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, enabled, chatId: chatId.trim(), lookbackHours, ...extra }),
      });
      const json = await readJson<{
        ok: boolean;
        error?: string;
        hint?: string;
        queued?: number;
        retried?: number;
        summary?: { sent?: number; failed?: number; attempted?: number };
        poll?: { attempted?: number; synced?: number; failed?: number };
        chats?: GroupChat[];
        settings?: Payload["settings"];
        accounts?: AccountsPayload;
        sentTo?: Array<{ chatId: string; title: string; topicName: string; ok: boolean; error?: string }>;
      }>(res);
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? `Hata (${res.status})`);
        if (json.settings) {
          setEnabled(json.settings.enabled);
          setChatId(json.settings.chatId);
          if (json.settings.groups) setChats(json.settings.groups);
        }
        return;
      }
      if (json.chats) setChats(json.chats);
      if (json.settings) {
        setEnabled(json.settings.enabled);
        setChatId(json.settings.chatId);
        setLookbackHours(json.settings.lookbackHours);
        if (json.settings.groups) setChats(json.settings.groups);
      }
      if (json.accounts) setAccounts(json.accounts);
      if (action === "backfill") setMsg(`${json.queued ?? 0} video kuyruğa alındı`);
      else if (action === "start") {
        setMsg(
          `Bot çalışıyor. Gönderildi: ${json.summary?.sent ?? 0} · hata: ${json.summary?.failed ?? 0}` +
            (json.poll ? ` · taranan ${json.poll.attempted ?? 0}` : "")
        );
      } else if (action === "stop") setMsg("Bot durdu. Yeni video gitmez.");
      else if (action === "run") {
        setMsg(
          `Gönderildi: ${json.summary?.sent ?? 0} · hata: ${json.summary?.failed ?? 0}` +
            (json.poll ? ` · taranan ${json.poll.attempted ?? 0}` : "")
        );
      } else if (action === "retry") setMsg(`${json.retried ?? 0} hata yeniden kuyrukta`);
      else if (action === "test") {
        const dest = (json.sentTo ?? [])
          .filter((s) => s.ok)
          .map((s) => `${s.title} · ${s.topicName}`)
          .join(", ");
        setMsg(
          dest
            ? `Test gitti: ${dest}. Topic listesi bundan dolmaz — diğer topic için o topice girip @botu etiketleyin, sonra Grupları bul.`
            : "Test gönderildi"
        );
      }
      else if (action === "save") setMsg("Kaydedildi");
      else if (action === "remove-group") setMsg("Grup listeden çıkarıldı");
      else if (action === "select-topic") setMsg("Topic kaydedildi — videolar bu topice gidecek");
      else if (action === "add-account") {
        setMsg("Hesap eklendi");
        setPickAccountId("");
        setAddHandle("");
        setAddUrl("");
      }
      else if (action === "remove-account") setMsg("Hesap listeden çıkarıldı");
      else if (action === "discover") {
        setMsg(
          json.hint ??
            ((json.chats ?? json.settings?.groups ?? []).length
              ? `${(json.chats ?? json.settings?.groups ?? []).length} grup kaydedildi — videolar bunlara gidecek`
              : "Grup bulunamadı")
        );
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "İstek başarısız");
    } finally {
      setBusy(null);
    }
  }

  const botLabel = data?.bot?.ok
    ? `@${data.bot.username ?? "bot"}`
    : data?.bot?.error ?? "Bot yok";
  const personalIdWarning = looksLikePersonalId(chatId);
  const failedRows = (data?.recent ?? []).filter((r) => r.status === "failed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send size={16} className="text-[#2AABEE]" />
          Telegram içerik botu
        </CardTitle>
        <CardDescription>
          Grup id girip Start deyin. Takip listesini aşağıdan ekleyin / çıkarın. Videolar linkiyle
          birlikte gruba gider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !data ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <Badge variant={data?.botConfigured ? "secondary" : "outline"}>
                {data?.botConfigured ? `Bot ${botLabel}` : "TELEGRAM_BOT_TOKEN eksik"}
              </Badge>
              <Badge variant={enabled ? "secondary" : "outline"}>
                {enabled ? "Çalışıyor" : "Durdu"}
              </Badge>
              {data?.tableReady === false ? (
                <Badge variant="destructive">DB tablosu yok — migration gerekli</Badge>
              ) : null}
              <Badge variant="outline">Bekleyen {data?.counts?.pending ?? 0}</Badge>
              <Badge variant="outline">Gönderilen {data?.counts?.sent ?? 0}</Badge>
              {(data?.counts?.failed ?? 0) > 0 ? (
                <Badge variant="destructive">Hata {data?.counts?.failed}</Badge>
              ) : null}
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium">Hedef grup</p>
              <label className="block text-[11px] text-muted-foreground">
                Grup id <span className="font-mono">-100…</span>
                <input
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={chatId}
                  disabled={!canEdit}
                  placeholder="-1003892533929"
                  onChange={(e) => setChatId(e.target.value.trim())}
                />
              </label>
              {personalIdWarning ? (
                <p className="text-[11px] text-destructive">
                  Bu bir kişi/bot id. Grup id her zaman eksi başlar.
                </p>
              ) : null}
              {canEdit ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={!!busy || personalIdWarning}
                    onClick={() => void post("start")}
                  >
                    {busy === "start" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <PlayCircle size={12} />
                    )}
                    Start
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    disabled={!!busy || !enabled}
                    onClick={() => void post("stop")}
                  >
                    {busy === "stop" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Square size={11} />
                    )}
                    Durdur
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs"
                    disabled={!!busy}
                    onClick={() => void post("discover")}
                  >
                    {busy === "discover" ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Search size={11} />
                    )}
                    Grupları bul
                  </Button>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Start: grubu kaydeder, botu açar, yeni içerikleri tarayıp linkiyle gönderir. Botu
                gruba ekleyin; forumda videolar topic’ine bir kez etiketleyin.
              </p>
            </div>

            {chats.length > 0 ? (
              <ul className="space-y-2">
                {chats.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-medium">{c.title}</span>
                        {c.isForum ? (
                          <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                            forum
                          </span>
                        ) : null}
                        <span className="ml-1.5 text-muted-foreground">
                          → {selectedTopicLabel(c)}
                        </span>
                        <span className="ml-1.5 font-mono text-muted-foreground">{c.id}</span>
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Listeden çıkar"
                          onClick={() => void post("remove-group", { removeChatId: c.id })}
                        >
                          <X size={12} />
                        </button>
                      ) : null}
                    </div>
                    {c.isForum || (c.topics?.length ?? 0) > 0 ? (
                      <label className="mt-1.5 block text-[10px] text-muted-foreground">
                        Topic
                        <select
                          className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                          value={c.selectedThreadId ?? ""}
                          disabled={!canEdit || !!busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            void post("select-topic", {
                              chatId: c.id,
                              threadId: v ? Number(v) : null,
                            });
                          }}
                        >
                          <option value="">General (genel)</option>
                          {(c.topics ?? [])
                            .filter((t) => t.threadId !== 1)
                            .map((t) => (
                              <option key={t.threadId} value={t.threadId}>
                                {t.name} · {t.threadId}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground">
                Kayıtlı grup yok. Id girip Start deyin veya Grupları bul.
              </p>
            )}

            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Takip edilen hesaplar</p>
                <Badge variant="outline">{accounts?.watched.length ?? 0}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Yalnızca listedekiler taranır. Çıkarmak yayıncı kaydını silmez.
              </p>
              {(accounts?.watched.length ?? 0) > 0 ? (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {accounts!.watched.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background px-2 py-1 text-[11px]"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{a.employeeName}</span>
                        <span className="ml-1.5 text-muted-foreground">{a.platform}</span>
                        <span className="ml-1 font-mono">@{a.handle.replace(/^@/, "")}</span>
                        {a.status !== "active" ? (
                          <span className="ml-1 text-destructive">pasif</span>
                        ) : null}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Listeden çıkar"
                          disabled={!!busy}
                          onClick={() => void post("remove-account", { accountId: a.id })}
                        >
                          <X size={12} />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground">
                  Taranan hesap yok. Aşağıdan ekleyin.
                </p>
              )}

              {canEdit ? (
                <div className="space-y-2 border-t border-border/60 pt-2">
                  {(accounts?.available.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap items-end gap-1.5">
                      <label className="min-w-[12rem] flex-1 text-[10px] text-muted-foreground">
                        Kayıtlı hesap ekle
                        <select
                          className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                          value={pickAccountId}
                          disabled={!!busy}
                          onChange={(e) => setPickAccountId(e.target.value)}
                        >
                          <option value="">Seçin…</option>
                          {accounts!.available.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.employeeName} · {a.platform} · @{a.handle.replace(/^@/, "")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={!!busy || !pickAccountId}
                        onClick={() => void post("add-account", { accountId: pickAccountId })}
                      >
                        {busy === "add-account" ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Plus size={11} />
                        )}
                        Ekle
                      </Button>
                    </div>
                  ) : null}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <label className="text-[10px] text-muted-foreground">
                      Yayıncı
                      <select
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                        value={addEmployeeId}
                        disabled={!!busy}
                        onChange={(e) => setAddEmployeeId(e.target.value)}
                      >
                        <option value="">Seçin…</option>
                        {(accounts?.employees ?? []).map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Platform
                      <select
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                        value={addPlatform}
                        disabled={!!busy}
                        onChange={(e) => setAddPlatform(e.target.value)}
                      >
                        {["Instagram", "TikTok", "YouTube"].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Kullanıcı adı
                      <input
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                        value={addHandle}
                        disabled={!!busy}
                        placeholder="@kullanici"
                        onChange={(e) => setAddHandle(e.target.value)}
                      />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Profil linki (isteğe bağlı)
                      <input
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
                        value={addUrl}
                        disabled={!!busy}
                        placeholder="https://…"
                        onChange={(e) => setAddUrl(e.target.value)}
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    disabled={!!busy || !addEmployeeId || !addHandle.trim()}
                    onClick={() =>
                      void post("add-account", {
                        employeeId: addEmployeeId,
                        platform: addPlatform,
                        handle: addHandle,
                        url: addUrl,
                      })
                    }
                  >
                    {busy === "add-account" ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Plus size={11} />
                    )}
                    Yeni hesap ekle
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Bugün", value: data?.stats?.today ?? 0 },
                { label: "Son 7 gün", value: data?.stats?.week ?? 0 },
                { label: "Bu ay", value: data?.stats?.month ?? 0 },
                { label: "Toplam giden", value: data?.counts?.sent ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
            {data?.stats?.lastSentAt ? (
              <p className="text-[11px] text-muted-foreground">
                Son gönderim: {fmtWhen(data.stats.lastSentAt)}
                {chats[0]?.title ? ` · ${chats[0].title}` : ""}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Henüz gruba video düşmedi.</p>
            )}
            {(data?.stats?.byDay?.length ?? 0) > 0 ? (
              <ul className="grid gap-1 sm:grid-cols-2">
                {data!.stats!.byDay.map((d) => (
                  <li
                    key={d.date}
                    className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-[11px]"
                  >
                    <span>{fmtDay(d.date)}</span>
                    <span className="tabular-nums font-medium">{d.sent} video</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {(data?.stats?.byPlatform?.length ?? 0) > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Platform:{" "}
                {data!.stats!.byPlatform.map((p) => `${p.platform} ${p.sent}`).join(" · ")}
              </p>
            ) : null}

            <label className="text-[11px] text-muted-foreground">
              Geriye bakış (saat)
              <select
                className="mt-1 flex h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs"
                value={lookbackHours}
                disabled={!canEdit}
                onChange={(e) => setLookbackHours(Number(e.target.value))}
              >
                {[12, 24, 48, 72, 168].map((h) => (
                  <option key={h} value={h}>
                    {h} saat
                  </option>
                ))}
              </select>
            </label>

            {canEdit ? (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  disabled={!!busy || personalIdWarning}
                  onClick={() => void post("save")}
                >
                  {busy === "save" ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Kaydet
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  disabled={!!busy || chats.length === 0}
                  onClick={() => void post("test")}
                >
                  Test mesajı
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  disabled={!!busy}
                  onClick={() => void post("backfill")}
                >
                  Son videoları kuyruğa al
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  disabled={!!busy || !enabled}
                  onClick={() => void post("run")}
                >
                  {busy === "run" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <PlayCircle size={11} />
                  )}
                  Şimdi gönder
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  disabled={!!busy}
                  onClick={() => void post("retry")}
                >
                  Hataları tekrar dene
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  disabled={!!busy}
                  onClick={() => void load()}
                >
                  <RefreshCw size={11} />
                </Button>
              </div>
            ) : null}

            {msg ? <p className="text-[11px] text-muted-foreground">{msg}</p> : null}

            {failedRows.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-2">
                <p className="mb-1 text-[11px] font-medium text-destructive">
                  Gönderilemeyen {failedRows.length} kayıt
                </p>
                <ul className="max-h-36 space-y-1 overflow-y-auto text-[11px]">
                  {failedRows.map((r) => (
                    <li key={r.id} className="break-all">
                      <span className="uppercase text-muted-foreground">{r.platform}</span>{" "}
                      {r.content_url}
                      {r.error ? <span className="block text-destructive">{r.error}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(data?.recent?.length ?? 0) > 0 ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto text-[11px]">
                {data!.recent!.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1"
                  >
                    <span className="min-w-0 break-all">
                      <span className="uppercase text-muted-foreground">{r.platform}</span>{" "}
                      {r.content_url}
                      {r.error ? <span className="block text-destructive">{r.error}</span> : null}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Kuyruk boş. Start yeni videoları tarar; veya «Son videoları kuyruğa al».
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
