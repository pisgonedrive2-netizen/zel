"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, ArrowDownRight, ArrowUpRight, Search,
  Wallet, ExternalLink, Copy, Check, AlertCircle, TrendingDown, Hash,
  Banknote, Archive,
} from "lucide-react";
import {
  useStore, calcKasaBalance,
  type Kasa, type KasaTransaction, DEFAULT_KASA_ID,
} from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { fmt } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input as UInput } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ProofUploader } from "@/components/proof-uploader";
import { MonthlyExportMenu } from "@/components/monthly-export-menu";
import {
  exportKasaMonthCsv,
  exportKasaMonthPdf,
  listAvailableMonths,
} from "@/lib/monthly-exports";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

function fmtUsdt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " USDT";
}
function shortTxid(t?: string) {
  if (!t) return null;
  if (t.startsWith("http")) return t.length > 40 ? t.slice(0, 40) + "…" : t;
  if (t.length <= 16) return t;
  return t.slice(0, 8) + "…" + t.slice(-6);
}

const KASA_KIND_OPTIONS: Array<{ value: Kasa["kind"]; label: string }> = [
  { value: "general", label: "Genel" },
  { value: "usdt",    label: "USDT cüzdan" },
  { value: "bank",    label: "Banka hesabı" },
  { value: "cash",    label: "Nakit" },
  { value: "other",   label: "Diğer" },
];

// ── Copy button ───────────────────────────────────────────────────────────
function Copyable({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1200); }}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono"
      title={text}>
      {shortTxid(text)}{c ? <Check size={11} className="text-green-600" /> : <Copy size={11} className="opacity-40" />}
    </button>
  );
}

