"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, ArrowDownRight, ArrowUpRight, Search,
  Wallet, ExternalLink, Copy, Check, AlertCircle, TrendingDown, Hash,
} from "lucide-react";
import { useStore, calcKasaBalance, type KasaTransaction } from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { fmt } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input as UInput } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
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

// ── Kasa Form ─────────────────────────────────────────────────────────────
function KasaForm({ initial, onSave, onDelete, onClose }: {
  initial?: KasaTransaction;
  onSave: (d: Omit<KasaTransaction, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<KasaTransaction, "id">>({
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
          <Field label="Tarih & Saat" required>
            <Input type="datetime-local" value={form.date} onChange={e => set("date", e.target.value)} required />
          </Field>
          <Field label="Yön" required>
            <Select value={form.direction} onChange={e => set("direction", e.target.value as KasaTransaction["direction"])} required
              options={[{ value: "in", label: "↓ Gelen (kasaya giriş)" }, { value: "out", label: "↑ Giden (kasadan çıkış)" }]} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Tutar (USDT)" required>
            <NumberInput value={form.amountUsd} onChange={v => set("amountUsd", v)} required min={0} step={0.01} />
          </Field>
          <Field label="Network Fee (USDT)" hint="Genelde ~$4 (TRC20)">
            <NumberInput value={form.feeUsd} onChange={v => set("feeUsd", v)} min={0} step={0.01} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Amaç / Açıklama" required>
            <Input value={form.purpose} onChange={e => set("purpose", e.target.value)} required placeholder="Ödeme sebebi" />
          </Field>
          <Field label="Karşı Taraf" hint='Alıcı veya gönderici (ör. "Lucy", "TronScan adresi")'>
            <Input value={form.counterparty} onChange={e => set("counterparty", e.target.value)} placeholder="İsim / cüzdan" />
          </Field>
        </FormGrid>
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
  const { kasaTransactions, addKasaTransaction, updateKasaTransaction, deleteKasaTransaction } = useStore();
  const { user } = useAuth();
  const readOnly = useIsReadOnly();
  const [modal, setModal]       = useState<"new" | KasaTransaction | null>(null);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "in" | "out">("all");

  // Aylık dışa aktarım: kullanılabilir aylar (kasa hareketlerinden + bu ay).
  const availableMonths = useMemo(
    () => listAvailableMonths(kasaTransactions.map((t) => t.date)),
    [kasaTransactions]
  );
  const currentYm = availableMonths[0] ?? new Date().toISOString().slice(0, 7);

  // Verilen aydan ÖNCE oluşan kasa devir bakiyesini hesapla (PDF/CSV özet için).
  const openingBalanceFor = (ym: string) =>
    kasaTransactions
      .filter((t) => t.date < ym + "-01T00:00")
      .reduce((b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd), 0);

  const canExport = user?.role === "admin" || user?.role === "auditor";

  // Sıralı ve bakiye eklenmiş
  const sorted = useMemo(
    () => [...kasaTransactions].sort((a, b) => a.date.localeCompare(b.date)),
    [kasaTransactions]
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

  const currentBalance = calcKasaBalance(kasaTransactions);
  const totalIn        = kasaTransactions.filter(t => t.direction === "in").reduce((s, t) => s + t.amountUsd, 0);
  const totalOut       = kasaTransactions.filter(t => t.direction === "out").reduce((s, t) => s + t.amountUsd + t.feeUsd, 0);
  const totalFees      = kasaTransactions.reduce((s, t) => s + t.feeUsd, 0);

  // Bakiye grafiği için günlük seri
  const balanceSeries = useMemo(() => {
    return withBalance.map(t => ({
      date: t.date.slice(0, 10),
      balance: Math.round(t.balanceAfter * 100) / 100,
    }));
  }, [withBalance]);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1400px]">
      <div className="flex items-start justify-between mb-8 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kasa Hareketleri</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Denetim grubuna iletilen tüm para giriş/çıkışları · 1 Nisan 2026 proje devri sonrası
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <MonthlyExportMenu
              month={currentYm}
              availableMonths={availableMonths}
              label="Aylık rapor"
              onExportPdf={(ym) =>
                exportKasaMonthPdf(kasaTransactions, ym, {
                  openingBalance: openingBalanceFor(ym),
                  generatedBy: user?.name,
                })
              }
              onExportCsv={(ym) =>
                exportKasaMonthCsv(kasaTransactions, ym, {
                  openingBalance: openingBalanceFor(ym),
                  generatedBy: user?.name,
                })
              }
            />
          )}
          {!readOnly && (
            <Button size="sm" onClick={() => setModal("new")} className="gap-1.5">
              <Plus size={14} /> İşlem Ekle
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="border border-blue-200 dark:border-blue-500/40 rounded-xl px-4 py-3 bg-gradient-to-br from-blue-50/60 to-blue-50/20 dark:from-blue-950/50 dark:to-blue-950/20">
          <p className="text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <Wallet size={11} /> Güncel Kasa
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
            <CardDescription>Her işlem sonrası kasa bakiyesi</CardDescription>
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
          Bu grup yalnızca veri paylaşımı içindir.
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
          <UInput placeholder="İşlem ara..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-8 text-sm pl-8" />
        </div>
        <p className="text-xs text-muted-foreground ml-auto">
          {filteredRows.length} / {kasaTransactions.length} işlem
        </p>
      </div>

      {/* Tablo */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Tarih","Yön","Tutar","Fee","Amaç","Karşı Taraf","Kanıt","Bakiye",""].map((h) => (
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
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
            onSave={d => { if (modal === "new") addKasaTransaction(d); else updateKasaTransaction(modal.id, d); }}
            onDelete={modal !== "new" ? () => { deleteKasaTransaction(modal.id); setModal(null); } : undefined}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
