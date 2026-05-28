"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Inbox,
  Globe,
  Mail,
  Phone,
  Send,
  Sparkles,
  Loader2,
  KeyRound,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Textarea, FormActions } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/fmt-date";
import { generatePin } from "@/store/auth";
import { cn } from "@/lib/utils";
import {
  BRAND_REGISTRATION_STATUS_LABELS,
  type BrandRegistrationApproveResponse,
  type BrandRegistrationRequest,
  type BrandRegistrationStatus,
} from "@/types/brand-registration";

type StatusFilter = BrandRegistrationStatus | "all";

const STATUS_BADGE_CLS: Record<BrandRegistrationStatus, string> = {
  pending:
    "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  approved:
    "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40",
  rejected:
    "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
  duplicate:
    "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
};

const STATUS_FILTER_ORDER: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "pending", label: "Bekleyen" },
  { id: "approved", label: "Onaylı" },
  { id: "rejected", label: "Reddedilen" },
  { id: "duplicate", label: "Yinelenmiş" },
  { id: "all", label: "Tümü" },
];

// ── Veri çekimi ────────────────────────────────────────────────────────────

async function fetchRequests(status: StatusFilter): Promise<BrandRegistrationRequest[]> {
  const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  const res = await fetch(`/api/brand-registrations${qs}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Liste alınamadı (${res.status})`);
  }
  const data = (await res.json()) as { requests?: BrandRegistrationRequest[] };
  return Array.isArray(data.requests) ? data.requests : [];
}

