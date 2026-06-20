"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plug,
  Plus,
  Loader2,
  RefreshCcw,
  Key,
  Webhook,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createApiKey, fetchIntegrationPanel, saveOperator } from "@/lib/brand-igaming-api";
import { fmtDateTime } from "@/lib/fmt-date";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { OPERATOR_STATUS_LABELS, type BrandOperator } from "@/types/brand-igaming";

type PanelData = Awaited<ReturnType<typeof fetchIntegrationPanel>>;

type HealthTone = "ok" | "warn" | "idle" | "error";

const TONE_CLS: Record<HealthTone, string> = {
  ok: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
  warn: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  idle: "text-zinc-600 border-zinc-300 bg-zinc-100 dark:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/60",
  error: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
};

const IMPORT_STATUS_TR: Record<string, string> = {
  pending: "Bekliyor",
  processing: "İşleniyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
  partial: "Kısmi",
};

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function deriveWebhookHealth(data: PanelData | null): { label: string; hint: string; tone: HealthTone } {
  const last = data?.lastWebhook;
  if (!last) {
    const hasLogs = (data?.webhookLogs?.length ?? 0) > 0;
    return {
      label: hasLogs ? "Eski veri" : "Beklemede",
      hint: hasLogs ? "Son webhook kaydı eski" : "Operatörden henüz olay gelmedi",
      tone: hasLogs ? "warn" : "idle",
    };
  }
  const age = hoursSince(last.createdAt);
  const ok = age <= 48 && (last.statusCode == null || last.statusCode < 400);
  return {
    label: ok ? "Senkron" : age > 168 ? "Kopuk" : "Gecikmiş",
    hint: `${last.eventType}${last.statusCode != null ? ` · HTTP ${last.statusCode}` : ""} · ${fmtDateTime(last.createdAt)}`,
    tone: ok ? "ok" : last.statusCode != null && last.statusCode >= 400 ? "error" : "warn",
  };
}

function deriveImportHealth(data: PanelData | null): { label: string; hint: string; tone: HealthTone } {
  const last = data?.lastImport;
  if (!last) {
    return { label: "Veri yok", hint: "CSV veya API import batch bekleniyor", tone: "idle" };
  }
  const st = last.status.toLowerCase();
  const label = IMPORT_STATUS_TR[st] ?? last.status;
  let tone: HealthTone = "warn";
  if (st === "completed" || st === "success") tone = "ok";
  else if (st === "failed" || st === "error") tone = "error";
  return {
    label,
    hint: `${last.source} · ${last.rowsImported} satır · ${fmtDateTime(last.createdAt)}`,
    tone,
  };
}

function deriveApiHealth(data: PanelData | null): { label: string; hint: string; tone: HealthTone } {
  const n = data?.apiKeys?.length ?? 0;
  if (n === 0) return { label: "Anahtar yok", hint: "Webhook doğrulaması için API anahtarı oluşturun", tone: "warn" };
  return { label: "Hazır", hint: `${n} aktif anahtar`, tone: "ok" };
}

const OPERATOR_STATUS_CLS: Record<BrandOperator["status"], string> = {
  active: TONE_CLS.ok,
  paused: TONE_CLS.warn,
  closed: TONE_CLS.idle,
};

const emptyOperatorForm = {
  id: "",
  name: "",
  apiBaseUrl: "",
  currency: "USD" as BrandOperator["currency"],
  status: "active" as BrandOperator["status"],
  notes: "",
};

function HealthIcon({ tone }: { tone: HealthTone }) {
  if (tone === "ok") return <CheckCircle2 size={18} className="text-emerald-600" />;
  if (tone === "error") return <AlertTriangle size={18} className="text-red-600" />;
  if (tone === "warn") return <AlertTriangle size={18} className="text-amber-600" />;
  return <Clock size={18} className="text-muted-foreground" />;
}

