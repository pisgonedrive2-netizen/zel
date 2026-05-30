"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCcw, CheckCircle2, XCircle, Copy, Check, Inbox, Mail, Phone, Send,
  Loader2, KeyRound, AlertTriangle, Pencil, Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Textarea, FormActions, FormGrid } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/fmt-date";
import { generatePin } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { StreamerRegistrationRequest } from "@/store/store";

type Status = StreamerRegistrationRequest["status"];
type StatusFilter = Status | "all";

interface ApproveResponse {
  ok: true;
  request: StreamerRegistrationRequest;
  employee: { id: string; name: string };
  user: { id: string; username: string; name: string };
  plainPin: string;
}

const STATUS_LABELS: Record<Status, string> = {
  pending: "Bekleyen",
  approved: "Onaylı",
  rejected: "Reddedilen",
  duplicate: "Yinelenmiş",
};

const STATUS_BADGE_CLS: Record<Status, string> = {
  pending: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  approved: "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40",
  rejected: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
  duplicate: "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
};

const STATUS_FILTER_ORDER: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "pending", label: "Bekleyen" },
  { id: "approved", label: "Onaylı" },
  { id: "rejected", label: "Reddedilen" },
  { id: "all", label: "Tümü" },
];

async function fetchRequests(status: StatusFilter): Promise<StreamerRegistrationRequest[]> {
  const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  const res = await fetch(`/api/streamer-registrations${qs}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Liste alınamadı (${res.status})`);
  }
  const data = (await res.json()) as { requests?: StreamerRegistrationRequest[] };
  return Array.isArray(data.requests) ? data.requests : [];
}

async function approveRequest(
  id: string,
  body: { usernameOverride?: string; customPin?: string }
): Promise<ApproveResponse> {
  const res = await fetch(`/api/streamer-registrations/${id}/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApproveResponse | { error?: string };
  if (!res.ok || !("ok" in data) || data.ok !== true) {
    const errMsg = "error" in data && data.error ? data.error : `Onaylama başarısız (${res.status})`;
    throw new Error(errMsg);
  }
  return data;
}

async function rejectRequest(id: string, reason: string): Promise<void> {
  const res = await fetch(`/api/streamer-registrations/${id}/reject`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Reddetme başarısız (${res.status})`);
  }
}

type StreamerEditableFields = Pick<
  StreamerRegistrationRequest,
  | "displayName"
  | "realName"
  | "contactEmail"
  | "contactPhone"
  | "telegram"
  | "platforms"
  | "categories"
  | "audienceSize"
  | "preferredUsername"
  | "notes"
>;

async function editRequest(id: string, patch: StreamerEditableFields): Promise<void> {
  const res = await fetch(`/api/streamer-registrations/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Kaydetme başarısız (${res.status})`);
  }
}

// ── Approve Dialog (opsiyonel kullanıcı adı / PIN) ──────────────────────────

function ApproveDialog({
  request,
  onClose,
  onApproved,
}: {
  request: StreamerRegistrationRequest;
  onClose: () => void;
  onApproved: (resp: ApproveResponse) => void;
}) {
  const [usernameOverride, setUsernameOverride] = useState(request.preferredUsername ?? "");
  const [customPin, setCustomPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const resp = await approveRequest(request.id, {
        usernameOverride: usernameOverride.trim() || undefined,
        customPin: customPin.trim() || undefined,
      });
      onApproved(resp);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Onaylama başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
        <p className="text-sm font-semibold text-foreground">
          {request.displayName}
          {request.realName ? (
            <span className="ml-2 font-normal text-muted-foreground">({request.realName})</span>
          ) : null}
        </p>
        <p className="text-muted-foreground mt-0.5">{request.contactEmail}</p>
      </div>

      <p className="text-sm text-foreground">
        Bu başvuruyu onaylayınca yayıncı, kullanıcı, havuz profili ve ilk PIN oluşturulur. Devam
        etmek istiyor musun?
      </p>

      <div className="grid gap-3">
        <Field
          label="Kullanıcı adı (opsiyonel override)"
          hint="Boş bırakılırsa tercih edilen kullanıcı adı veya görünen addan otomatik üretilir."
        >
          <Input
            value={usernameOverride}
            onChange={(e) => setUsernameOverride(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder={request.preferredUsername ?? "ornek: yayinci"}
            autoComplete="off"
          />
        </Field>
        <Field label="Özel PIN (opsiyonel)" hint="Boş bırakılırsa güvenli 8 karakterli PIN otomatik üretilir.">
          <div className="flex gap-2">
            <Input
              value={customPin}
              onChange={(e) => setCustomPin(e.target.value)}
              placeholder="Otomatik üretilecek"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setCustomPin(generatePin())}
            >
              <Sparkles size={13} /> Üret
            </Button>
          </div>
        </Field>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}

      <FormActions onCancel={onClose} submitLabel={busy ? "Onaylanıyor..." : "Onayla & oluştur"} />
      {busy && (
        <p className="-mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 size={11} className="animate-spin" /> Yayıncı hesabı oluşturuluyor…
        </p>
      )}
    </form>
  );
}