async function approveRequest(
  id: string,
  body: { usernameOverride?: string; customPin?: string }
): Promise<BrandRegistrationApproveResponse> {
  const res = await fetch(`/api/brand-registrations/${id}/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as
    | BrandRegistrationApproveResponse
    | { error?: string };
  if (!res.ok || !("ok" in data) || data.ok !== true) {
    const errMsg = "error" in data && data.error ? data.error : `Onaylama başarısız (${res.status})`;
    throw new Error(errMsg);
  }
  return data;
}

async function rejectRequest(id: string, reason: string): Promise<void> {
  const res = await fetch(`/api/brand-registrations/${id}/reject`, {
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

// ── Approve Dialog ─────────────────────────────────────────────────────────

function ApproveDialog({
  request,
  onClose,
  onApproved,
}: {
  request: BrandRegistrationRequest;
  onClose: () => void;
  onApproved: (resp: BrandRegistrationApproveResponse) => void;
}) {
  const [usernameOverride, setUsernameOverride] = useState(
    request.preferredUsername ?? ""
  );
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
          {request.brandName}
          {request.shortName ? (
            <span className="ml-2 font-normal text-muted-foreground">({request.shortName})</span>
          ) : null}
        </p>
        <p className="text-muted-foreground mt-0.5">
          {request.category} · {request.contactName} · {request.contactEmail}
        </p>
        {request.website && (
          <p className="text-muted-foreground mt-0.5 truncate">{request.website}</p>
        )}
      </div>

      <p className="text-sm text-foreground">
        Bu başvuruyu onaylayınca marka kaydı, yetkili kullanıcı ve ilk PIN oluşturulur.
        Devam etmek istiyor musun?
      </p>

      <div className="grid gap-3">
        <Field
          label="Kullanıcı adı (opsiyonel override)"
          hint="Boş bırakılırsa tercih edilen kullanıcı adı veya markadan otomatik üretilir."
        >
          <Input
            value={usernameOverride}
            onChange={(e) => setUsernameOverride(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder={request.preferredUsername ?? "ornek: galabet"}
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
          <Loader2 size={11} className="animate-spin" /> Marka kaydı oluşturuluyor…
        </p>
      )}
    </form>
  );
}

// ── Reject Dialog ──────────────────────────────────────────────────────────

function RejectDialog({
  request,
  onClose,
  onRejected,
}: {
  request: BrandRegistrationRequest;
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
        <p className="text-sm font-semibold text-foreground">{request.brandName}</p>
        <p className="text-muted-foreground mt-0.5">
          {request.contactName} · {request.contactEmail}
        </p>
      </div>

      <Field label="Red sebebi" required hint="Başvuru sahibine iletilebilir. Net ve nazik bir gerekçe yazın.">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          required
          placeholder="Ör. Sağlanan website doğrulanamadı. Lütfen şirket bilgilerini güncelleyip tekrar başvurun."
        />
      </Field>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}

      <FormActions onCancel={onClose} submitLabel={busy ? "Gönderiliyor..." : "Reddet"} />
    </form>
  );
}

// ── Approve Success (PIN gösterimi) ────────────────────────────────────────

function ApproveSuccessDialog({
  resp,
  onClose,
}: {
  resp: BrandRegistrationApproveResponse;
  onClose: () => void;
}) {
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
      `Marka: ${resp.brand.name}`,
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
        <h3 className="mt-2 text-base font-semibold">Marka onaylandı</h3>
        <p className="text-xs text-muted-foreground">
          <strong>{resp.brand.name}</strong> için marka kaydı ve yetkili kullanıcı oluşturuldu.
        </p>
      </div>

      <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/40 px-4 py-3 text-center dark:border-blue-500/45 dark:bg-blue-950/30">
        <p className="mb-1 text-[11px] text-muted-foreground">Kullanıcı adı</p>
        <p className="mb-3 font-mono text-sm">{resp.user.username}</p>
        <p className="mb-1 text-[11px] text-muted-foreground">PIN</p>
        <p className="font-mono text-xl font-bold tracking-wider text-foreground">
          {resp.plainPin}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <p>
          Bu PIN <strong>bir daha gösterilmeyecek</strong>. Lütfen kopyalayıp markanın yetkilisine
          güvenli kanaldan (e-posta / Telegram) iletin.
        </p>
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
        <Button variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}

// ── Notes (kısaltma + expand) ──────────────────────────────────────────────

function NotesCell({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!notes) return <span className="text-muted-foreground">—</span>;
  const limit = 60;
  const isLong = notes.length > limit;
  return (
    <div className="max-w-[20rem] text-xs leading-snug">
      <p className={expanded ? "whitespace-pre-wrap" : "line-clamp-2"} title={notes}>
        {notes}
      </p>
      {isLong && (
        <button
          type="button"
          className="mt-1 text-[10px] text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => setExpanded((s) => !s)}
        >
          {expanded ? "Daralt" : "Tümünü gör"}
        </button>
      )}
    </div>
  );
}

// ── Ana panel ──────────────────────────────────────────────────────────────

export function BrandRegistrationsPanel({
  onPendingCountChange,
}: {
  /** Bekleyen başvuru sayısı değiştiğinde tetiklenir (örn. sidebar badge için). */
  onPendingCountChange?: (count: number) => void;
}) {
  const [requests, setRequests] = useState<BrandRegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("pending");

  const [approveTarget, setApproveTarget] = useState<BrandRegistrationRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BrandRegistrationRequest | null>(null);
  const [approveResp, setApproveResp] = useState<BrandRegistrationApproveResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setLoadError(null);
      try {
        const list = await fetchRequests(status);
        setRequests(list);
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

  // Bekleyen sayıyı parent'a bildir
  useEffect(() => {
    if (!onPendingCountChange) return;
    if (status === "pending") {
      onPendingCountChange(requests.length);
    }
  }, [requests, status, onPendingCountChange]);

  // Flash mesajı temizle
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
            <Inbox size={16} /> Marka Başvuruları
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {requests.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            B2B marka self-servis kayıt başvuruları · onaylayınca marka + kullanıcı + PIN otomatik
            üretilir
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void load(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCcw size={13} />
            )}
            Yenile
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">
            {toast}
          </div>
        )}
        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Durum
          </p>
          <div
            role="tablist"
            aria-label="Marka başvurusu durum filtresi"
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1"
          >
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
                    active
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  {opt.label}
                  {active && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold tabular-nums text-primary">
                      {requests.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Marka", "İletişim", "Detay", "Tarih", "Durum", "Aksiyonlar"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
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
                      <p className="text-sm">
                        {status === "pending"
                          ? "Bekleyen başvuru yok."
                          : `'${BRAND_REGISTRATION_STATUS_LABELS[status as BrandRegistrationStatus] ?? "Bu filtre"}' için kayıt yok.`}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 align-top transition-colors hover:bg-accent/15"
                >
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-foreground">
                        {r.brandName}
                        {r.shortName ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            ({r.shortName})
                          </span>
                        ) : null}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-violet-300/60 bg-violet-50/50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/35 dark:text-violet-200"
                        >
                          {r.category}
                        </Badge>
                        {r.monthlyVolume && (
                          <Badge variant="outline" className="text-[10px] tabular-nums">
                            {r.monthlyVolume}
                          </Badge>
                        )}
                        {r.preferredUsername && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            @{r.preferredUsername}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <p className="text-foreground font-medium">{r.contactName}</p>
                      <a
                        href={`mailto:${r.contactEmail}`}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Mail size={11} /> {r.contactEmail}
                      </a>
                      {r.contactPhone && (
                        <a
                          href={`tel:${r.contactPhone}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Phone size={11} /> {r.contactPhone}
                        </a>
                      )}
                      {r.telegram && (
                        <a
                          href={`https://t.me/${r.telegram.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Send size={11} /> {r.telegram}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1.5">
                      {r.website && (
                        <a
                          href={r.website.startsWith("http") ? r.website : `https://${r.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          title={r.website}
                        >
                          <Globe size={11} />
                          <span className="max-w-[14rem] truncate">{r.website}</span>
                        </a>
                      )}
                      <NotesCell notes={r.notes ?? ""} />
                      {r.status === "rejected" && r.rejectionReason && (
                        <p className="text-[11px] text-red-600 dark:text-red-300 italic">
                          ↳ {r.rejectionReason}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    <p>{fmtDateTime(r.createdAt)}</p>
                    {r.reviewedAt && (
                      <p className="mt-0.5 text-[10px] opacity-80">
                        İncelendi: {fmtDateTime(r.reviewedAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLS[r.status]}`}>
                      {BRAND_REGISTRATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {r.status === "pending" ? (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setApproveTarget(r)}
                        >
                          <CheckCircle2 size={13} /> Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                          onClick={() => setRejectTarget(r)}
                        >
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
      <Modal
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        title="Marka başvurusunu onayla"
        size="md"
      >
        {approveTarget && (
          <ApproveDialog
            request={approveTarget}
            onClose={() => setApproveTarget(null)}
            onApproved={(resp) => {
              setApproveTarget(null);
              setApproveResp(resp);
              setToast(`✓ ${resp.brand.name} onaylandı ve kullanıcı oluşturuldu.`);
              void load(false);
            }}
          />
        )}
      </Modal>

      {/* Onay sonrası PIN gösterimi */}
      <Modal
        open={approveResp !== null}
        onClose={() => setApproveResp(null)}
        title=""
        size="md"
      >
        {approveResp && (
          <ApproveSuccessDialog resp={approveResp} onClose={() => setApproveResp(null)} />
        )}
      </Modal>

      {/* Red diyaloğu */}
      <Modal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="Marka başvurusunu reddet"
        size="md"
      >
        {rejectTarget && (
          <RejectDialog
            request={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onRejected={() => {
              setToast(`✓ ${rejectTarget.brandName} başvurusu reddedildi.`);
              setRejectTarget(null);
              void load(false);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