export default function MarkaEntegrasyonPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [operatorForm, setOperatorForm] = useState(emptyOperatorForm);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchIntegrationPanel(brandId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Entegrasyon verisi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const webhookHealth = useMemo(() => deriveWebhookHealth(data), [data]);
  const importHealth = useMemo(() => deriveImportHealth(data), [data]);
  const apiHealth = useMemo(() => deriveApiHealth(data), [data]);

  const genKey = async () => {
    if (!brandId) return;
    setBusy(true);
    try {
      const r = await createApiKey(brandId, "portal", selectedOperatorId || undefined);
      setNewKey(r.key);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anahtar oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  const submitOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) return;
    setBusy(true);
    try {
      await saveOperator({
        ...operatorForm,
        id: operatorForm.id || undefined,
        brandId,
        apiBaseUrl: operatorForm.apiBaseUrl.trim() || undefined,
      });
      setOperatorOpen(false);
      setOperatorForm(emptyOperatorForm);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operatör kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const firstOperatorId = data?.operators?.[0]?.id;
  const webhookEndpointHint =
    brandId && (selectedOperatorId || firstOperatorId || brandId)
      ? `/api/marka/igaming/webhooks/${selectedOperatorId || firstOperatorId || "{operatorId}"}/events`
      : null;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1100px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Plug size={22} /> Entegrasyon sağlığı
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Operatör webhook senkronu, import batch durumu ve API erişim anahtarları
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={13} /> Yenile
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {newKey && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-500/45 dark:bg-amber-950/40">
            Yeni API anahtarı (yalnızca bir kez gösterilir):{" "}
            <code className="font-mono">{newKey}</code>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Webhook senkron", icon: Webhook, health: webhookHealth },
            { title: "Import senkron", icon: Database, health: importHealth },
            { title: "API erişimi", icon: Key, health: apiHealth },
          ].map(({ title, icon: Icon, health }) => (
            <Card key={title}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="rounded-lg border border-border p-2">
                  <Icon size={16} className="text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <HealthIcon tone={health.tone} />
                    <p className="font-semibold">{health.label}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{health.hint}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity size={15} /> Senkron özeti
            </CardTitle>
            <CardDescription>
              Veriler <code className="text-[11px]">/api/marka/igaming/integration</code> üzerinden okunur
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Son webhook</p>
              {data?.lastWebhook ? (
                <p className="mt-1 font-medium">
                  {data.lastWebhook.eventType}
                  {data.lastWebhook.statusCode != null && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {data.lastWebhook.statusCode}
                    </Badge>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">Kayıt yok</p>
              )}
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Son import</p>
              {data?.lastImport ? (
                <p className="mt-1 font-medium">
                  {IMPORT_STATUS_TR[data.lastImport.status.toLowerCase()] ?? data.lastImport.status} ·{" "}
                  {data.lastImport.source}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">Batch yok</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database size={15} /> Operatörler
            </CardTitle>
            <CardDescription>
              Lisanslı operatör bağlantıları — webhook URL&apos;leri operatör kimliğine göre oluşturulur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!readOnly && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => { setOperatorForm(emptyOperatorForm); setOperatorOpen(true); }}
              >
                <Plus size={13} /> Operatör ekle
              </Button>
            )}
            {loading ? (
              <Loader2 className="mx-auto animate-spin opacity-50" />
            ) : (data?.operators ?? []).length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Henüz operatör tanımlı değil. Webhook entegrasyonu için en az bir operatör ekleyin.
              </p>
            ) : (
              <div className="space-y-2">
                {data!.operators.map((op) => (
                  <div key={op.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{op.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${OPERATOR_STATUS_CLS[op.status as BrandOperator["status"]] ?? TONE_CLS.idle}`}>
                        {OPERATOR_STATUS_LABELS[op.status as BrandOperator["status"]] ?? op.status}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{op.id}</p>
                    {op.apiBaseUrl && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{op.apiBaseUrl}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{op.currency}{op.notes ? ` · ${op.notes}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Key size={15} /> API anahtarları
              </CardTitle>
              <CardDescription>Operatör REST ve webhook doğrulama</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  {(data?.operators ?? []).length > 0 && (
                    <Select
                      value={selectedOperatorId}
                      onChange={(e) => setSelectedOperatorId(e.target.value)}
                      options={[
                        { value: "", label: "Operatör (opsiyonel)" },
                        ...(data?.operators ?? []).map((op) => ({ value: op.id, label: op.name })),
                      ]}
                    />
                  )}
                  <Button size="sm" className="gap-1.5" onClick={() => void genKey()} disabled={busy}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Anahtar oluştur
                  </Button>
                </div>
              )}
              {loading ? (
                <Loader2 className="mx-auto animate-spin opacity-50" />
              ) : (data?.apiKeys ?? []).length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Aktif anahtar yok.</p>
              ) : (
                data!.apiKeys.map((k) => (
                  <div key={k.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-medium">{k.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {k.keyPrefix}… · {(k.scopes ?? []).join(", ")}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database size={15} /> Import geçmişi
              </CardTitle>
              <CardDescription>Son {data?.importBatches?.length ?? 0} batch</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="mx-auto animate-spin opacity-50" />
              ) : (data?.importBatches ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz import batch yok.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {data!.importBatches.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{b.source}</p>
                        <p className="text-xs text-muted-foreground">{b.rowsImported} satır</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={`text-[10px] ${TONE_CLS[b.status === "completed" ? "ok" : b.status === "failed" ? "error" : "warn"]}`}>
                          {IMPORT_STATUS_TR[b.status.toLowerCase()] ?? b.status}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(b.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook size={15} /> Webhook logları
            </CardTitle>
            <CardDescription>
              Son {data?.webhookLogs?.length ?? 0} olay · liste entegrasyon API&apos;sinde
            </CardDescription>
          </CardHeader>
          <CardContent>
            {webhookEndpointHint && (
              <p className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                POST {webhookEndpointHint}
              </p>
            )}
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto animate-spin opacity-50" />
              </div>
            ) : (data?.webhookLogs ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <Webhook className="mx-auto mb-2 opacity-30" size={28} />
                <p className="text-sm font-medium text-muted-foreground">Henüz webhook logu yok</p>
                <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
                  Operatörünüz kayıt, FTD veya yatırım olaylarını webhook URL&apos;ine POST ettiğinde
                  burada senkron durumu ve hata kodları listelenir. Ayrı bir webhook listesi API&apos;si
                  yok; loglar entegrasyon uç noktasından gelir.
                </p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {data!.webhookLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{l.eventType}</p>
                      {l.error && <p className="text-xs text-red-600">{l.error}</p>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {l.statusCode != null && (
                        <Badge
                          variant="outline"
                          className={`mb-1 text-[10px] ${l.statusCode >= 400 ? TONE_CLS.error : TONE_CLS.ok}`}
                        >
                          {l.statusCode}
                        </Badge>
                      )}
                      <p>{fmtDateTime(l.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {!readOnly && (
        <Modal open={operatorOpen} onClose={() => setOperatorOpen(false)} title="Operatör ekle" size="md">
          <form onSubmit={submitOperator} className="space-y-4">
            <FormGrid>
              <Field label="Ad" required>
                <Input value={operatorForm.name} onChange={(e) => setOperatorForm((f) => ({ ...f, name: e.target.value }))} placeholder="Örn. Platform API" />
              </Field>
              <Field label="Durum">
                <Select value={operatorForm.status} onChange={(e) => setOperatorForm((f) => ({ ...f, status: e.target.value as BrandOperator["status"] }))}
                  options={Object.entries(OPERATOR_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
              </Field>
              <Field label="API base URL">
                <Input value={operatorForm.apiBaseUrl} onChange={(e) => setOperatorForm((f) => ({ ...f, apiBaseUrl: e.target.value }))} placeholder="https://api.operator.com" />
              </Field>
              <Field label="Para birimi">
                <Select value={operatorForm.currency} onChange={(e) => setOperatorForm((f) => ({ ...f, currency: e.target.value as BrandOperator["currency"] }))}
                  options={[{ value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "TRY", label: "TRY" }]} />
              </Field>
            </FormGrid>
            <Field label="Notlar"><Textarea value={operatorForm.notes} onChange={(e) => setOperatorForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
            <FormActions onCancel={() => setOperatorOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
          </form>
        </Modal>
      )}
    </MarkaPageGuard>
  );
}
