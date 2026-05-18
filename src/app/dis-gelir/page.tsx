"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, ChevronDown, ChevronRight, Copy, Check, ExternalLink, Filter, Hash,
} from "lucide-react";
import { useStore, type ExternalCompany, type SponsorTransaction } from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { fmt, CHART_COLORS, MONTHS } from "@/lib/data";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input as UInput } from "@/components/ui/input";
import PageHeader from "@/components/page-header";
import SectionCard from "@/components/section-card";
import DonutPie from "@/components/charts/donut-pie";
import RevenueLine from "@/components/charts/revenue-line";

// ── Helpers ───────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<ExternalCompany["status"], string> = {
  active:   "Aktif Anlaşma",
  inactive: "Pasif",
  ended:    "Sona Erdi",
};
const STATUS_BADGE: Record<ExternalCompany["status"], string> = {
  active:   "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40",
  inactive: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  ended:    "text-muted-foreground border-border bg-muted/50",
};

function CopyButton({ text, label = "" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono"
      title={text}>
      {label}{copied ? <Check size={11} className="text-green-600 dark:text-green-400" /> : <Copy size={11} className="opacity-50" />}
    </button>
  );
}

// ── Company Form ──────────────────────────────────────────────────────────
function CompanyForm({ initial, onSave, onDelete, onClose }: {
  initial?: ExternalCompany;
  onSave: (data: Omit<ExternalCompany, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<ExternalCompany, "id">>({
    name:          initial?.name          ?? "",
    category:      initial?.category      ?? "",
    monthlyAmount: initial?.monthlyAmount ?? 0,
    contactPerson: initial?.contactPerson ?? "",
    status:        initial?.status        ?? "active",
    startDate:     initial?.startDate     ?? new Date().toISOString().slice(0, 10),
    notes:         initial?.notes         ?? "",
    monthlyBreakdown: initial?.monthlyBreakdown,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Firma Adı" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Firma A.Ş." />
          </Field>
          <Field label="Kategori / Mecra" required>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} required placeholder="Website, Sosyal Medya..." />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Aylık Tutar ($)" required>
            <NumberInput value={form.monthlyAmount} onChange={(v) => set("monthlyAmount", v)} required min={0} step={100} />
          </Field>
          <Field label="İletişim Kişisi">
            <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Ad Soyad" />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Başlangıç Tarihi">
            <DateTimePicker mode="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
          </Field>
          <Field label="Durum">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as ExternalCompany["status"])}
              options={[{ value:"active", label:"Aktif Anlaşma" }, { value:"inactive", label:"Pasif" }, { value:"ended", label:"Sona Erdi" }]} />
          </Field>
        </FormGrid>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anlaşma detayları..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Firma Ekle"} />
    </form>
  );
}