// ── Kasa hesabı (account) form ────────────────────────────────────────────
function KasaAccountForm({
  initial, onSave, onDelete, onClose,
}: {
  initial?: Kasa;
  onSave: (k: Omit<Kasa, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Kasa, "id">>({
    name: initial?.name ?? "",
    kind: initial?.kind ?? "general",
    currency: initial?.currency ?? "USD",
    isDefault: initial?.isDefault ?? false,
    archived: initial?.archived ?? false,
    orderIndex: initial?.orderIndex ?? 0,
    notes: initial?.notes ?? "",
    tronAddress: initial?.tronAddress ?? "",
    tronSyncFrom: initial?.tronSyncFrom ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Kasa adı" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Örn. USDT Tron, Banka, Nakit" />
          </Field>
          <Field label="Tür">
            <Select
              value={form.kind}
              onChange={(e) => set("kind", e.target.value as Kasa["kind"])}
              options={KASA_KIND_OPTIONS}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Para birimi (etiket)" hint="Hesaplamalar USD bazında; bu sadece görüntüleme içindir.">
            <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} placeholder="USD / USDT / TRY" />
          </Field>
          <Field label="Sıra (küçük olan üstte)">
            <NumberInput value={form.orderIndex} onChange={(v) => set("orderIndex", v)} min={0} step={1} />
          </Field>
        </FormGrid>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Bu kasanın amacı, sahibi vb." />
        </Field>
        <FormGrid>
          <Field label="TRON adresi (TRC20)" hint="USDT cüzdan adresi — otomatik hareket çekimi">
            <Input
              value={form.tronAddress ?? ""}
              onChange={(e) => set("tronAddress", e.target.value)}
              placeholder="T..."
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Takip başlangıç tarihi">
            <Input
              type="date"
              value={form.tronSyncFrom ?? ""}
              onChange={(e) => set("tronSyncFrom", e.target.value)}
            />
          </Field>
        </FormGrid>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={form.isDefault}
              onChange={(e) => set("isDefault", e.target.checked)}
            />
            Varsayılan kasa
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={form.archived}
              onChange={(e) => set("archived", e.target.checked)}
              disabled={initial?.id === DEFAULT_KASA_ID}
            />
            Arşivle (listelerde gizle)
          </label>
        </div>
      </div>
      <FormActions
        onCancel={onClose}
        onDelete={initial && initial.id !== DEFAULT_KASA_ID ? onDelete : undefined}
        submitLabel={initial ? "Güncelle" : "Kasa Ekle"}
      />
    </form>
  );
}

// ── Kasa hareketi form ────────────────────────────────────────────────────
function KasaForm({ initial, kasas, defaultKasaId, onSave, onDelete, onClose }: {
  initial?: KasaTransaction;
  kasas: Kasa[];
  defaultKasaId: string;
  onSave: (d: Omit<KasaTransaction, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<KasaTransaction, "id">>({
    kasaId:       initial?.kasaId       ?? defaultKasaId,
    date:         initial?.date         ?? new Date().toISOString().slice(0, 16),
    direction:    initial?.direction    ?? "out",
    amountUsd:    initial?.amountUsd    ?? 0,
    feeUsd:       initial?.feeUsd       ?? 0,
    purpose:      initial?.purpose      ?? "",
    counterparty: initial?.counterparty ?? "",
    proof:        initial?.proof        ?? "",
    notes:        initial?.notes        ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Kasa" required>
            <Select
              value={form.kasaId}
              onChange={(e) => set("kasaId", e.target.value)}
              required
              options={kasas
                .filter((k) => !k.archived || k.id === form.kasaId)
                .map((k) => ({ value: k.id, label: k.name }))}
            />
          </Field>
          <Field label="Yön" required>
            <Select value={form.direction} onChange={e => set("direction", e.target.value as KasaTransaction["direction"])} required
              options={[{ value: "in", label: "↓ Gelen (kasaya giriş)" }, { value: "out", label: "↑ Giden (kasadan çıkış)" }]} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Tarih & Saat" required>
            <DateTimePicker mode="datetime" value={form.date} onChange={(v) => set("date", v)} required />
          </Field>
          <Field label="Tutar (USDT)" required>
            <NumberInput value={form.amountUsd} onChange={v => set("amountUsd", v)} required min={0} step={0.01} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Network Fee (USDT)" hint="Genelde ~$4 (TRC20)">
            <NumberInput value={form.feeUsd} onChange={v => set("feeUsd", v)} min={0} step={0.01} />
          </Field>
          <Field label="Karşı Taraf" hint='Alıcı veya gönderici (ör. "Lucy", "TronScan adresi")'>
            <Input value={form.counterparty} onChange={e => set("counterparty", e.target.value)} placeholder="İsim / cüzdan" />
          </Field>
        </FormGrid>
        <Field label="Amaç / Açıklama" required>
          <Input value={form.purpose} onChange={e => set("purpose", e.target.value)} required placeholder="Ödeme sebebi" />
        </Field>
        <Field label="Kanıt (TXID / Dekont / Ekran görüntüsü)" hint="TXID, URL veya doğrudan resim yükle">
          <ProofUploader
            value={form.proof}
            onChange={(v) => set("proof", v)}
            folder="kasa"
            placeholder="TXID, https://... veya resim yükle"
          />
        </Field>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Ek bilgi..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "İşlem Ekle"} />
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function KasaPage() {
  const {
    kasas, kasaTransactions,
    addKasa, updateKasa, deleteKasa,
    addKasaTransaction, updateKasaTransaction, deleteKasaTransaction,
  } = useStore();
  const { user } = useAuth();
  const readOnly = useIsReadOnly();
  const [modal, setModal]               = useState<"new" | KasaTransaction | null>(null);
  const [kasaModal, setKasaModal]       = useState<"new" | Kasa | null>(null);
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState<"all" | "in" | "out">("all");
  const [selectedKasaId, setSelectedKasaId] = useState<string | "all">("all");
  const [tronSyncing, setTronSyncing] = useState(false);

  const selectedKasa = useMemo(
    () => (selectedKasaId === "all" ? null : kasas.find((k) => k.id === selectedKasaId)),
    [kasas, selectedKasaId]
  );

  const syncTronForKasa = async () => {
    if (!selectedKasa?.tronAddress || !selectedKasa.tronSyncFrom) {
      window.alert("Önce kasa ayarlarından TRON adresi ve başlangıç tarihi kaydedin.");
      return;
    }
    setTronSyncing(true);
    try {
      const res = await fetch("/api/kasa/tron-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kasaId: selectedKasa.id }),
      });
      const json = (await res.json()) as { ok?: boolean; imported?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Senkron başarısız");
      const boot = await fetch("/api/bootstrap", { credentials: "include" });
      if (boot.ok) {
        const data = (await boot.json()) as { kasaTransactions?: typeof kasaTransactions };
        if (data.kasaTransactions) {
          useStore.setState({ kasaTransactions: data.kasaTransactions });
        }
      }
      window.alert(`${json.imported ?? 0} yeni TRON hareketi eklendi. Açıklama ve detayları düzenleyebilirsiniz.`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "TRON senkron hatası");
    } finally {
      setTronSyncing(false);
    }
  };

  const visibleKasas = useMemo(
    () => [...kasas].sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name)),
    [kasas]
  );

  const defaultKasaId = useMemo(() => {
    const explicit = visibleKasas.find((k) => k.isDefault && !k.archived);
    if (explicit) return explicit.id;
    const firstActive = visibleKasas.find((k) => !k.archived);
    return firstActive?.id ?? DEFAULT_KASA_ID;
  }, [visibleKasas]);

  const txnsForSelected = useMemo(
    () => selectedKasaId === "all"
      ? kasaTransactions
      : kasaTransactions.filter((t) => t.kasaId === selectedKasaId),
    [kasaTransactions, selectedKasaId]
  );

  const availableMonths = useMemo(
    () => listAvailableMonths(txnsForSelected.map((t) => t.date)),
    [txnsForSelected]
  );
  const currentYm = availableMonths[0] ?? new Date().toISOString().slice(0, 7);

  const openingBalanceFor = (ym: string) =>
    txnsForSelected
      .filter((t) => t.date < ym + "-01T00:00")
      .reduce((b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd), 0);

  const canExport = user?.role === "admin" || user?.role === "auditor";

  const sorted = useMemo(
    () => [...txnsForSelected].sort((a, b) => a.date.localeCompare(b.date)),
    [txnsForSelected]
  );

  const withBalance = useMemo(() => {
    let bal = 0;
    return sorted.map(t => {
      bal = t.direction === "in" ? bal + t.amountUsd : bal - t.amountUsd - t.feeUsd;
      return { ...t, balanceAfter: bal };
    });
  }, [sorted]);

  const filteredRows = useMemo(() => {
    return [...withBalance].reverse().filter(t =>
      (filter === "all" || t.direction === filter) &&
      (search === "" ||
        t.purpose.toLowerCase().includes(search.toLowerCase()) ||
        t.counterparty.toLowerCase().includes(search.toLowerCase()) ||
        t.notes.toLowerCase().includes(search.toLowerCase()))
    );
  }, [withBalance, filter, search]);

  const currentBalance = useMemo(
    () => selectedKasaId === "all"
      ? calcKasaBalance(kasaTransactions)
      : calcKasaBalance(kasaTransactions, undefined, selectedKasaId),
    [kasaTransactions, selectedKasaId]
  );
  const totalIn        = txnsForSelected.filter(t => t.direction === "in").reduce((s, t) => s + t.amountUsd, 0);
  const totalOut       = txnsForSelected.filter(t => t.direction === "out").reduce((s, t) => s + t.amountUsd + t.feeUsd, 0);
  const totalFees      = txnsForSelected.reduce((s, t) => s + t.feeUsd, 0);

  const balanceSeries = useMemo(() => {
    return withBalance.map(t => ({
      date: t.date.slice(0, 10),
      balance: Math.round(t.balanceAfter * 100) / 100,
    }));
  }, [withBalance]);

  // Her kasa için özet kart verisi.
  const perKasaSummary = useMemo(
    () => visibleKasas
      .filter((k) => !k.archived)
      .map((k) => ({
        kasa: k,
        balance: calcKasaBalance(kasaTransactions, undefined, k.id),
        count:   kasaTransactions.filter((t) => t.kasaId === k.id).length,
      })),
    [visibleKasas, kasaTransactions]
  );

  const kasaNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kasas) m.set(k.id, k.name);
    return m;
  }, [kasas]);

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kasa Hareketleri</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Çoklu kasa desteği · maaş/gider ödemeleri seçili kasadan otomatik düşülür
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <MonthlyExportMenu
              month={currentYm}
              availableMonths={availableMonths}
              label="Aylık rapor"
              onExportPdf={(ym) =>
                exportKasaMonthPdf(txnsForSelected, ym, {
                  openingBalance: openingBalanceFor(ym),
                  generatedBy: user?.name,
                })
              }
              onExportCsv={(ym) =>
                exportKasaMonthCsv(txnsForSelected, ym, {
                  openingBalance: openingBalanceFor(ym),
                  generatedBy: user?.name,
                })
              }
            />
          )}
          {!readOnly && (
            <>
              <Button size="sm" variant="outline" onClick={() => setKasaModal("new")} className="gap-1.5">
                <Banknote size={14} /> Yeni Kasa
              </Button>
              <Button size="sm" onClick={() => setModal("new")} className="gap-1.5">
                <Plus size={14} /> İşlem Ekle
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Kasa seçici */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedKasaId("all")}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
            selectedKasaId === "all"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
          }`}
        >
          Tümü ({fmtUsdt(calcKasaBalance(kasaTransactions))})
        </button>
        {perKasaSummary.map(({ kasa, balance, count }) => (
          <button
            key={kasa.id}
            onClick={() => setSelectedKasaId(kasa.id)}
            onDoubleClick={() => !readOnly && setKasaModal(kasa)}
            title={!readOnly ? "Çift tıklayarak düzenle" : undefined}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors inline-flex items-center gap-1.5 ${
              selectedKasaId === kasa.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
            }`}
          >
            {kasa.isDefault && <span className="text-[10px] opacity-70">★</span>}
            {kasa.name}
            <span className="opacity-70 tabular-nums">· {fmtUsdt(balance)}</span>
            <span className="opacity-50 text-[10px]">({count})</span>
          </button>
        ))}
        {visibleKasas.some((k) => k.archived) && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 ml-2">
            <Archive size={11} /> {visibleKasas.filter((k) => k.archived).length} arşivli
          </span>
        )}
        {selectedKasa?.tronAddress && !readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={tronSyncing}
            onClick={() => void syncTronForKasa()}
          >
            {tronSyncing ? "Çekiliyor…" : "TRON hareketlerini çek"}
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="border border-blue-200 dark:border-blue-500/40 rounded-xl px-4 py-3 bg-gradient-to-br from-blue-50/60 to-blue-50/20 dark:from-blue-950/50 dark:to-blue-950/20">
          <p className="text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Wallet size={11} /> {selectedKasaId === "all" ? "Toplam Kasa" : "Seçili Kasa Bakiyesi"}
          </p>
          <p className="text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">{fmtUsdt(currentBalance)}</p>
        </div>
        {[
          { label: "Toplam Giriş",     value: fmt(totalIn),       cls: "text-green-600 dark:text-green-400",   icon: ArrowDownRight },
          { label: "Toplam Çıkış",     value: fmt(totalOut),      cls: "text-red-600 dark:text-red-400",     icon: ArrowUpRight },
          { label: "Toplam Network Fee", value: fmt(totalFees),   cls: "text-amber-600 dark:text-amber-400",   icon: TrendingDown },
        ].map(k => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <k.icon size={11} /> {k.label}
            </p>
            <p className={`text-2xl tabular-nums font-bold ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bakiye Trend */}
      {balanceSeries.length > 0 && (
        <Card className="mb-6 gap-2 py-5">
          <CardHeader>
            <CardTitle>Bakiye Trendi</CardTitle>
            <CardDescription>Her işlem sonrası kasa bakiyesi {selectedKasaId !== "all" && `· ${kasaNameById.get(selectedKasaId) ?? ""}`}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={balanceSeries}>
                <defs>
                  <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                <RTooltip formatter={(v: number) => fmtUsdt(v)}
                  contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} fill="url(#bal)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Kurallar */}
      <div className="mb-4 px-4 py-3 rounded-xl border border-border bg-muted/40">
        <p className="text-sm text-foreground font-medium mb-1 flex items-center gap-1.5">
          <AlertCircle size={13} className="text-muted-foreground" />
          Harcama Rapor Formatı
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium">Harcanan Tutar</span> · <span className="font-medium">Tarih</span> ·
          <span className="font-medium"> Amaç</span> · <span className="font-medium">Kanıt</span> (Dekont / TRC20 TXID / Ekran).
          Maaş ödemeleri ve diğer planlı giderler ilgili kasadan otomatik düşülür.
        </p>
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(["all", "in", "out"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}>
              {f === "all" ? "Tümü" : f === "in" ? "Gelen" : "Giden"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <UInput aria-label="Kasa işlemi ara" placeholder="İşlem ara..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-8 text-sm pl-8" />
        </div>
        <p className="text-xs text-muted-foreground ml-auto">
          {filteredRows.length} / {txnsForSelected.length} işlem
        </p>
      </div>

      {/* Tablo */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Tarih","Kasa","Yön","Tutar","Fee","Amaç","Karşı Taraf","Kanıt","Bakiye",""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(t => (
                <tr key={t.id} className="border-b border-border/60 hover:bg-accent/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {t.date.slice(0, 10)}<br />
                    <span className="text-[10px] opacity-60">{t.date.slice(11, 16)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {kasaNameById.get(t.kasaId) ?? t.kasaId}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {t.direction === "in" ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40 gap-1">
                        <ArrowDownRight size={10} /> Gelen
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40 gap-1">
                        <ArrowUpRight size={10} /> Giden
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-medium whitespace-nowrap">
                    <span className={t.direction === "in" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                      {t.direction === "in" ? "+" : "−"}{fmt(t.amountUsd)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-xs whitespace-nowrap">
                    {t.feeUsd > 0 ? <span className="text-amber-600 dark:text-amber-400">−{fmt(t.feeUsd)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <p className="text-sm text-foreground font-medium">{t.purpose}</p>
                    {t.notes && <p className="text-[11px] text-muted-foreground truncate max-w-[300px]">{t.notes}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{t.counterparty || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {t.proof ? (
                      t.proof.startsWith("http") ? (
                        <a href={t.proof} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs">
                          Aç <ExternalLink size={10} />
                        </a>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <Hash size={10} className="text-muted-foreground" />
                          <Copyable text={t.proof} />
                        </div>
                      )
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-bold whitespace-nowrap text-foreground">
                    {fmt(t.balanceAfter)}
                  </td>
                  <td className="px-3 py-2.5">
                    {!readOnly && (
                      <button onClick={() => setModal(t)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                        <Pencil size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Filtreyle eşleşen işlem yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal === "new" ? "Yeni Kasa İşlemi" : "İşlemi Düzenle"} size="lg">
        {modal && (
          <KasaForm
            initial={modal === "new" ? undefined : modal}
            kasas={visibleKasas}
            defaultKasaId={selectedKasaId !== "all" ? selectedKasaId : defaultKasaId}
            onSave={d => { if (modal === "new") addKasaTransaction(d); else updateKasaTransaction(modal.id, d); }}
            onDelete={modal !== "new" ? () => { deleteKasaTransaction(modal.id); setModal(null); } : undefined}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={kasaModal !== null} onClose={() => setKasaModal(null)}
        title={kasaModal === "new" ? "Yeni Kasa Hesabı" : "Kasayı Düzenle"} size="md">
        {kasaModal && (
          <KasaAccountForm
            initial={kasaModal === "new" ? undefined : kasaModal}
            onSave={(d) => {
              if (kasaModal === "new") addKasa(d);
              else updateKasa(kasaModal.id, d);
            }}
            onDelete={
              kasaModal !== "new" && kasaModal.id !== DEFAULT_KASA_ID
                ? () => { deleteKasa(kasaModal.id); setKasaModal(null); }
                : undefined
            }
            onClose={() => setKasaModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
