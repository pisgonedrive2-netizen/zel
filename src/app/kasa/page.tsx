"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Plus, Pencil, ArrowDownRight, ArrowUpRight, Search,
  Wallet, ExternalLink, Copy, Check, AlertCircle, TrendingDown, Hash,
  Banknote, Archive, Link2, Activity, CalendarRange, FileSpreadsheet, FileText, RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useStore, calcKasaBalance,
  type Kasa, type KasaTransaction, DEFAULT_KASA_ID,
} from "@/store/store";
import {
  computeTronPanelMetrics,
  getKasaDisplayBalance,
  isTronGenelToggleable,
  sumKasaDisplayBalances,
} from "@/lib/kasa-tron-metrics";
import {
  isTronReflectedInGenelView,
  transactionsForGenelKasaView,
} from "@/lib/kasa-genel-view";
import { useAuth, useIsReadOnly } from "@/store/auth";
import {
  canViewRamizWallet,
  filterKasasForRamizViewer,
  filterKasaTransactionsForRamizViewer,
  isRamizTronAddress,
} from "@/lib/ramiz-wallet-access";
import { refreshNotificationsFromServer } from "@/lib/notification-actions";
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
  exportKasaRangeCsv,
  exportKasaRangePdf,
  listAvailableMonths,
} from "@/lib/monthly-exports";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

function fmtUsdt(n: number) {
  return fmtToken(n, "USDT");
}
function fmtToken(n: number, symbol: string) {
  return (
    n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) +
    ` ${symbol}`
  );
}
function shortTxid(t?: string) {
  if (!t) return null;
  if (t.startsWith("http")) return t.length > 40 ? t.slice(0, 40) + "…" : t;
  if (t.length <= 16) return t;
  return t.slice(0, 8) + "…" + t.slice(-6);
}