// ── Edit Dialog ────────────────────────────────────────────────────────────

function EditDialog({
  request,
  onClose,
  onSaved,
}: {
  request: StreamerRegistrationRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(request.displayName);
  const [realName, setRealName] = useState(request.realName ?? "");
  const [contactEmail, setContactEmail] = useState(request.contactEmail);
  const [contactPhone, setContactPhone] = useState(request.contactPhone ?? "");
  const [telegram, setTelegram] = useState(request.telegram ?? "");
  const [platforms, setPlatforms] = useState(request.platforms ?? "");
  const [categories, setCategories] = useState(request.categories ?? "");
  const [audienceSize, setAudienceSize] = useState(request.audienceSize ?? "");
  const [preferredUsername, setPreferredUsername] = useState(request.preferredUsername ?? "");
  const [notes, setNotes] = useState(request.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErr("Görünen ad zorunlu.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await editRequest(request.id, {
        displayName: displayName.trim(),
        realName: realName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        telegram: telegram.trim(),
        platforms: platforms.trim(),
        categories: categories.trim(),
        audienceSize: audienceSize.trim(),
        preferredUsername: preferredUsername.trim(),
        notes: notes.trim(),
      });
      onSaved();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Kaydetme başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormGrid>
        <Field label="Görünen ad" required>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </Field>
        <Field label="Gerçek ad">
          <Input value={realName} onChange={(e) => setRealName(e.target.value)} />
        </Field>
        <Field label="E-posta">
          <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </Field>
        <Field label="Telegram">
          <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@kullanici" />
        </Field>
        <Field label="Kullanıcı adı (tercih)">
          <Input
            value={preferredUsername}
            onChange={(e) => setPreferredUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="ornek: yayinci"
            autoComplete="off"
          />
        </Field>
        <Field label="Platformlar">
          <Input value={platforms} onChange={(e) => setPlatforms(e.target.value)} placeholder="Kick, YouTube..." />
        </Field>
        <Field label="Kategoriler">
          <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Slot, Casino..." />
        </Field>
        <Field label="Kitle büyüklüğü">
          <Input value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} />
        </Field>
      </FormGrid>
      <Field label="Not">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}

      <FormActions onCancel={onClose} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
    </form>
  );
}

function RejectDialog({
  request,
  onClose,
  onRejected,
}: {
  request: StreamerRegistrationRequest;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErr("Red sebebi en az 3 karakter olmalı");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await rejectRequest(request.id, trimmed);
      onRejected();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Reddetme başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
        <p className="text-sm font-semibold text-foreground">{request.displayName}</p>
        <p className="text-muted-foreground mt-0.5">{request.contactEmail}</p>
      </div>
      <Field label="Red sebebi" required hint="Başvuru sahibine iletilebilir.">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} required placeholder="Ör. Profil bilgileri yetersiz." />
      </Field>
      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>
      )}
      <FormActions onCancel={onClose} submitLabel={busy ? "Gönderiliyor..." : "Reddet"} />
    </form>
  );
}