// ── Sponsor Transaction Form ──────────────────────────────────────────────
function TxForm({ companies, initial, onSave, onDelete, onClose }: {
  companies: ExternalCompany[];
  initial?: SponsorTransaction;
  onSave: (d: Omit<SponsorTransaction, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<SponsorTransaction, "id">>({
    date:        initial?.date        ?? new Date().toISOString().slice(0, 10),
    companyName: initial?.companyName ?? "",
    service:     initial?.service     ?? "Website",
    amount:      initial?.amount      ?? 0,
    status:      initial?.status      ?? "active",
    txid:        initial?.txid        ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Tarih" required>
            <DateTimePicker mode="date" value={form.date} onChange={(v) => set("date", v)} required />
          </Field>
          <Field label="Firma" required>
            <Input value={form.companyName} onChange={e => set("companyName", e.target.value)} required placeholder="TRbet, AMG..." list="company-list" />
            <datalist id="company-list">
              {companies.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Mecra / Hizmet">
            <Input value={form.service} onChange={e => set("service", e.target.value)} placeholder="Website, Tişört Tanıtım..." />
          </Field>
          <Field label="Tutar ($)" required>
            <NumberInput value={form.amount} onChange={v => set("amount", v)} required min={0} step={100} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Durum">
            <Select value={form.status} onChange={e => set("status", e.target.value as SponsorTransaction["status"])}
              options={[{ value: "active", label: "Aktif" }, { value: "ended", label: "Sona Erdi" }]} />
          </Field>
          <Field label="TXID / Blockchain Kanıtı">
            <Input value={form.txid} onChange={e => set("txid", e.target.value)} placeholder="0x... veya hash" className="font-mono text-xs" />
          </Field>
        </FormGrid>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "İşlem Ekle"} />
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function DisGelirPage() {
  const {
    companies, addCompany, updateCompany, deleteCompany,
    sponsorTransactions, addSponsorTransaction, updateSponsorTransaction, deleteSponsorTransaction,
  } = useStore();
  const readOnly = useIsReadOnly();

  const [statusFilter, setStatusFilter] = useState<"all" | ExternalCompany["status"]>("all");
  const [search, setSearch]             = useState("");
  const [modal, setModal]               = useState<"new" | ExternalCompany | null>(null);
  const [txModal, setTxModal]           = useState<"new" | SponsorTransaction | null>(null);
  const [showTx, setShowTx]             = useState(true);

  // Filtered list
  const filtered = useMemo(() => companies.filter(c =>
    (statusFilter === "all" || c.status === statusFilter) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase()))
  ), [companies, statusFilter, search]);

  // Aggregates from TRANSACTIONS — gerçek tahsilat
  const txTotal = sponsorTransactions.reduce((s, t) => s + t.amount, 0);
  const txCount = sponsorTransactions.length;
  const aktifFirmaSayisi = companies.filter(c => c.status === "active").length;
  const bittiFirmaSayisi = companies.filter(c => c.status === "ended").length;

  // Pie: firma payları (tx toplamı bazlı)
  const pieData = useMemo(() => {
    const totals = new Map<string, number>();
    sponsorTransactions.forEach(t => totals.set(t.companyName, (totals.get(t.companyName) ?? 0) + t.amount));
    return Array.from(totals.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, value }));
  }, [sponsorTransactions]);

  // Aylık trend (CSV "AY BAZLI" — TX'lere göre)
  const lineData = useMemo(() => {
    const buckets = MONTHS.map((ay) => ({ ay, disGelir: 0 }));
    sponsorTransactions.forEach((t) => {
      const m = parseInt(t.date.split("-")[1], 10) - 1;
      if (m >= 0 && m < 12) buckets[m].disGelir += t.amount;
    });
    return buckets;
  }, [sponsorTransactions]);

  // Tarihe göre sıralı işlemler
  const sortedTx = useMemo(
    () => [...sponsorTransactions].sort((a, b) => b.date.localeCompare(a.date)),
    [sponsorTransactions]
  );

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1400px]">
      <PageHeader
        title="Dış Gelir (Geçmiş Tahsilat)"
        subtitle="Bu firmalar artık çalışılan firmalar değildir · gösterilen tutarlar toplam tahsilat tutarıdır"
        badge={`${txCount} işlem · ${fmt(txTotal)}`}
        badgeTone="blue"
      />

      {/* Uyarı banner — geçmiş bilgisi */}
      <div className="mb-6 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/30">
        <p className="text-sm text-amber-900 dark:text-amber-100 font-medium mb-1">Geçmişe yönelik gelir kayıtları</p>
        <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
          Aşağıdaki firmalarla şu anda aktif olarak çalışılmamaktadır. Listelenen tutarlar
          <span className="font-medium"> toplam tahsil edilen tutardır</span> — aylık tekrar gelir değildir.
          Aktif olarak tanıtımı yapılan markalar için <a href="/izlenme" className="underline">Marka İzlenme</a> sayfasına bakın.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Tahsilat (Geçmiş)", value: fmt(txTotal),         cls: "text-blue-600 dark:text-blue-400 font-bold" },
          { label: "İşlem Sayısı",             value: String(txCount),      cls: "text-foreground" },
          { label: "Aktif Anlaşma",            value: String(aktifFirmaSayisi), cls: aktifFirmaSayisi > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground" },
          { label: "Sona Erdi",                value: String(bittiFirmaSayisi), cls: "text-muted-foreground" },
        ].map(k => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(["all", "active", "ended", "inactive"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}>
              {s === "all" ? "Tümü" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <UInput placeholder="Firma / kategori ara..." value={search} onChange={e => setSearch(e.target.value)} className="w-52 h-8 text-sm" />
        {!readOnly && (
          <Button size="sm" onClick={() => setModal("new")} className="gap-1.5 ml-auto">
            <Plus size={13} /> Firma Ekle
          </Button>
        )}
      </div>

      {/* Firma tablosu */}
      <div className="border border-border rounded-xl overflow-hidden bg-card mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Firma","Mecra","Aylık","Tahsil Edilen","Durum","Başlangıç","Not",""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const tahsil = sponsorTransactions.filter(t => t.companyName === c.name).reduce((s, t) => s + t.amount, 0);
                return (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-3 text-foreground font-medium whitespace-nowrap">{c.name}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{c.category}</td>
                    <td className="px-3 py-3 text-foreground tabular-nums whitespace-nowrap">{c.monthlyAmount > 0 ? fmt(c.monthlyAmount) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-3 tabular-nums font-medium whitespace-nowrap">
                      {tahsil > 0 ? <span className="text-blue-600">{fmt(tahsil)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Badge variant="outline" className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{c.startDate}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs max-w-[260px] truncate" title={c.notes}>{c.notes || "—"}</td>
                    <td className="px-3 py-3">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => setModal(c)}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          aria-label="Firmayı düzenle"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Filtreyle eşleşen firma yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TX listesi */}
      <Card className="mb-6 gap-2 py-5">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <button onClick={() => setShowTx(s => !s)} className="text-muted-foreground hover:text-foreground">
                {showTx ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              Tarih Bazlı Tüm Sponsor İşlemleri
            </CardTitle>
            <CardDescription>
              CSV "Tarih Bazlı Tüm Sponsor İşlemleri" · {sortedTx.length} kayıt · toplam {fmt(txTotal)}
            </CardDescription>
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={() => setTxModal("new")} className="gap-1.5">
              <Plus size={13} /> İşlem
            </Button>
          )}
        </CardHeader>
        {showTx && (
          <CardContent className="overflow-x-auto px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/30">
                  {["#","Tarih","Firma","Mecra","Tutar","Durum","TXID",""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTx.map((t, i) => (
                  <tr key={t.id} className="border-b border-border/60 hover:bg-accent/20 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2 text-foreground font-medium whitespace-nowrap">{t.companyName}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap max-w-[180px] truncate">{t.service}</td>
                    <td className="px-3 py-2 tabular-nums font-medium whitespace-nowrap">{t.amount > 0 ? fmt(t.amount) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="outline" className={t.status === "active"
                        ? "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40"
                        : "text-muted-foreground border-border bg-muted/50"}>
                        {t.status === "active" ? "Aktif" : "Sona Erdi"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {t.txid ? (
                        <div className="flex items-center gap-1.5">
                          <Hash size={11} className="text-muted-foreground" />
                          <span className="font-mono text-[11px] text-muted-foreground">{t.txid.slice(0, 8)}…{t.txid.slice(-6)}</span>
                          <CopyButton text={t.txid} />
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => setTxModal(t)}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          aria-label="İşlemi düzenle"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedTx.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">Henüz sponsor işlemi yok.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        )}
      </Card>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionCard title="En Yüksek Tahsilat Yapan Firmalar (Tüm Zamanlar)">
          <DonutPie data={pieData} height={280} />
        </SectionCard>
        <SectionCard title="Aylık Tahsilat Trendi (2025 + 2026)">
          <RevenueLine
            data={lineData}
            series={[{ key: "disGelir", label: "Tahsilat", color: CHART_COLORS.disGelir }]}
            height={280}
          />
        </SectionCard>
      </div>

      {/* Modals */}
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === "new" ? "Yeni Firma Ekle" : "Firmayı Düzenle"}>
        <CompanyForm
          initial={modal !== "new" && modal !== null ? modal : undefined}
          onSave={(data) => { if (modal === "new") addCompany(data); else if (modal !== null) updateCompany(modal.id, data); }}
          onDelete={modal !== "new" && modal !== null ? () => { deleteCompany(modal.id); setModal(null); } : undefined}
          onClose={() => setModal(null)}
        />
      </Modal>

      <Modal open={txModal !== null} onClose={() => setTxModal(null)} title={txModal === "new" ? "Yeni Sponsor İşlemi" : "İşlemi Düzenle"} size="lg">
        <TxForm
          companies={companies}
          initial={txModal !== "new" && txModal !== null ? txModal : undefined}
          onSave={(data) => { if (txModal === "new") addSponsorTransaction(data); else if (txModal !== null) updateSponsorTransaction(txModal.id, data); }}
          onDelete={txModal !== "new" && txModal !== null ? () => { deleteSponsorTransaction(txModal.id); setTxModal(null); } : undefined}
          onClose={() => setTxModal(null)}
        />
      </Modal>
    </div>
  );
}