/** TRON (TRC20) base58 cüzdan adresi mi? (T ile başlar, 34 karakter) */
function looksLikeTronAddress(v?: string): boolean {
  if (!v) return false;
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v.trim());
}
/** Adresi maskeler: ilk 4 + son 4 görünür, ortası gizli. */
function maskTronAddress(v: string): string {
  const s = v.trim();
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

const KASA_KIND_OPTIONS: Array<{ value: Kasa["kind"]; label: string }> = [
  { value: "general", label: "Genel" },
  { value: "usdt",    label: "USDT cüzdan" },
  { value: "bank",    label: "Banka hesabı" },
  { value: "cash",    label: "Nakit" },
  { value: "other",   label: "Diğer" },
];

// ── Satır içi karşı taraf düzenleme ───────────────────────────────────────
function InlineCounterparty({
  value,
  readOnly,
  onSave,
  canRevealTron = false,
}: {
  value: string;
  readOnly: boolean;
  onSave: (next: string) => void;
  /** Ramiz TRON adresini gösterme yetkisi (Orkun / Ediz). */
  canRevealTron?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const isAddress = looksLikeTronAddress(value);
  const hideRamizAddress = isAddress && isRamizTronAddress(value) && !canRevealTron;

  // Güvenlik: çekilen/gönderilen TRON cüzdan adresleri varsayılan olarak blurlanır.
  if (isAddress && !editing && !hideRamizAddress) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className={`font-mono text-xs text-muted-foreground transition-all ${revealed ? "" : "select-none blur-[5px] hover:blur-[4px]"}`}
          title={revealed ? "Gizlemek için tıkla" : "Güvenlik için gizli — görmek için tıkla"}
          aria-label={revealed ? "Adresi gizle" : "Adresi göster"}
        >
          {revealed ? maskTronAddress(value) : "T••••••••"}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground/50 hover:text-foreground"
            title="Etiket gir (ör. isim)"
            aria-label="Etiketle"
          >
            <Pencil size={10} />
          </button>
        )}
      </span>
    );
  }

  if (hideRamizAddress && !editing) {
    return <span className="text-xs text-muted-foreground italic">TRON cüzdan</span>;
  }

  if (readOnly) {
    return <span className="text-xs text-muted-foreground">{value || "—"}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group text-left text-xs text-muted-foreground hover:text-foreground max-w-[160px] truncate"
        title={value ? `${value} — düzenlemek için tıkla` : "Kime gitti? — tıkla ve yaz"}
      >
        {value || <span className="italic text-amber-700/80 dark:text-amber-300/90">Kime gitti?</span>}
        <Pencil size={10} className="inline ml-1 opacity-0 group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() !== value.trim()) onSave(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      placeholder="Alıcı / gönderici"
      className="h-7 w-full min-w-[120px] max-w-[200px] rounded border border-border bg-background px-2 text-xs"
    />
  );
}

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
  initial,
  txCount = 0,
  onSave,
  onArchive,
  onForceDelete,
  onClose,
}: {
  initial?: Kasa;
  txCount?: number;
  onSave: (k: Omit<Kasa, "id">) => void;
  onArchive?: () => void;
  onForceDelete?: () => void;
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
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Bu kasanın amacı, sahibi vb."
          />
        </Field>
        <FormGrid>
          <Field
            label="TRON adresi (TRC20)"
            hint={
              form.kind === "usdt"
                ? "USDT cüzdan — otomatik hareket çekimi bu kasaya yazılır"
                : "Yalnızca USDT cüzdan kasasında kullanın; test/genel kasalara yazmayın"
            }
          >
            <Input
              value={form.tronAddress ?? ""}
              onChange={(e) => set("tronAddress", e.target.value)}
              placeholder={form.kind === "usdt" ? "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE" : "—"}
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
      {initial && initial.id !== DEFAULT_KASA_ID && (onArchive || onForceDelete) && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs space-y-2">
          <p className="font-medium text-destructive">Kasa yönetimi</p>
          {txCount > 0 ? (
            <p className="text-muted-foreground leading-snug">
              Bu kasada <strong className="text-foreground">{txCount}</strong> hareket var.
              Arşivlerseniz listeden gizlenir; kalıcı silme tüm hareketleri de siler.
            </p>
          ) : (
            <p className="text-muted-foreground">Hareket yok — test kasayı güvenle silebilirsiniz.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {onArchive && (
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onArchive}>
                <Archive size={12} /> Arşivle
              </Button>
            )}
            {onForceDelete && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 text-xs gap-1"
                onClick={onForceDelete}
              >
                <Trash2 size={12} />
                {txCount > 0 ? "Kalıcı sil" : "Sil"}
              </Button>
            )}
          </div>
        </div>
      )}
      <FormActions onCancel={onClose} submitLabel={initial ? "Güncelle" : "Kasa Ekle"} />
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
    autoImported: initial?.autoImported,
    tronTxId:     initial?.tronTxId,
    plannedItemId: initial?.plannedItemId,
    countInGenel: initial?.countInGenel ?? false,
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
        {(() => {
          const selectedKasaRow = kasas.find((k) => k.id === form.kasaId);
          const canGenelToggle =
            form.direction === "out" || Boolean(selectedKasaRow?.tronAddress?.trim());
          if (!canGenelToggle) return null;
          return (
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={Boolean(form.countInGenel)}
                onChange={(e) => set("countInGenel", e.target.checked)}
              />
              {form.direction === "in"
                ? "Genel Kasa / işletme gelirine dahil et"
                : "Genel Kasa / işletme giderine de dahil et"}
            </label>
          );
        })()}
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
    bulkSetKasaCountInGenel,
  } = useStore();
  const { user } = useAuth();
  const readOnly = useIsReadOnly();
  const canRamizWallet = canViewRamizWallet(user);
  const viewKasas = useMemo(
    () => filterKasasForRamizViewer(kasas, canRamizWallet),
    [kasas, canRamizWallet],
  );
  const viewKasaTransactions = useMemo(
    () => filterKasaTransactionsForRamizViewer(kasaTransactions, canRamizWallet),
    [kasaTransactions, canRamizWallet],
  );
  const [modal, setModal]               = useState<"new" | KasaTransaction | null>(null);
  const [kasaModal, setKasaModal]       = useState<"new" | Kasa | null>(null);
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState<"all" | "in" | "out">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "tron-auto" | "manual">("all");
  const [genelFilter, setGenelFilter] = useState<"all" | "included" | "excluded">("all");
  const [genelToggleBusy, setGenelToggleBusy] = useState<string | null>(null);

  const toggleGenelInclusion = useCallback(
    (t: KasaTransaction) => {
      if (readOnly || genelToggleBusy) return;
      const next = !Boolean(t.countInGenel);
      setGenelToggleBusy(t.id);
      bulkSetKasaCountInGenel([t.id], next);
      setGenelToggleBusy(null);
    },
    [readOnly, genelToggleBusy, bulkSetKasaCountInGenel],
  );

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [tronGenelCutoff, setTronGenelCutoff] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  // Tablo yatay kaydırması: üstteki ve alttaki çubuğu senkronize tut.
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const syncFromTable = useCallback(() => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }, []);
  const syncFromTop = useCallback(() => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  }, []);
  const [selectedKasaId, setSelectedKasaId] = useState<string | "all">("all");
  const [tronSyncing, setTronSyncing] = useState(false);
  const [tronTxView, setTronTxView] = useState<"all" | "ops" | "local">("all");
  const [tronResyncFrom, setTronResyncFrom] = useState("");
  const [tronInfo, setTronInfo] = useState<{
    apiKeySet: boolean;
    watchAddress: string | null;
    watchSyncFrom: string | null;
    watchLabel: string;
    watchSource: string | null;
    tronAddress: string | null;
    tronSyncFrom: string | null;
    envAddress: string;
    probeOk: boolean;
    probeMessage: string;
    probeLatencyMs: number;
    walletBalances: {
      trx: number;
      usdt: number;
      usdc: number;
      fetchedAt: string;
    } | null;
  } | null>(null);
  const [tronInfoLoading, setTronInfoLoading] = useState(false);

  const loadTronInfo = useCallback(async () => {
    setTronInfoLoading(true);
    try {
      const r = await fetch("/api/kasa/tron-info", { credentials: "include" });
      const j = r.ok ? await r.json() : null;
      if (j?.ok) setTronInfo(j);
    } catch {
      /* ignore */
    } finally {
      setTronInfoLoading(false);
    }
  }, []);

  const refreshWalletBalances = useCallback(async (address: string) => {
    const addr = address.trim();
    if (!addr) return;
    setTronInfoLoading(true);
    try {
      const r = await fetch(
        `/api/kasa/tron-balances?address=${encodeURIComponent(addr)}`,
        { credentials: "include" }
      );
      const j = r.ok ? await r.json() : null;
      if (j?.ok && j.balances) {
        setTronInfo((prev) =>
          prev
            ? { ...prev, walletBalances: j.balances }
            : {
                apiKeySet: false,
                watchAddress: null,
                watchSyncFrom: null,
                watchLabel: "",
                watchSource: null,
                tronAddress: addr,
                tronSyncFrom: null,
                envAddress: "",
                probeOk: false,
                probeMessage: "",
                probeLatencyMs: 0,
                walletBalances: j.balances,
              }
        );
      }
    } catch {
      /* ignore */
    } finally {
      setTronInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTronInfo();
  }, [loadTronInfo]);

  const selectedKasa = useMemo(
    () => (selectedKasaId === "all" ? null : kasas.find((k) => k.id === selectedKasaId)),
    [kasas, selectedKasaId]
  );

  const [tronSyncHint, setTronSyncHint] = useState<string | null>(null);

  const syncTronForKasa = async (
    targetKasa?: (typeof kasas)[number],
    opts?: { useResyncFrom?: boolean; recentDays?: number; fullHistory?: boolean }
  ) => {
    const kasa = targetKasa ?? selectedKasa ?? undefined;
    if (!kasa?.tronAddress) {
      window.alert("Önce kasa ayarlarından TRON adresi kaydedin.");
      return;
    }
    if (targetKasa) setSelectedKasaId(targetKasa.id);
    const fromDate =
      opts?.useResyncFrom && (tronResyncFrom || kasa.tronSyncFrom)
        ? tronResyncFrom || kasa.tronSyncFrom
        : kasa.tronSyncFrom;
    if (!fromDate) {
      window.alert("Takip başlangıç tarihi gerekli (kasa ayarları veya geçmiş çekim alanı).");
      return;
    }
    setTronSyncing(true);
    setTronSyncHint(null);
    try {
      const res = await fetch("/api/kasa/tron-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kasaId: kasa.id,
          syncFrom: fromDate,
          tronAddress: kasa.tronAddress,
          tronSyncFrom: kasa.tronSyncFrom || fromDate,
          persistSyncFrom: Boolean(opts?.useResyncFrom),
          forceFromDate: Boolean(opts?.useResyncFrom || opts?.fullHistory),
          recentDays: opts?.recentDays,
          triggeredBy: "kasa-page",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        imported?: number;
        skipped?: number;
        totalIn?: number;
        totalOut?: number;
        balanceUsd?: number;
        outgoingFound?: number;
        error?: string;
        truncated?: boolean;
        hint?: string;
        pagesFetched?: number;
      };
      if (!res.ok || !json.ok) {
        const extra =
          res.status === 429
            ? " TronGrid kota limiti — 2–3 dakika sonra tekrar deneyin."
            : "";
        throw new Error((json.error ?? "Senkron başarısız") + extra);
      }
      const boot = await fetch("/api/bootstrap", { credentials: "include" });
      if (boot.ok) {
        const data = (await boot.json()) as {
          kasaTransactions?: typeof kasaTransactions;
          kasas?: typeof kasas;
        };
        if (data.kasaTransactions) {
          useStore.setState({ kasaTransactions: data.kasaTransactions });
        }
        if (data.kasas) {
          useStore.setState({ kasas: data.kasas });
        }
      }
      if ((json.imported ?? 0) > 0) {
        await refreshNotificationsFromServer();
      }
      const bal = json.balanceUsd != null ? fmtUsdt(json.balanceUsd) : "—";
      setTronSyncHint(
        `${json.imported ?? 0} yeni hareket · bakiye ${bal}` +
          (json.truncated ? " · kısmi çekim (tekrar deneyin)" : "")
      );
      window.alert(
        [
          `${json.imported ?? 0} yeni TRON hareketi eklendi (${json.skipped ?? 0} atlandı).`,
          json.totalIn != null ? `Bu çekimde gelen: +${fmtUsdt(json.totalIn)}` : "",
          json.totalOut != null ? `Bu çekimde giden: −${fmtUsdt(json.totalOut)}` : "",
          json.outgoingFound != null && json.outgoingFound > 0
            ? `${json.outgoingFound} giden USDT hareketi işlendi.`
            : "",
          `Güncel kasa bakiyesi: ${bal}`,
          json.truncated
            ? (json.hint ??
              "Uyarı: Tüm geçmiş tek seferde alınamadı (sayfa limiti). Daha yakın bir başlangıç tarihi seçip tekrar deneyin.")
            : "",
          json.pagesFetched != null ? `TronGrid: ${json.pagesFetched} sayfa okundu.` : "",
          "Satırları listeden düzenleyebilir; bildirim merkezinde özet görünür.",
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TRON senkron hatası";
      setTronSyncHint(msg);
      window.alert(msg);
    } finally {
      setTronSyncing(false);
    }
  };

  const visibleKasas = useMemo(
    () => [...viewKasas].sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name)),
    [viewKasas]
  );

  const defaultKasaId = useMemo(() => {
    const explicit = visibleKasas.find((k) => k.isDefault && !k.archived);
    if (explicit) return explicit.id;
    const firstActive = visibleKasas.find((k) => !k.archived);
    return firstActive?.id ?? DEFAULT_KASA_ID;
  }, [visibleKasas]);

  const tronPanel = useMemo(
    () => (canRamizWallet ? computeTronPanelMetrics(viewKasas, viewKasaTransactions) : null),
    [canRamizWallet, viewKasas, viewKasaTransactions]
  );
  const tronKasa = tronPanel?.tronKasa ?? null;
  const genelKasaId = tronPanel?.genelKasa?.id;

  useEffect(() => {
    if (!canRamizWallet) return;
    const addr = tronPanel?.tronAddress?.trim();
    if (!addr || tronInfo?.walletBalances) return;
    void refreshWalletBalances(addr);
  }, [canRamizWallet, tronPanel?.tronAddress, tronInfo?.walletBalances, refreshWalletBalances]);

  const txnsForSelected = useMemo(() => {
    if (selectedKasaId === "all") return viewKasaTransactions;
    if (genelKasaId && selectedKasaId === genelKasaId) {
      return transactionsForGenelKasaView(
        viewKasaTransactions,
        genelKasaId,
        tronPanel?.tronKasa?.id
      );
    }
    return viewKasaTransactions.filter((t) => t.kasaId === selectedKasaId);
  }, [viewKasaTransactions, selectedKasaId, genelKasaId, tronPanel?.tronKasa?.id]);

  const availableMonths = useMemo(
    () => listAvailableMonths(txnsForSelected.map((t) => t.date)),
    [txnsForSelected]
  );
  const currentYm = availableMonths[0] ?? new Date().toISOString().slice(0, 7);

  const openingBalanceFor = (ym: string) =>
    txnsForSelected
      .filter((t) => t.date < ym + "-01T00:00")
      .reduce((b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd), 0);

  // Serbest aralık raporu için: `from` gününden ÖNCEKİ devir bakiye.
  const openingBalanceBeforeDate = (fromDate: string) =>
    txnsForSelected
      .filter((t) => t.date.slice(0, 10) < fromDate)
      .reduce((b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd), 0);

  const runRangeExport = (kind: "csv" | "pdf") => {
    if (!rangeFrom || !rangeTo) {
      window.alert("Lütfen başlangıç ve bitiş tarihi seçin.");
      return;
    }
    if (rangeFrom > rangeTo) {
      window.alert("Başlangıç tarihi bitişten sonra olamaz.");
      return;
    }
    const opts = {
      openingBalance: openingBalanceBeforeDate(rangeFrom),
      generatedBy: user?.name,
    };
    if (kind === "csv") exportKasaRangeCsv(txnsForSelected, rangeFrom, rangeTo, opts);
    else exportKasaRangePdf(txnsForSelected, rangeFrom, rangeTo, opts);
    setRangeOpen(false);
  };

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

  const currentBalance = useMemo(
    () => selectedKasaId === "all"
      ? calcKasaBalance(viewKasaTransactions)
      : calcKasaBalance(viewKasaTransactions, undefined, selectedKasaId),
    [viewKasaTransactions, selectedKasaId]
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

  const perKasaSummary = useMemo(
    () =>
      visibleKasas
        .filter((k) => !k.archived)
        .map((k) => {
          const display = getKasaDisplayBalance(k, viewKasas, viewKasaTransactions, tronPanel);
          return {
            kasa: k,
            balance: display.balance,
            ledgerBalance: display.ledgerBalance,
            sublabel: display.sublabel,
            count: viewKasaTransactions.filter((t) => t.kasaId === k.id).length,
            isTronWallet: tronPanel?.tronKasa.id === k.id,
            isGenelKasa: tronPanel?.genelKasa?.id === k.id,
          };
        }),
    [visibleKasas, viewKasaTransactions, viewKasas, tronPanel]
  );

  const totalDisplayBalance = useMemo(
    () => sumKasaDisplayBalances(visibleKasas.filter((k) => !k.archived), viewKasaTransactions),
    [visibleKasas, viewKasaTransactions]
  );

  const currentBalanceDisplay = useMemo(() => {
    if (selectedKasaId === "all") return totalDisplayBalance;
    const row = perKasaSummary.find((x) => x.kasa.id === selectedKasaId);
    return row?.balance ?? currentBalance;
  }, [selectedKasaId, totalDisplayBalance, perKasaSummary, currentBalance]);

  const currentLedgerBalance = useMemo(() => {
    if (selectedKasaId === "all") {
      return calcKasaBalance(viewKasaTransactions);
    }
    return currentBalance;
  }, [selectedKasaId, viewKasaTransactions, currentBalance]);

  // TRON harcamalarını topluca Genel Kasa giderine dahil et / hariç tut.
  const setAllTronGenelInclusion = (include: boolean) => {
    if (!tronKasa) return;
    const targets = kasaTransactions.filter(
      (t) =>
        isTronGenelToggleable(t, tronKasa.id) &&
        Boolean(t.countInGenel) !== include
    );
    if (targets.length === 0) {
      window.alert(
        include
          ? "Dahil edilecek yeni TRON hareketi yok."
          : "Hariç tutulacak dahil edilmiş TRON hareketi yok."
      );
      return;
    }
    const verb = include ? "Genel Kasa'ya dahil edilecek" : "Genel Kasa'dan çıkarılacak";
    if (!window.confirm(`${targets.length} TRON hareketi ${verb}. Onaylıyor musun?`)) return;
    bulkSetKasaCountInGenel(targets.map((t) => t.id), include);
  };

  /**
   * Seçilen tarih-saatten SONRAKİ tüm TRON harcamalarını topluca Genel Kasa
   * giderine dahil et / çıkar. Cutoff dahil değildir (kesin olarak sonrası).
   */
  const setTronGenelFromCutoff = (include: boolean) => {
    if (!tronKasa) return;
    if (!tronGenelCutoff) {
      window.alert("Önce bir tarih ve saat seçin.");
      return;
    }
    const cutoffMs = new Date(tronGenelCutoff).getTime();
    if (Number.isNaN(cutoffMs)) {
      window.alert("Geçersiz tarih/saat.");
      return;
    }
    const targets = kasaTransactions.filter(
      (t) =>
        isTronGenelToggleable(t, tronKasa.id) &&
        new Date(t.date).getTime() > cutoffMs &&
        Boolean(t.countInGenel) !== include
    );
    if (targets.length === 0) {
      window.alert("Bu tarihten sonra güncellenecek TRON hareketi yok.");
      return;
    }
    const labelDt = new Date(tronGenelCutoff).toLocaleString("tr-TR");
    const verb = include ? "Genel Kasa'ya dahil edilecek" : "Genel Kasa'dan çıkarılacak";
    if (!window.confirm(`${labelDt} sonrasındaki ${targets.length} TRON harcaması ${verb}. Onaylıyor musun?`)) return;
    bulkSetKasaCountInGenel(targets.map((t) => t.id), include);
  };

  const filteredRows = useMemo(() => {
    const isTronAuto = (t: KasaTransaction) => Boolean(t.autoImported);
    const sourceMatches = (t: KasaTransaction) => {
      if (sourceFilter === "all") return true;
      if (sourceFilter === "tron-auto") return isTronAuto(t);
      return !isTronAuto(t);
    };
    const viewingGenel = Boolean(genelKasaId && selectedKasaId === genelKasaId);
    const genelMatches = (t: KasaTransaction) => {
      if (genelFilter === "all") return true;
      if (
        viewingGenel &&
        tronPanel &&
        isTronReflectedInGenelView(t, genelKasaId, tronPanel.tronKasa.id)
      ) {
        return genelFilter === "included";
      }
      if (viewingGenel && genelKasaId && t.kasaId === genelKasaId) {
        return genelFilter === "included" ? Boolean(t.countInGenel) : true;
      }
      if (tronPanel && isTronGenelToggleable(t, tronPanel.tronKasa.id)) {
        return genelFilter === "included" ? Boolean(t.countInGenel) : !t.countInGenel;
      }
      return genelFilter === "included" ? Boolean(t.countInGenel) : !t.countInGenel;
    };
    return [...withBalance].reverse().filter(t =>
      (filter === "all" || t.direction === filter) &&
      sourceMatches(t) &&
      genelMatches(t) &&
      (!(selectedKasaId === tronPanel?.tronKasa.id && tronTxView !== "all") ||
        (tronTxView === "ops" ? Boolean(t.autoImported) : !t.autoImported)) &&
      (search === "" ||
        t.purpose.toLowerCase().includes(search.toLowerCase()) ||
        t.counterparty.toLowerCase().includes(search.toLowerCase()) ||
        t.notes.toLowerCase().includes(search.toLowerCase()))
    );
  }, [
    withBalance,
    filter,
    sourceFilter,
    genelFilter,
    search,
    selectedKasaId,
    genelKasaId,
    tronPanel?.tronKasa.id,
    tronTxView,
  ]);

  const kasaNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kasas) m.set(k.id, k.name);
    return m;
  }, [kasas]);

  // Sayfalama — 50'şer kayıt. Filtre/arama değişince ilk sayfaya dön.
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage]
  );
  useEffect(() => {
    setPage(1);
  }, [filter, sourceFilter, genelFilter, search, selectedKasaId, tronTxView]);

  // Tablo genişliğini izle → üstteki kaydırma çubuğunun boşluğunu eşitle.
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const update = () => setTableScrollWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pagedRows.length, selectedKasaId]);

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1720px]">
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
          {canExport && (
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRangeOpen((v) => !v)}
                className="gap-1.5"
              >
                <CalendarRange size={14} /> Aralık raporu
              </Button>
              {rangeOpen && (
                <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Tarih aralığı raporu
                  </p>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Seçili kasanın iki tarih arasındaki tüm hareketlerini indir (gün dahil).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Başlangıç">
                      <Input
                        type="date"
                        value={rangeFrom}
                        max={rangeTo || undefined}
                        onChange={(e) => setRangeFrom(e.target.value)}
                      />
                    </Field>
                    <Field label="Bitiş">
                      <Input
                        type="date"
                        value={rangeTo}
                        min={rangeFrom || undefined}
                        onChange={(e) => setRangeTo(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1 gap-1.5" onClick={() => runRangeExport("csv")}>
                      <FileSpreadsheet size={13} /> CSV
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => runRangeExport("pdf")}>
                      <FileText size={13} /> PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
          Tümü ({fmtUsdt(totalDisplayBalance)})
        </button>
        {perKasaSummary.map(({ kasa, balance, ledgerBalance, sublabel, count, isTronWallet, isGenelKasa }) => {
          const active = selectedKasaId === kasa.id;
          const titleParts = [
            !readOnly ? "Düzenle" : "",
            isGenelKasa && ledgerBalance !== balance
              ? `Defter bakiyesi: ${fmtUsdt(ledgerBalance)}`
              : "",
            sublabel ?? "",
          ].filter(Boolean);
          return (
            <span key={kasa.id} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSelectedKasaId(kasa.id)}
                title={titleParts.length > 0 ? titleParts.join(" · ") : undefined}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors inline-flex items-center gap-1.5 flex-wrap max-w-full ${
                  active
                    ? isTronWallet
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-blue-600 text-white border-blue-600"
                    : isTronWallet
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500/40"
                      : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                }`}
              >
                {kasa.isDefault && <span className="text-[10px] opacity-70">★</span>}
                {kasa.archived && <Archive size={10} className="shrink-0 opacity-70" />}
                {isTronWallet && <Link2 size={11} className="shrink-0 opacity-80" />}
                {kasa.name}
                <span className="opacity-90 tabular-nums font-medium">· {fmtUsdt(balance)}</span>
                <span className="opacity-50 text-[10px]">({count})</span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setKasaModal(kasa)}
                  className="p-1 rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent"
                  title={`${kasa.name} düzenle`}
                >
                  <Pencil size={11} />
                </button>
              )}
            </span>
          );
        })}
        {visibleKasas.some((k) => k.archived) && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 ml-2">
            <Archive size={11} /> {visibleKasas.filter((k) => k.archived).length} arşivli
          </span>
        )}
      </div>

      {/* TRON USDT cüzdan — yalnızca Orkun / Ediz */}
      {canRamizWallet && (() => {
        if (!tronPanel || !tronKasa) return null;
        const isActive = selectedKasaId === tronKasa.id;
        const genelName = tronPanel.genelKasa?.name ?? "Genel Kasa";
        return (
          <Card className="mb-5 border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-500/40 dark:bg-emerald-950/25">
            <CardHeader className="py-3 px-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                    <Link2 size={14} />
                    <span>{tronKasa.name}</span>
                    <span className="text-muted-foreground font-normal">— otomatik senkron</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setKasaModal(tronKasa)}
                        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 hover:bg-card"
                        title="Kasa adını düzenle"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Ramiz TRON cüzdanından gelen/giden hareketler otomatik yazılır. Harcamalar{" "}
                    <strong>{genelName}</strong> üzerinden takip edilir.
                  </CardDescription>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
                    <div className="rounded-md border border-emerald-300/40 bg-emerald-500/5 px-2.5 py-2">
                      <p className="text-muted-foreground">Toplam cüzdan (Ramiz)</p>
                      <p className="font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                        {fmtUsdt(tronPanel.tronTotal)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{tronPanel.tronTxCount} işlem</p>
                    </div>
                    <div className="rounded-md border border-blue-300/40 bg-blue-500/5 px-2.5 py-2">
                      <p className="text-muted-foreground">Ramiz cüzdan adresi</p>
                      <p className="font-semibold tabular-nums text-blue-800 dark:text-blue-200">
                        {fmtUsdt(tronPanel.ramizWallet)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {tronPanel.autoTxCount} otomatik işlem
                      </p>
                      {tronPanel.tronAddress ? (
                        <p className="mt-1">
                          <Copyable text={tronPanel.tronAddress} />
                        </p>
                      ) : null}
                      {tronInfo?.walletBalances ? (
                        <p className="mt-1.5 tabular-nums text-[10px] leading-relaxed text-blue-900/90 dark:text-blue-200/90">
                          <span className="text-muted-foreground">Zincir: </span>
                          USDT <strong>{fmtToken(tronInfo.walletBalances.usdt, "USDT")}</strong>
                          {" · "}
                          USDC <strong>{fmtToken(tronInfo.walletBalances.usdc, "USDC")}</strong>
                          {" · "}
                          TRX <strong>{fmtToken(tronInfo.walletBalances.trx, "TRX")}</strong>
                        </p>
                      ) : tronPanel.tronAddress && tronInfoLoading ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">Zincir bakiyesi yükleniyor…</p>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-amber-300/40 bg-amber-500/5 px-2.5 py-2">
                      <p className="text-muted-foreground">{genelName} · harcama kasası</p>
                      <p className="font-semibold tabular-nums text-amber-800 dark:text-amber-200">
                        {fmtUsdt(tronPanel.harcamaKasa)}
                      </p>
                      {(tronPanel.includedTronOut > 0 || tronPanel.includedTronIn > 0) ? (
                        <>
                          <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 tabular-nums mt-0.5">
                            TRON dahil: <strong>{fmtUsdt(tronPanel.harcamaKasaWithTron)}</strong>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {tronPanel.harcamaTxCount} işlem · {tronPanel.includedTronCount} TRON dahil
                            {tronPanel.includedTronOut > 0 && ` (−${fmtUsdt(tronPanel.includedTronOut)} gider)`}
                            {tronPanel.includedTronIn > 0 && ` (+${fmtUsdt(tronPanel.includedTronIn)} gelir)`}
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          {tronPanel.harcamaTxCount} harcama işlemi
                          {tronPanel.tronOutCount + tronPanel.tronInCount > 0
                            ? ` · ${tronPanel.tronOutCount + tronPanel.tronInCount} TRON hareketi dahil değil`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {tronPanel.tronAddress ? (
                    <div className="mt-2 rounded-md border border-violet-300/50 bg-violet-500/5 px-2.5 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-violet-900 dark:text-violet-200">
                          Cüzdan bakiyesi (zincir · TronGrid)
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                              void loadTronInfo();
                              if (tronPanel.tronAddress) {
                                void refreshWalletBalances(tronPanel.tronAddress);
                              }
                            }}
                            disabled={tronInfoLoading}
                            className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5 text-[10px] hover:bg-card disabled:opacity-50"
                            title="USDT, USDC ve TRX bakiyesini yenile"
                          >
                            <RefreshCw
                              size={10}
                              className={tronInfoLoading ? "animate-spin" : undefined}
                            />
                            Yenile
                          </button>
                      </div>
                      {tronInfo?.walletBalances ? (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                          <span>
                            <span className="text-muted-foreground">USDT </span>
                            <strong>{fmtToken(tronInfo.walletBalances.usdt, "USDT")}</strong>
                          </span>
                          <span>
                            <span className="text-muted-foreground">USDC </span>
                            <strong>{fmtToken(tronInfo.walletBalances.usdc, "USDC")}</strong>
                          </span>
                          <span>
                            <span className="text-muted-foreground">TRX </span>
                            <strong>{fmtToken(tronInfo.walletBalances.trx, "TRX")}</strong>
                          </span>
                        </div>
                      ) : (
                        <p className="mt-1 text-muted-foreground">
                          Zincir bakiyesi alınamadı. TRONGRID_API_KEY ve cüzdan adresini kontrol edin.
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        USDT hareketleri kasaya otomatik yazılır. USDC yalnızca canlı bakiye olarak gösterilir;
                        USDC transferleri henüz senkron edilmez.
                        {tronInfo?.walletBalances?.fetchedAt ? (
                          <>
                            {" "}
                            ·{" "}
                            {new Date(tronInfo.walletBalances.fetchedAt).toLocaleString("tr-TR")}
                          </>
                        ) : null}
                      </p>
                    </div>
                  ) : null}
                  <p className="text-xs mt-2 flex flex-wrap items-center gap-3">
                    {tronInfo?.watchAddress && tronInfo.watchAddress !== tronPanel.tronAddress && (
                      <span className="text-muted-foreground">
                        Bildirim izleme:
                        {" "}
                        <Copyable text={tronInfo.watchAddress} />
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Cüzdandan yeni çıkış/giriş olduğunda kasa hareketleri arka planda otomatik güncellenir.
                    {tronSyncHint && (
                      <span className="block mt-1 text-foreground/90">{tronSyncHint}</span>
                    )}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant={isActive ? "outline" : "ghost"}
                      className="h-8 text-xs gap-1.5"
                      onClick={() => setSelectedKasaId(tronKasa.id)}
                    >
                      {isActive ? "Listede" : "Hareketleri gör"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      disabled={tronSyncing}
                      onClick={() => void syncTronForKasa(tronKasa, { recentDays: 7 })}
                    >
                      {tronSyncing ? "Çekiliyor…" : "Son 7 gün çek"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={tronSyncing}
                      title="Kasa ayarındaki başlangıçtan beri tüm USDT giriş/çıkış"
                      onClick={() => void syncTronForKasa(tronKasa, { fullHistory: true })}
                    >
                      Tüm geçmiş
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setKasaModal(tronKasa)}
                    >
                      Cuzdan ayarini duzenle
                    </Button>
                  </div>
                )}
              </div>
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="inline-flex items-center gap-1 border border-border rounded-md p-0.5 bg-card">
                    {(["all", "ops", "local"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTronTxView(mode)}
                        className={`px-2 py-1 text-[10px] rounded ${
                          tronTxView === mode
                            ? "bg-emerald-600 text-white"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {mode === "all" ? "Tümü" : mode === "ops" ? "Otomatik (Ramiz)" : "Manuel"}
                      </button>
                    ))}
                  </div>
                  {!isActive && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSelectedKasaId(tronKasa.id)}
                    >
                      Once TRON kasasini sec
                    </Button>
                  )}
                  <span className="text-[11px] text-muted-foreground">Geçmişten doldur:</span>
                  <input
                    type="date"
                    value={tronResyncFrom || tronKasa.tronSyncFrom || ""}
                    onChange={(e) => setTronResyncFrom(e.target.value)}
                    className="h-7 rounded-md border border-border bg-card px-2 text-xs"
                    title="Geçmişe dönük çekim başlangıcı"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={tronSyncing}
                    title="Seçilen tarihten itibaren çek ve kasa ayarına kaydet"
                    onClick={() => void syncTronForKasa(tronKasa, { useResyncFrom: true })}
                  >
                    Tarihten itibaren çek
                  </Button>
                </div>
              )}
              {!readOnly && tronPanel && (tronPanel.tronOutCount > 0 || tronPanel.tronInCount > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-500/5 px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">
                    TRON gelen/giden → Genel Kasa:
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setAllTronGenelInclusion(true)}
                  >
                    <ArrowDownRight size={12} /> Tümünü dahil et
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => setAllTronGenelInclusion(false)}
                  >
                    <ArrowUpRight size={12} /> Tümünü çıkar
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {tronPanel.includedTronCount}/{tronPanel.tronOutCount + tronPanel.tronInCount} dahil
                    {tronPanel.includedTronInCount > 0 && (
                      <> · {tronPanel.includedTronInCount} gelen</>
                    )}
                    {tronPanel.includedTronOutCount > 0 && (
                      <> · {tronPanel.includedTronOutCount} giden</>
                    )}
                  </span>
                  <div className="mt-1 flex w-full flex-wrap items-center gap-2 border-t border-amber-300/30 pt-2">
                    <span className="text-[11px] text-muted-foreground">
                      Tarih/saat sonrası:
                    </span>
                    <input
                      type="datetime-local"
                      value={tronGenelCutoff}
                      onChange={(e) => setTronGenelCutoff(e.target.value)}
                      className="h-7 rounded-md border border-border bg-card px-2 text-xs"
                      aria-label="TRON Genel Kasa eşik tarihi"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      disabled={!tronGenelCutoff}
                      onClick={() => setTronGenelFromCutoff(true)}
                    >
                      <ArrowDownRight size={12} /> Sonrasını dahil et
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      disabled={!tronGenelCutoff}
                      onClick={() => setTronGenelFromCutoff(false)}
                    >
                      <ArrowUpRight size={12} /> Sonrasını çıkar
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>
        );
      })()}

      {tronInfo && (
        <Card className="mb-5 border-border/80">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 size={14} className="text-blue-600 dark:text-blue-400" />
              TRON / TronGrid
            </CardTitle>
            <CardDescription className="text-xs">
              İzleme cüzdanı ve çekim cüzdanı ayrı okunur. Giriş/çıkış bildirimleri sadece
              izleme adresi için üretilir; manuel çekim seçili TRON kasaya yazar.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground mb-1">TronGrid API</p>
                <p className="font-medium flex items-center gap-1.5">
                  <Activity
                    size={12}
                    className={
                      tronInfo.apiKeySet && tronInfo.probeOk
                        ? "text-emerald-600"
                        : tronInfo.apiKeySet
                          ? "text-amber-600"
                          : "text-red-600"
                    }
                  />
                  {!tronInfo.apiKeySet
                    ? "Anahtar yok"
                    : tronInfo.probeOk
                      ? `Aktif · ${tronInfo.probeLatencyMs}ms`
                      : "Anahtar var · bağlantı hatası"}
                </p>
                {tronInfo.apiKeySet && !tronInfo.probeOk && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {tronInfo.probeMessage}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 sm:col-span-2">
                <p className="text-muted-foreground mb-1">
                  Bildirim izleme · {tronInfo.watchLabel || "TRON cüzdan"}
                </p>
                {tronInfo.watchAddress ? (
                  <>
                    <Copyable text={tronInfo.watchAddress} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {tronInfo.watchSource === "kasa-db"
                        ? "Kaynak: kasa kaydı (Cüzdan ayarı)"
                        : tronInfo.watchSource === "env-watch"
                          ? "Kaynak: TRON_WATCH_ADDRESS env"
                          : "Kaynak: TRON_KASA_ADDRESS env"}
                    </p>
                  </>
                ) : (
                  <p className="text-amber-700 dark:text-amber-400">
                    TRON adresi yok — TRON kasasında &quot;Cüzdan ayarı&quot;ndan adres kaydedin
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground mb-1">İzleme başlangıcı</p>
                <p className="font-medium tabular-nums">
                  {tronInfo.watchSyncFrom || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 sm:col-span-2 lg:col-span-4">
                <p className="text-muted-foreground mb-1 text-[10px]">
                  Otomatik bildirim ~5 dk&apos;da bir kontrol eder. &quot;Son 7 gün çek&quot; kasa
                  hareketlerini TronGrid ile yazar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="border border-blue-200 dark:border-blue-500/40 rounded-xl px-4 py-3 bg-gradient-to-br from-blue-50/60 to-blue-50/20 dark:from-blue-950/50 dark:to-blue-950/20">
          <p className="text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Wallet size={11} /> {selectedKasaId === "all" ? "Toplam Kasa" : "Seçili Kasa Bakiyesi"}
          </p>
          <p className="text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">{fmtUsdt(currentBalanceDisplay)}</p>
          {currentBalanceDisplay !== currentLedgerBalance && tronPanel && (tronPanel.includedTronOut > 0 || tronPanel.includedTronIn > 0) && (
            <p className="mt-0.5 text-[10px] text-blue-700/70 dark:text-blue-300/70">
              Defter {fmtUsdt(currentLedgerBalance)}
              {tronPanel.includedTronOut > 0 && ` · TRON gider −${fmtUsdt(tronPanel.includedTronOut)}`}
              {tronPanel.includedTronIn > 0 && ` · TRON gelir +${fmtUsdt(tronPanel.includedTronIn)}`}
            </p>
          )}
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

      {genelKasaId && selectedKasaId === genelKasaId && (tronPanel?.includedTronCount ?? 0) > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300/50 bg-amber-50/60 dark:border-amber-500/35 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-100">
          <strong>{tronPanel.includedTronCount}</strong> TRON cüzdan hareketi &quot;Dahil&quot; olarak
          işaretlendi — gelenler işletme gelirine, gidenler giderine yansır (Ramiz cüzdan satırı).
        </div>
      )}

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
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {([
            { value: "all", label: "Tüm kaynak" },
            { value: "tron-auto", label: "TRON otomatik" },
            { value: "manual", label: "Manuel" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSourceFilter(opt.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                sourceFilter === opt.value ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card" title="Genel Kasa giderine dahil edilen harcamalar">
          {([
            { value: "all", label: "Genel: tümü" },
            { value: "included", label: "Dahil" },
            { value: "excluded", label: "Hariç" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGenelFilter(opt.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                genelFilter === opt.value ? "bg-amber-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {opt.label}
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
        {/* Üstte senkron yatay kaydırma çubuğu */}
        <div
          ref={topScrollRef}
          onScroll={syncFromTop}
          className="scroll-top-visible overflow-x-auto border-b border-border/60 bg-muted/20"
          aria-hidden="true"
        >
          <div style={{ width: tableScrollWidth, height: 1 }} />
        </div>
        <div ref={tableScrollRef} onScroll={syncFromTable} className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Tarih","Kasa","Kaynak","Yön","Tutar","Fee","Amaç","Karşı Taraf","Kanıt","Genel","Bakiye",""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(t => (
                <tr key={t.id} className="border-b border-border/60 hover:bg-accent/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {t.date.slice(0, 10)}<br />
                    <span className="text-[10px] opacity-60">{t.date.slice(11, 16)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {isTronReflectedInGenelView(
                      t,
                      genelKasaId,
                      tronPanel?.tronKasa?.id
                    ) && selectedKasaId === genelKasaId ? (
                      <span className="flex flex-col gap-0.5">
                        <span>{tronPanel?.tronKasa?.name ?? "TRON"}</span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300">
                          → {kasaNameById.get(genelKasaId!) ?? "Genel Kasa"}
                        </span>
                      </span>
                    ) : (
                      kasaNameById.get(t.kasaId) ?? t.kasaId
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {tronPanel?.tronKasa.id === t.kasaId && t.autoImported ? (
                      <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700 bg-violet-50 dark:border-violet-500/45 dark:text-violet-300 dark:bg-violet-950/40">
                        Ramiz cüzdan
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                        Manuel
                      </Badge>
                    )}
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
                    <p className="text-sm text-foreground font-medium flex items-center gap-1 flex-wrap">
                      {t.purpose}
                      {t.autoImported && (
                        <Badge variant="outline" className="text-[9px] py-0 border-violet-300 text-violet-700 dark:border-violet-500/45 dark:text-violet-300">
                          TRON
                        </Badge>
                      )}
                    </p>
                    {t.notes && <p className="text-[11px] text-muted-foreground truncate max-w-[300px]">{t.notes}</p>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap min-w-[120px]">
                    <InlineCounterparty
                      value={t.counterparty}
                      readOnly={readOnly}
                      canRevealTron={canRamizWallet}
                      onSave={(next) =>
                        updateKasaTransaction(t.id, { counterparty: next })
                      }
                    />
                  </td>
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
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {tronPanel && isTronGenelToggleable(t, tronPanel.tronKasa.id) ? (
                      <button
                        type="button"
                        disabled={readOnly || genelToggleBusy === t.id}
                        onClick={() => toggleGenelInclusion(t)}
                        title={
                          t.countInGenel
                            ? t.direction === "in"
                              ? "Genel Kasa gelirinden çıkar — hariç tutmak için tıkla"
                              : "Genel Kasa giderinden düşülüyor — hariç tutmak için tıkla"
                            : t.direction === "in"
                              ? "Genel Kasa işletme gelirine dahil et"
                              : "Genel Kasa bakiyesinden düşülsün (işletme gideri) — dahil et"
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                          t.countInGenel
                            ? t.direction === "in"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-950/40 dark:text-emerald-200"
                              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-200"
                            : "border-border text-muted-foreground hover:border-amber-300/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/30"
                        } ${readOnly || genelToggleBusy === t.id ? "cursor-default opacity-60" : ""}`}
                      >
                        {genelToggleBusy === t.id ? (
                          <span className="opacity-70">…</span>
                        ) : t.countInGenel ? (
                          <Check size={10} />
                        ) : (
                          <Plus size={10} />
                        )}
                        {t.countInGenel ? "Dahil" : "Hariç"}
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Filtreyle eşleşen işlem yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} / {filteredRows.length} işlem
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                className="rounded-md border border-border px-2 py-1 transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"
              >
                « İlk
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-md border border-border px-2 py-1 transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"
              >
                ‹ Önceki
              </button>
              <span className="px-2 tabular-nums">
                Sayfa {safePage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="rounded-md border border-border px-2 py-1 transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"
              >
                Sonraki ›
              </button>
              <button
                type="button"
                onClick={() => setPage(pageCount)}
                disabled={safePage >= pageCount}
                className="rounded-md border border-border px-2 py-1 transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"
              >
                Son »
              </button>
            </div>
          </div>
        )}
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
            txCount={
              kasaModal !== "new"
                ? kasaTransactions.filter((t) => t.kasaId === kasaModal.id).length
                : 0
            }
            onSave={async (d) => {
              const payload =
                kasaModal === "new"
                  ? d
                  : {
                      ...d,
                      tronAddress: d.kind === "usdt" ? d.tronAddress : "",
                    };
              if (kasaModal === "new") {
                addKasa(payload);
                const created = useStore.getState().kasas.at(-1);
                if (created?.id) {
                  await fetch("/api/kasa/account", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, id: created.id }),
                  }).catch(() => undefined);
                }
              } else {
                updateKasa(kasaModal.id, payload);
                await fetch("/api/kasa/account", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...payload, id: kasaModal.id }),
                }).catch(() => undefined);
              }
            }}
            onArchive={
              kasaModal !== "new" && kasaModal.id !== DEFAULT_KASA_ID
                ? () => {
                    if (
                      window.confirm(
                        `"${kasaModal.name}" arşivlensin mi? Listeden gizlenir, hareketler kalır.`,
                      )
                    ) {
                      deleteKasa(kasaModal.id);
                      setKasaModal(null);
                    }
                  }
                : undefined
            }
            onForceDelete={
              kasaModal !== "new" && kasaModal.id !== DEFAULT_KASA_ID
                ? () => {
                    const n = kasaTransactions.filter((t) => t.kasaId === kasaModal.id).length;
                    const msg =
                      n > 0
                        ? `"${kasaModal.name}" ve ${n} hareket kalıcı silinsin mi? Geri alınamaz.`
                        : `"${kasaModal.name}" kalıcı silinsin mi?`;
                    if (window.confirm(msg)) {
                      deleteKasa(kasaModal.id, { force: true });
                      if (selectedKasaId === kasaModal.id) setSelectedKasaId("all");
                      setKasaModal(null);
                    }
                  }
                : undefined
            }
            onClose={() => setKasaModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