function ApproveSuccessDialog({ resp, onClose }: { resp: ApproveResponse; onClose: () => void }) {
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyPin = async () => {
    await navigator.clipboard.writeText(resp.plainPin);
    setCopiedPin(true);
    setCopiedAll(false);
    setTimeout(() => setCopiedPin(false), 2500);
  };
  const copyAll = async () => {
    const lines = [
      `Yayıncı: ${resp.request.displayName}`,
      `Kullanıcı adı: ${resp.user.username}`,
      `PIN: ${resp.plainPin}`,
      `Giriş: https://foxstream.app/login`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopiedAll(true);
    setCopiedPin(false);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div className="space-y-4 py-1">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
          <CheckCircle2 className="text-green-700 dark:text-green-400" size={22} />
        </div>
        <h3 className="mt-2 text-base font-semibold">Yayıncı onaylandı</h3>
        <p className="text-xs text-muted-foreground">
          <strong>{resp.request.displayName}</strong> için yayıncı, kullanıcı ve havuz profili oluşturuldu.
        </p>
      </div>
      <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/40 px-4 py-3 text-center dark:border-blue-500/45 dark:bg-blue-950/30">
        <p className="mb-1 text-[11px] text-muted-foreground">Kullanıcı adı</p>
        <p className="mb-3 font-mono text-sm">{resp.user.username}</p>
        <p className="mb-1 text-[11px] text-muted-foreground">PIN</p>
        <p className="font-mono text-xl font-bold tracking-wider text-foreground">{resp.plainPin}</p>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <p>Bu PIN <strong>bir daha gösterilmeyecek</strong>. Kopyalayıp yayıncıya güvenli kanaldan iletin.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => void copyPin()} className="gap-1.5">
          {copiedPin ? <Check size={14} /> : <KeyRound size={14} />}
          {copiedPin ? "PIN kopyalandı" : "Yalnız PIN"}
        </Button>
        <Button onClick={() => void copyAll()} className="gap-1.5">
          {copiedAll ? <Check size={14} /> : <Copy size={14} />}
          {copiedAll ? "Kopyalandı!" : "Tüm giriş bilgileri"}
        </Button>
        <Button variant="secondary" onClick={onClose}>Kapat</Button>
      </div>
    </div>
  );
}

function NotesCell({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!notes) return <span className="text-muted-foreground">—</span>;
  const isLong = notes.length > 60;
  return (
    <div className="max-w-[20rem] text-xs leading-snug">
      <p className={expanded ? "whitespace-pre-wrap" : "line-clamp-2"} title={notes}>{notes}</p>
      {isLong && (
        <button type="button" className="mt-1 text-[10px] text-blue-600 hover:underline dark:text-blue-400" onClick={() => setExpanded((s) => !s)}>
          {expanded ? "Daralt" : "Tümünü gör"}
        </button>
      )}
    </div>
  );
}

