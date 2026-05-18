"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, Search, CheckCircle2, Circle, Receipt, Calendar,
  ExternalLink, AlertCircle, X, Image as ImageIcon, MessageSquare, Clock, Wallet,
} from "lucide-react";
import {
  useStore,
  calcKasaBalance,
  DEFAULT_KASA_ID,
  type ContentExpense,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { logAudit } from "@/store/audit-log";
import { fmt } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input as UInput } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, OptionalNumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { ProofUploader } from "@/components/proof-uploader";
import { MonthlyExportMenu } from "@/components/monthly-export-menu";
import {
  exportContentExpensesCsv,
  exportContentExpensesPdf,
  listAvailableMonths,
} from "@/lib/monthly-exports";
import { expenseReviewStatus } from "@/lib/content-expense";
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

function ymLabel(m: string) {
  const d = new Date(m + "-01");
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

// ── Expense form ──────────────────────────────────────────────────────────
function ExpenseForm({ initial, onSave, onDelete, onClose }: {
  initial?: ContentExpense;
  onSave: (d: Omit<ContentExpense, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { brands, employees } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Omit<ContentExpense, "id">>({
    date:        initial?.date        ?? today,
    month:       initial?.month       ?? today.slice(0, 7),
    employeeId:  initial?.employeeId  ?? employees.find(e => e.kind === "streamer")?.id ?? "",
    brandId:     initial?.brandId,
    brandName:   initial?.brandName   ?? "",
    category:    initial?.category    ?? "Vlog",
    description: initial?.description ?? "",
    amountUsd:   initial?.amountUsd   ?? 0,
    amountThb:   initial?.amountThb,
    paid:        initial?.paid        ?? false,
    paidDate:    initial?.paidDate,
    notes:       initial?.notes       ?? "",
    screenshotUrl: initial?.screenshotUrl ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  // Brand seçildiğinde brandName'i otomatik doldur
  const handleBrand = (bid: string) => {
    if (!bid) { setForm(f => ({ ...f, brandId: undefined })); return; }
    const b = brands.find(x => x.id === bid);
    setForm(f => ({ ...f, brandId: bid, brandName: b?.shortName ?? f.brandName }));
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Tarih" required>
            <Input type="date" value={form.date} onChange={e => { set("date", e.target.value); set("month", e.target.value.slice(0, 7)); }} required />
          </Field>
          <Field label="Ay" required>
            <Input type="month" value={form.month} onChange={e => set("month", e.target.value)} required />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Yayıncı / Rapor Eden" required>
            <Select value={form.employeeId} onChange={e => set("employeeId", e.target.value)} required
              options={employees.filter(e => e.status === "active").map(e => ({ value: e.id, label: e.name }))} />
          </Field>
          <Field label="Marka">
            <Select value={form.brandId ?? ""} onChange={e => handleBrand(e.target.value)}
              options={[{ value: "", label: "— Marka yok —" }, ...brands.map(b => ({ value: b.id, label: `${b.name} (${b.shortName})` }))]} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka Etiketi" hint='Marka olmayan satırlar için manuel etiket (ör. "Siteler", "Reklam")'>
            <Input value={form.brandName} onChange={e => set("brandName", e.target.value)} placeholder="Gala / Pipo / Siteler" />
          </Field>
          <Field label="Kategori">
            <Select value={form.category} onChange={e => set("category", e.target.value)}
              options={[
                { value: "Vlog", label: "Vlog" },
                { value: "Yetişkin İçerik", label: "Yetişkin İçerik" },
                { value: "Site Videoları", label: "Site Videoları" },
                { value: "Yol/Konaklama", label: "Yol / Konaklama" },
                { value: "Ekipman", label: "Ekipman" },
                { value: "Reklam", label: "Reklam" },
                { value: "Diğer", label: "Diğer" },
              ]} />
          </Field>
        </FormGrid>
        <Field label="Açıklama" required>
          <Textarea value={form.description} onChange={e => set("description", e.target.value)} required placeholder="Hangi içerik, hangi gider..." />
        </Field>
        <FormGrid>
          <Field label="Tutar (USD)" required>
            <NumberInput value={form.amountUsd} onChange={v => set("amountUsd", v)} required min={0} step={0.01} />
          </Field>
          <Field label="Tutar (THB - Baht)" hint="Opsiyonel">
            <OptionalNumberInput value={form.amountThb} onChange={v => set("amountThb", v)} min={0} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Ödendi mi?">
            <Select value={form.paid ? "yes" : "no"} onChange={e => set("paid", e.target.value === "yes")}
              options={[{ value: "no", label: "Bekliyor" }, { value: "yes", label: "Ödendi" }]} />
          </Field>
          <Field label="Ödeme Tarihi">
            <Input type="date" value={form.paidDate ?? ""} onChange={e => set("paidDate", e.target.value || undefined)} disabled={!form.paid} />
          </Field>
        </FormGrid>
        <Field label="Kanıt (Resim yükle veya URL)" hint="Dekont/ekran görüntüsü">
          <ProofUploader
            value={form.screenshotUrl ?? ""}
            onChange={(v) => set("screenshotUrl", v)}
            folder="expense"
            placeholder="Resim dosyası yükle veya https://... yapıştır"
          />
        </Field>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="" />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Harcama Ekle"} />
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ContentExpensesPage() {
  const { user } = useAuth();
  const readOnly = useIsReadOnly();
  const {
    contentExpenses, brands, employees,
    addContentExpense, updateContentExpense, deleteContentExpense,
    payContentExpense, unpayContentExpense,
    kasas, kasaTransactions,
    pushNotification,
  } = useStore();
  const defaultKasaId =
    kasas.find((k) => k.isDefault && !k.archived)?.id ??
    kasas.find((k) => !k.archived)?.id ??
    DEFAULT_KASA_ID;

  const [modal, setModal]    = useState<"new" | ContentExpense | null>(null);
  const [reviewModal, setReviewModal] = useState<ContentExpense | null>(null);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [paidFilter,  setPaidFilter]  = useState<"all" | "paid" | "unpaid">("all");

  const months = useMemo(
    () => Array.from(new Set(contentExpenses.map(e => e.month))).sort((a, b) => b.localeCompare(a)),
    [contentExpenses]
  );
  const brandNames = useMemo(
    () => Array.from(new Set(contentExpenses.map(e => e.brandName))).sort(),
    [contentExpenses]
  );

  const filtered = useMemo(
    () => contentExpenses
      .filter(e =>
        (monthFilter === "all" || e.month === monthFilter) &&
        (brandFilter === "all" || e.brandName === brandFilter) &&
        (paidFilter  === "all" || (paidFilter === "paid" ? e.paid : !e.paid)) &&
        (search === "" ||
          e.description.toLowerCase().includes(search.toLowerCase()) ||
          e.brandName.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    [contentExpenses, monthFilter, brandFilter, paidFilter, search]
  );

  const countable   = (e: ContentExpense) => expenseReviewStatus(e) !== "cancelled";
  const total       = filtered.filter(countable).reduce((s, e) => s + e.amountUsd, 0);
  const totalPaid   = filtered.filter(e => e.paid && countable(e)).reduce((s, e) => s + e.amountUsd, 0);
  const totalUnpaid = total - totalPaid;
  const pendingReviews = contentExpenses.filter(e => e.reviewStatus === "pending");
  const canReview = user?.role === "admin" || user?.role === "auditor";
  const canMarkPaid = user?.role === "admin";
  const markExpensePaid = (e: ContentExpense) => {
    const today = new Date().toISOString().slice(0, 10);
    // Aktif kasa varsa varsayılan kasaya `out` hareketi yaratıp bağla;
    // hiç kasa tanımlanmadıysa eski davranışı koru.
    const activeKasa =
      kasas.find((k) => k.id === defaultKasaId && !k.archived) ??
      kasas.find((k) => !k.archived);
    if (activeKasa) {
      payContentExpense({
        contentExpenseId: e.id,
        kasaId: activeKasa.id,
        paidDate: today,
      });
    } else {
      updateContentExpense(e.id, { paid: true, paidDate: today });
    }
    pushNotification({
      type: "expense_paid",
      title: "Harcama ödendi",
      message: `${e.brandName} · ${fmt(e.amountUsd)} ödemesi işlendi.`,
      forRole: "streamer",
      forUserId: e.submittedBy,
      triggeredBy: user?.id,
      refId: e.id,
      href: "/yayinci/harcamalar",
    });
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_approved",
      detail: `Ödeme onaylandı · ${e.brandName} · ${fmt(e.amountUsd)} · ${e.id}`,
    });
  };
  const byBrand     = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(e => map.set(e.brandName, (map.get(e.brandName) ?? 0) + e.amountUsd));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const availableExportMonths = useMemo(
    () => listAvailableMonths(contentExpenses.map((e) => e.month + "-01")),
    [contentExpenses]
  );

  const exportMonth = (ym: string, kind: "pdf" | "csv") => {
    const monthRows = contentExpenses
      .filter((e) => e.month === ym)
      .map((e) => ({
        ...e,
        employeeName: employees.find((em) => em.id === e.employeeId)?.name ?? "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (monthRows.length === 0) {
      window.alert(`${ymLabel(ym)} için dışa aktarılacak kayıt yok.`);
      return;
    }
    if (kind === "pdf") exportContentExpensesPdf(monthRows, ym, { generatedBy: user?.name });
    else exportContentExpensesCsv(monthRows, ym);
  };

  const canExport = user?.role === "admin" || user?.role === "auditor";

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1400px]">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">İçerik Harcamaları</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Yayıncı vlog / yetişkin içerik / site videosu üretim giderleri · marka bazlı izleme
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <MonthlyExportMenu
              month={monthFilter === "all" ? (availableExportMonths[0] ?? new Date().toISOString().slice(0, 7)) : monthFilter}
              availableMonths={availableExportMonths}
              label="Aylık rapor"
              onExportPdf={(ym) => exportMonth(ym, "pdf")}
              onExportCsv={(ym) => exportMonth(ym, "csv")}
            />
          )}
          {!readOnly && (
            <Button size="sm" onClick={() => setModal("new")} className="gap-1.5">
              <Plus size={14} /> Harcama Ekle
            </Button>
          )}
        </div>
      </div>

      {/* Bekleyen onaylar — admin için */}
      {pendingReviews.length > 0 && canReview && (
        <Card className="mb-6 border-amber-300 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="text-amber-600 dark:text-amber-400" size={16} />
              Onay Bekleyen Yayıncı Gönderimleri
            </CardTitle>
            <CardDescription>
              {pendingReviews.length} gönderim · toplam {fmt(pendingReviews.reduce((s, e) => s + e.amountUsd, 0))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReviews.map(e => {
                const emp = employees.find(em => em.id === e.employeeId);
                return (
                  <button key={e.id} onClick={() => setReviewModal(e)}
                    className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg bg-card border border-amber-200 hover:border-amber-400 dark:border-amber-500/40 dark:hover:border-amber-500/70 transition-colors">
                    {e.screenshotUrl && /^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(e.screenshotUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.screenshotUrl} alt="" className="w-12 h-12 rounded-md object-cover border border-border shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted/40 flex items-center justify-center border border-border shrink-0">
                        <Receipt size={16} className="text-muted-foreground/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{e.brandName}</Badge>
                        <span className="text-[11px] text-muted-foreground">{emp?.name} · {e.date}</span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-1 mt-0.5">{e.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums">{fmt(e.amountUsd)}</p>
                      <p className="text-[10px] text-amber-700">İncelemeyi Aç →</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam (Filtreli)", value: fmt(total),       cls: "text-foreground font-bold", icon: Receipt },
          { label: "Ödenmiş",           value: fmt(totalPaid),   cls: "text-green-600",            icon: CheckCircle2 },
          { label: "Bekleyen",          value: fmt(totalUnpaid), cls: totalUnpaid > 0 ? "text-amber-600" : "text-muted-foreground", icon: Circle },
          { label: "Kayıt Sayısı",      value: String(filtered.length), cls: "text-foreground" },
        ].map(k => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
              {k.icon && <k.icon size={11} />}
              {k.label}
            </p>
            <p className={`text-xl tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Marka grafiği */}
      {byBrand.length > 0 && (
        <Card className="mb-6 gap-2 py-5">
          <CardHeader>
            <CardTitle>Marka Bazlı Dağılım</CardTitle>
            <CardDescription>{filtered.length} harcama · {monthFilter === "all" ? "tüm aylar" : ymLabel(monthFilter)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byBrand}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <RTooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filtreler */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-44 text-xs h-8"
          options={[{ value: "all", label: "Tüm Aylar" }, ...months.map(m => ({ value: m, label: ymLabel(m) }))]} />
        <Select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="w-40 text-xs h-8"
          options={[{ value: "all", label: "Tüm Markalar" }, ...brandNames.map(b => ({ value: b, label: b }))]} />
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(["all", "unpaid", "paid"] as const).map(f => (
            <button key={f} onClick={() => setPaidFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                paidFilter === f ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}>
              {f === "all" ? "Tümü" : f === "paid" ? "Ödenmiş" : "Bekleyen"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <UInput placeholder="Açıklama veya marka..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-8 text-sm pl-8" />
        </div>
      </div>

      {/* Tablo */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Tarih","Yayıncı","Marka","Kategori","Açıklama","USD","Durum",""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const emp   = employees.find(em => em.id === e.employeeId);
                const brand = brands.find(b => b.id === e.brandId);
                return (
                  <tr key={e.id} className="border-b border-border/60 hover:bg-accent/20 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={10} className="opacity-50" />
                        {e.date}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap">{emp?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px]"
                        style={brand ? { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" } : {}}>
                        {e.brandName}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{e.category}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-foreground">{e.description}</p>
                      {e.amountThb && (
                        <p className="text-[11px] text-muted-foreground">{e.amountThb.toLocaleString("tr-TR")} THB</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold text-foreground whitespace-nowrap">{fmt(e.amountUsd)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {(() => {
                        const st = expenseReviewStatus(e);
                        if (st === "pending") return (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40 gap-1 text-[10px]">
                            <Clock size={10} /> İncelemede
                          </Badge>
                        );
                        if (st === "needs_info") return (
                          <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 dark:text-orange-300 dark:border-orange-500/45 dark:bg-orange-950/40 gap-1 text-[10px]">
                            <AlertCircle size={10} /> Bilgi İsteniyor
                          </Badge>
                        );
                        if (st === "rejected") return (
                          <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40 gap-1 text-[10px]">
                            <X size={10} /> Reddedildi
                          </Badge>
                        );
                        if (st === "cancelled") return (
                          <Badge variant="outline" className="text-muted-foreground border-border bg-muted/50 gap-1 text-[10px]">
                            <X size={10} /> Geri çekildi
                          </Badge>
                        );
                        if (e.paid) return (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40 gap-1 text-[10px]">
                            <CheckCircle2 size={10} /> Ödendi
                          </Badge>
                        );
                        return (
                          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40 gap-1 text-[10px]">
                            <CheckCircle2 size={10} /> Onaylı · Ödeme Bekliyor
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {e.screenshotUrl && (
                          <a href={e.screenshotUrl} target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" title="Kanıtı aç">
                            <ImageIcon size={11} />
                          </a>
                        )}
                        {!readOnly && (
                          <button onClick={() => setModal(e)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Düzenle">
                            <Pencil size={12} />
                          </button>
                        )}
                        {canReview && e.reviewStatus === "pending" && (
                          <button
                            type="button"
                            onClick={() => setReviewModal(e)}
                            className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                            aria-label="Harcamayı incele ve onayla"
                          >
                            İncele
                          </button>
                        )}
                        {canMarkPaid && expenseReviewStatus(e) === "approved" && !e.paid && (
                          <button
                            type="button"
                            onClick={() => markExpensePaid(e)}
                            className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-950/45 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            aria-label="Onaylı harcamayı ödendi işaretle"
                          >
                            Ödeme Onayla
                          </button>
                        )}
                        {user?.role === "auditor" && e.reviewStatus !== "pending" && !e.audited && (
                          <button onClick={() => updateContentExpense(e.id, { audited: true })}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/45 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                            Audit ✓
                          </button>
                        )}
                        {e.audited && (
                          <Badge variant="outline" className="text-[9px] text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40">Audited</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Eşleşen kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal === "new" ? "Yeni İçerik Harcaması" : "Harcamayı Düzenle"} size="lg">
        {modal && (
          <ExpenseForm
            key={modal === "new" ? "new" : modal.id}
            initial={modal === "new" ? undefined : modal}
            onSave={d => { if (modal === "new") addContentExpense(d); else updateContentExpense(modal.id, d); }}
            onDelete={modal !== "new" ? () => { deleteContentExpense(modal.id); setModal(null); } : undefined}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      {/* Review modal */}
      <Modal open={reviewModal !== null} onClose={() => setReviewModal(null)}
        title="Harcama İncele & Onayla" size="lg">
        {reviewModal && (
          <ReviewForm
            expense={reviewModal}
            reviewerId={user?.id ?? ""}
            employees={employees}
            canMarkPaid={canMarkPaid}
            kasas={kasas}
            kasaTransactions={kasaTransactions}
            defaultKasaId={defaultKasaId}
            onApprove={(note, markPaid, kasaPayload) => {
              const today = new Date().toISOString().slice(0, 10);
              updateContentExpense(reviewModal.id, {
                reviewStatus: "approved",
                reviewedAt: new Date().toISOString(),
                reviewedBy: user?.id,
                reviewerNote: note,
                // Eğer ödeme kasaya bağlıysa payContentExpense paid alanını set edecek;
                // burada yalnızca inceleme metadata'sını güncelliyoruz.
                paid: markPaid && !kasaPayload ? true : reviewModal.paid,
                paidDate: markPaid && !kasaPayload ? today : reviewModal.paidDate,
              });
              if (markPaid && kasaPayload) {
                payContentExpense({
                  contentExpenseId: reviewModal.id,
                  kasaId: kasaPayload.kasaId,
                  paidDate: today,
                  feeUsd: kasaPayload.feeUsd,
                  notes: note,
                });
              }
              const emp = employees.find(em => em.id === reviewModal.employeeId);
              pushNotification({
                type: markPaid ? "expense_paid" : "expense_approved",
                title: markPaid ? "Harcaman onaylandı ve ödendi" : "Harcaman onaylandı",
                message: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} — ${note || (markPaid ? "Ödendi" : "Onaylandı")}`,
                forRole: "streamer",
                forUserId: reviewModal.submittedBy,
                triggeredBy: user?.id,
                refId: reviewModal.id,
                href: "/yayinci/harcamalar",
              });
              logAudit({
                actorId: user?.id ?? "unknown",
                actorName: user?.name ?? "?",
                action: "expense_approved",
                detail: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} · ${reviewModal.id}`,
              });
              setReviewModal(null);
            }}
            onReject={(note) => {
              updateContentExpense(reviewModal.id, {
                reviewStatus: "rejected",
                reviewedAt: new Date().toISOString(),
                reviewedBy: user?.id,
                reviewerNote: note,
              });
              pushNotification({
                type: "expense_rejected",
                title: `Harcaman reddedildi`,
                message: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} — ${note}`,
                forRole: "streamer",
                forUserId: reviewModal.submittedBy,
                triggeredBy: user?.id,
                refId: reviewModal.id,
              });
              logAudit({
                actorId: user?.id ?? "unknown",
                actorName: user?.name ?? "?",
                action: "expense_rejected",
                detail: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} · ${note.slice(0, 120)}`,
              });
              setReviewModal(null);
            }}
            onNeedsInfo={(note) => {
              updateContentExpense(reviewModal.id, {
                reviewStatus: "needs_info",
                reviewedAt: new Date().toISOString(),
                reviewedBy: user?.id,
                reviewerNote: note,
              });
              pushNotification({
                type: "general",
                title: `Harcaman için ek bilgi gerekiyor`,
                message: `${reviewModal.brandName} · ${note}`,
                forRole: "streamer",
                forUserId: reviewModal.submittedBy,
                triggeredBy: user?.id,
                refId: reviewModal.id,
              });
              logAudit({
                actorId: user?.id ?? "unknown",
                actorName: user?.name ?? "?",
                action: "expense_needs_info",
                detail: `${reviewModal.brandName} · ${note.slice(0, 120)}`,
              });
              setReviewModal(null);
            }}
            onClose={() => setReviewModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Review Form ──────────────────────────────────────────────────────────
function ReviewForm({
  expense,
  employees,
  canMarkPaid,
  kasas,
  kasaTransactions,
  defaultKasaId,
  onApprove,
  onReject,
  onNeedsInfo,
  onClose,
}: {
  expense: ContentExpense;
  reviewerId: string;
  employees: { id: string; name: string }[];
  canMarkPaid: boolean;
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  defaultKasaId: string;
  onApprove: (note: string, markPaid: boolean, kasa?: { kasaId: string; feeUsd: number }) => void;
  onReject: (note: string) => void;
  onNeedsInfo: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote]         = useState(expense.reviewerNote ?? "");
  const [markPaid, setMarkPaid] = useState(canMarkPaid);
  const activeKasas = kasas.filter((k) => !k.archived);
  const [kasaId, setKasaId] = useState<string>(defaultKasaId);
  const [feeUsd, setFeeUsd] = useState<number>(0);
  const selectedKasa = activeKasas.find((k) => k.id === kasaId) ?? activeKasas[0];
  const balance = selectedKasa ? calcKasaBalance(kasaTransactions, undefined, selectedKasa.id) : 0;
  const projected = balance - (expense.amountUsd || 0) - feeUsd;
  const isLow = markPaid && projected < 0;
  const emp = employees.find(em => em.id === expense.employeeId);
  const submitted = expense.submittedAt ? new Date(expense.submittedAt).toLocaleString("tr-TR") : "—";

  return (
    <div className="space-y-4">
      {/* Görsel önizleme */}
      {expense.screenshotUrl && (
        <div className="border border-border rounded-lg p-2 bg-muted/30 flex items-center justify-center max-h-72 overflow-hidden">
          {/^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(expense.screenshotUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={expense.screenshotUrl} alt="" className="max-h-64 object-contain" />
          ) : (
            <a href={expense.screenshotUrl} target="_blank" rel="noopener"
              className="text-sm text-blue-600 inline-flex items-center gap-1.5 px-3 py-2">
              <ExternalLink size={14} />
              Kanıt dosyasını yeni sekmede aç
            </a>
          )}
        </div>
      )}

      {/* Detaylar */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Yayıncı:</span> <strong>{emp?.name}</strong></div>
        <div><span className="text-muted-foreground">Tarih:</span> <strong>{expense.date}</strong></div>
        <div><span className="text-muted-foreground">Marka:</span> <Badge variant="outline">{expense.brandName}</Badge></div>
        <div><span className="text-muted-foreground">Kategori:</span> <strong>{expense.category}</strong></div>
        <div><span className="text-muted-foreground">Tutar:</span> <strong className="text-base">{fmt(expense.amountUsd)}</strong>
          {expense.amountThb ? ` (${expense.amountThb.toLocaleString("tr-TR")} ฿)` : ""}</div>
        <div><span className="text-muted-foreground">Gönderim:</span> <span className="text-xs">{submitted}</span></div>
      </div>

      <div className="px-3 py-2.5 rounded-lg bg-muted/40 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Açıklama</p>
        <p className="text-sm">{expense.description}</p>
        {expense.notes && (
          <>
            <p className="text-xs text-muted-foreground mt-2 mb-1">Yayıncı notu</p>
            <p className="text-xs">{expense.notes}</p>
          </>
        )}
      </div>

      {/* Yönetici notu */}
      <Field label="Yönetici Notu" hint="Onay/Red sebebi (yayıncı görecek)">
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ek bilgi, neden vs..." rows={3} />
      </Field>

      {canMarkPaid ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <input type="checkbox" id="markPaid" checked={markPaid} onChange={e => setMarkPaid(e.target.checked)}
              className="rounded border-border" />
            <label htmlFor="markPaid">Onayla ve aynı zamanda <strong>ödendi</strong> olarak işaretle (kasadan düş)</label>
          </div>
          {markPaid && activeKasas.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
              <FormGrid>
                <Field label="Kasa" required>
                  {activeKasas.length === 1 ? (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5"><Wallet size={13} /> {activeKasas[0].name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{fmt(balance)}</span>
                    </div>
                  ) : (
                    <Select
                      value={kasaId}
                      onChange={(e) => setKasaId(e.target.value)}
                      options={activeKasas.map((k) => ({
                        value: k.id,
                        label: `${k.name} · ${fmt(calcKasaBalance(kasaTransactions, undefined, k.id))}`,
                      }))}
                    />
                  )}
                </Field>
                <Field label="Komisyon / Fee ($)" hint="Opsiyonel">
                  <NumberInput value={feeUsd} onChange={(v) => setFeeUsd(v)} min={0} step={1} />
                </Field>
              </FormGrid>
              <div
                className={[
                  "rounded-lg border px-3 py-2 text-xs flex items-center justify-between",
                  isLow
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
                    : "border-border bg-card text-muted-foreground",
                ].join(" ")}
              >
                <span>Mevcut bakiye: <strong className="tabular-nums">{fmt(balance)}</strong></span>
                <span>Ödeme sonrası: <strong className="tabular-nums">{fmt(projected)}</strong></span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-200">
          Denetçi onayı harcamayı kabul eder; ödeme işaretleme yetkisi yöneticidedir.
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-border">
        <Button type="button" variant="ghost" onClick={onClose}>İptal</Button>
        <Button type="button" variant="outline" onClick={() => onNeedsInfo(note || "Ek bilgi gerekli")}
          className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/40">
          <MessageSquare size={13} /> Bilgi İste
        </Button>
        <Button type="button" variant="outline" onClick={() => onReject(note || "Reddedildi")}
          className="gap-1.5 border-red-300 text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:border-red-500/40">
          <X size={13} /> Reddet
        </Button>
        <Button
          type="button"
          onClick={() =>
            onApprove(
              note,
              canMarkPaid ? markPaid : false,
              canMarkPaid && markPaid && selectedKasa
                ? { kasaId: selectedKasa.id, feeUsd }
                : undefined,
            )
          }
          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 size={13} /> Onayla
        </Button>
      </div>
    </div>
  );
}