export function StreamerRegistrationsPanel({
  onPendingCountChange,
}: {
  onPendingCountChange?: (count: number) => void;
}) {
  const [requests, setRequests] = useState<StreamerRegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("pending");

  const [rejectTarget, setRejectTarget] = useState<StreamerRegistrationRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<StreamerRegistrationRequest | null>(null);
  const [editTarget, setEditTarget] = useState<StreamerRegistrationRequest | null>(null);
  const [approveResp, setApproveResp] = useState<ApproveResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setLoadError(null);
      try {
        setRequests(await fetchRequests(status));
      } catch (ex) {
        setLoadError(ex instanceof Error ? ex.message : "Veri alınamadı");
      } finally {
        setLoading(false);
      }
    },
    [status]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (onPendingCountChange && status === "pending") onPendingCountChange(requests.length);
  }, [requests, status, onPendingCountChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 flex-wrap border-b border-border/60 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Inbox size={16} /> Yayıncı Başvuruları
            <Badge variant="outline" className="text-[10px] tabular-nums">{requests.length}</Badge>
          </CardTitle>
          <CardDescription>
            Yayıncı self-servis kayıt başvuruları · onaylayınca yayıncı + kullanıcı + havuz profili + PIN otomatik üretilir
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load(true)} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Yenile
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">{toast}</div>
        )}
        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{loadError}</div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Durum</p>
          <div role="tablist" className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
            {STATUS_FILTER_ORDER.map((opt) => {
              const active = status === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatus(opt.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Yayıncı", "İletişim", "Detay", "Tarih", "Durum", "Aksiyonlar"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <Loader2 size={20} className="mx-auto animate-spin opacity-50" />
                    <p className="mt-2">Yükleniyor…</p>
                  </td>
                </tr>
              )}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox size={28} className="opacity-30" />
                      <p className="text-sm">{status === "pending" ? "Bekleyen başvuru yok." : "Bu filtre için kayıt yok."}</p>
                    </div>
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top transition-colors hover:bg-accent/15">
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-foreground">{r.displayName}</p>
                      {r.realName && <p className="text-[11px] text-muted-foreground">{r.realName}</p>}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.categories && <Badge variant="outline" className="text-[10px]">{r.categories}</Badge>}
                        {r.audienceSize && <Badge variant="outline" className="text-[10px] tabular-nums">{r.audienceSize}</Badge>}
                        {r.preferredUsername && <span className="font-mono text-[10px] text-muted-foreground">@{r.preferredUsername}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <a href={`mailto:${r.contactEmail}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Mail size={11} /> {r.contactEmail}
                      </a>
                      {r.contactPhone && (
                        <a href={`tel:${r.contactPhone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Phone size={11} /> {r.contactPhone}
                        </a>
                      )}
                      {r.telegram && (
                        <a href={`https://t.me/${r.telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Send size={11} /> {r.telegram}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5">
                      {r.platforms && <p className="text-[11px] text-foreground">{r.platforms}</p>}
                      <NotesCell notes={r.notes ?? ""} />
                      {r.status === "rejected" && r.rejectionReason && (
                        <p className="text-[11px] text-red-600 dark:text-red-300 italic">↳ {r.rejectionReason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    <p>{fmtDateTime(r.createdAt)}</p>
                    {r.reviewedAt && <p className="mt-0.5 text-[10px] opacity-80">İncelendi: {fmtDateTime(r.reviewedAt)}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLS[r.status]}`}>{STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    {r.status === "pending" ? (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <Button size="sm" className="gap-1.5" onClick={() => setApproveTarget(r)}>
                          <CheckCircle2 size={13} /> Onayla
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditTarget(r)}>
                          <Pencil size={13} /> Düzenle
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400" onClick={() => setRejectTarget(r)}>
                          <XCircle size={13} /> Reddet
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Onay diyaloğu */}
      <Modal open={approveTarget !== null} onClose={() => setApproveTarget(null)} title="Yayıncı başvurusunu onayla" size="md">
        {approveTarget && (
          <ApproveDialog
            request={approveTarget}
            onClose={() => setApproveTarget(null)}
            onApproved={(resp) => {
              setApproveTarget(null);
              setApproveResp(resp);
              setToast(`✓ ${resp.request.displayName} onaylandı ve hesap oluşturuldu.`);
              void load(false);
            }}
          />
        )}
      </Modal>

      {/* Düzenleme diyaloğu */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Yayıncı başvurusunu düzenle" size="lg">
        {editTarget && (
          <EditDialog
            request={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={() => {
              setToast(`✓ ${editTarget.displayName} başvurusu güncellendi.`);
              setEditTarget(null);
              void load(false);
            }}
          />
        )}
      </Modal>

      <Modal open={approveResp !== null} onClose={() => setApproveResp(null)} title="" size="md">
        {approveResp && <ApproveSuccessDialog resp={approveResp} onClose={() => setApproveResp(null)} />}
      </Modal>

      <Modal open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="Yayıncı başvurusunu reddet" size="md">
        {rejectTarget && (
          <RejectDialog
            request={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onRejected={() => {
              setToast(`✓ ${rejectTarget.displayName} başvurusu reddedildi.`);
              setRejectTarget(null);
              void load(false);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
