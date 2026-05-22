"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Eye, Wallet, Tag, Filter, Search, CalendarRange, Trash2 } from "lucide-react";
import {
  useStore,
  calcKasaBalance,
  DEFAULT_KASA_ID,
  type ExpenseEntry,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { fmt, CHART_COLORS } from "@/lib/data";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/page-header";
import SectionCard from "@/components/section-card";
import DonutPie from "@/components/charts/donut-pie";
import BreakdownBar from "@/components/charts/breakdown-bar";
import { brandLabel } from "@/lib/brand-expenses";

const EXPENSE_CATEGORIES = [
  "Yazılım & Araçlar",
  "Sunucu & Altyapı",
  "Ofis & Kira",
  "Pazarlama Gideri",
  "Hukuki & Mali",
  "Ulaşım",
  "Donanım",
  "Diğer",
];

type ExpenseKasaPayload = {
  kasaId: string;
  feeUsd?: number;
  notes?: string;
  proof?: string;
};

function ExpenseForm({
  initial,
  readOnly = false,
  kasas,
  brands,
  defaultKasaId,
  kasaTransactions,
  onSave,
  onCreate,
  onDelete,
  onClose,
}: {
  initial?: ExpenseEntry;
  readOnly?: boolean;
  kasas: Kasa[];
  brands: { id: string; name: string; shortName?: string }[];
  defaultKasaId: string;
  kasaTransactions: KasaTransaction[];
  onSave: (data: Omit<ExpenseEntry, "id">) => void;
  onCreate?: (data: Omit<ExpenseEntry, "id" | "kasaTxId">, kasa?: ExpenseKasaPayload) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<ExpenseEntry, "id">>({
    category:    initial?.category    ?? EXPENSE_CATEGORIES[0],
    amount:      initial?.amount      ?? 0,
    date:        initial?.date        ?? new Date().toISOString().slice(0, 10),
    description: initial?.description ?? "",
    brandId:     initial?.brandId,
  });

  // Kasa düşümü sadece yeni kayıt eklenirken sorulur.
  const activeKasas = kasas.filter((k) => !k.archived);
  const hasKasa = activeKasas.length > 0;
  const [deductFromKasa, setDeductFromKasa] = useState<boolean>(!isEdit && hasKasa);
  const [kasaId, setKasaId] = useState<string>(defaultKasaId);
  const [feeUsd, setFeeUsd] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const set = (k: keyof typeof form, v: string | number | undefined) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectedKasa = activeKasas.find((k) => k.id === kasaId) ?? activeKasas[0];
  const balance = useMemo(
    () => (selectedKasa ? calcKasaBalance(kasaTransactions, undefined, selectedKasa.id) : 0),
    [selectedKasa, kasaTransactions],
  );
  const projectedBalance = balance - (form.amount || 0) - (feeUsd || 0);
  const isLow = deductFromKasa && projectedBalance < 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        if (!isEdit && onCreate) {
          onCreate(
            form,
            deductFromKasa && selectedKasa
              ? { kasaId: selectedKasa.id, feeUsd, notes }
              : undefined,
          );
        } else {
          onSave(form);
        }
        onClose();
      }}
    >
      <fieldset disabled={readOnly} className="grid gap-4 disabled:opacity-90">
        <FormGrid>
          <Field label="Kategori" required>
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Tutar ($)" required>
            <NumberInput value={form.amount} onChange={(v) => set("amount", v)} required min={0} step={10} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Tarih">
            <DateTimePicker mode="date" value={form.date} onChange={(v) => set("date", v)} />
          </Field>
          <Field label="Marka" hint="Opsiyonel — marka panelinde görünür">
            <Select
              value={form.brandId ?? ""}
              onChange={(e) => set("brandId", e.target.value || undefined)}
              options={[
                { value: "", label: "Marka yok (genel gider)" },
                ...brands
                  .filter((b) => b.id)
                  .map((b) => ({
                    value: b.id,
                    label: b.shortName || b.name,
                  })),
              ]}
            />
          </Field>
        </FormGrid>
        <Field label="Açıklama" required>
          <Input value={form.description} onChange={(e) => set("description", e.target.value)} required placeholder="Ne için ödendi?" />
        </Field>

        {!isEdit && hasKasa && (
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={deductFromKasa}
                onChange={(e) => setDeductFromKasa(e.target.checked)}
                className="rounded border-border"
              />
              <Wallet size={14} className="text-muted-foreground" />
              Kasadan da düş (otomatik <code className="text-xs">out</code> hareketi)
            </label>
            {deductFromKasa && (
              <div className="space-y-3 pl-1">
                <FormGrid>
                  <Field label="Kasa" required>
                    {activeKasas.length === 1 ? (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm flex items-center justify-between">
                        <span>{activeKasas[0].name}</span>
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
                <Field label="Kasa hareketi notu" hint="Opsiyonel">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Ödeme yöntemi, referans no, vb."
                  />
                </Field>
                <div
                  className={[
                    "rounded-lg border px-3 py-2 text-xs flex items-center justify-between",
                    isLow
                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
                      : "border-border bg-card text-muted-foreground",
                  ].join(" ")}
                >
                  <span>Mevcut bakiye: <strong className="tabular-nums">{fmt(balance)}</strong></span>
                  <span>Ödeme sonrası: <strong className="tabular-nums">{fmt(projectedBalance)}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {isEdit && initial?.kasaTxId && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <Wallet size={13} />
            Bu gider, kasa hareketine bağlı. Kasayı değiştirmek için Kasa sayfasını kullanın.
          </div>
        )}
      </fieldset>
      {readOnly ? (
        <div className="flex justify-end pt-4 mt-5 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Kapat
          </button>
        </div>
      ) : (
        <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Gider Ekle"} />
      )}
    </form>
  );
}

export default function GiderlerPage() {
  const {
    expenses,
    brands,
    addExpense,
    updateExpense,
    deleteExpense,
    recordExpense,
    kasas,
    kasaTransactions,
  } = useStore();
  const readOnly = useIsReadOnly();
  const [modal, setModal] = useState<"new" | ExpenseEntry | null>(null);
  const [filterCat, setFilterCat] = useState("Tümü");
  const [filterBrand, setFilterBrand] = useState("Tümü");
  const [filterKasa, setFilterKasa] = useState("Tümü");
  const [filterMonth, setFilterMonth] = useState("Tümü");
  const [filterSource, setFilterSource] = useState<"Tümü" | "Manuel" | "Planlanan">("Tümü");
  const [filterLink, setFilterLink] = useState<"Tümü" | "Kasaya bağlı" | "Kasasız">("Tümü");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState<number>(0);
  const [maxAmount, setMaxAmount] = useState<number>(0);
  const defaultKasaId =
    kasas.find((k) => k.isDefault && !k.archived)?.id ??
    kasas.find((k) => !k.archived)?.id ??
    DEFAULT_KASA_ID;
  const kasaNameById = useMemo(() => {
    const m = new Map<string, string>();
    kasas.forEach((k) => m.set(k.id, k.name));
    return m;
  }, [kasas]);
  const kasaTxIndex = useMemo(() => {
    const m = new Map<string, KasaTransaction>();
    kasaTransactions.forEach((t) => m.set(t.id, t));
    return m;
  }, [kasaTransactions]);

  const activeBrands = useMemo(
    () => brands.filter((b) => b.status === "active"),
    [brands]
  );
  const months = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a)),
    [expenses]
  );

  const displayedExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = search.trim().toLowerCase();
      if (filterCat !== "Tümü" && e.category !== filterCat) return false;
      if (filterBrand === "Markasız" && e.brandId) return false;
      if (filterBrand !== "Tümü" && filterBrand !== "Markasız" && e.brandId !== filterBrand) return false;
      if (filterMonth !== "Tümü" && e.date.slice(0, 7) !== filterMonth) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      if (filterSource === "Planlanan" && !e.plannedItemId) return false;
      if (filterSource === "Manuel" && e.plannedItemId) return false;
      if (filterLink === "Kasaya bağlı" && !e.kasaTxId) return false;
      if (filterLink === "Kasasız" && e.kasaTxId) return false;
      if (minAmount > 0 && e.amount < minAmount) return false;
      if (maxAmount > 0 && e.amount > maxAmount) return false;
      if (filterKasa !== "Tümü") {
        const tx = e.kasaTxId ? kasaTxIndex.get(e.kasaTxId) : undefined;
        if (!tx || tx.kasaId !== filterKasa) return false;
      }
      if (q) {
        const brand = e.brandId ? brandLabel(brands, e.brandId) : "";
        if (
          !e.description.toLowerCase().includes(q) &&
          !e.category.toLowerCase().includes(q) &&
          !brand.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    expenses,
    filterCat,
    filterBrand,
    filterKasa,
    filterMonth,
    filterSource,
    filterLink,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    search,
    kasaTxIndex,
    brands,
  ]);

  const sortedExpenses = [...displayedExpenses].sort((a, b) => b.date.localeCompare(a.date));
  const totalYillik = displayedExpenses.reduce((s, e) => s + e.amount, 0);
  const linkedTotal = displayedExpenses.filter((e) => e.kasaTxId).reduce((s, e) => s + e.amount, 0);
  const plannedTotal = displayedExpenses.filter((e) => e.plannedItemId).reduce((s, e) => s + e.amount, 0);
  const hasActiveFilters =
    filterCat !== "Tümü" ||
    filterBrand !== "Tümü" ||
    filterKasa !== "Tümü" ||
    filterMonth !== "Tümü" ||
    filterSource !== "Tümü" ||
    filterLink !== "Tümü" ||
    !!search ||
    !!dateFrom ||
    !!dateTo ||
    minAmount > 0 ||
    maxAmount > 0;
  const clearFilters = () => {
    setFilterCat("Tümü");
    setFilterBrand("Tümü");
    setFilterKasa("Tümü");
    setFilterMonth("Tümü");
    setFilterSource("Tümü");
    setFilterLink("Tümü");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setMinAmount(0);
    setMaxAmount(0);
  };

  const byCategory = EXPENSE_CATEGORIES.map((cat) => {
    const items = displayedExpenses.filter((e) => e.category === cat);
    return { kategori: cat, yillik: items.reduce((s, e) => s + e.amount, 0), count: items.length };
  }).filter((c) => c.yillik > 0);

  const pieData = byCategory.map((c) => ({ name: c.kategori, value: c.yillik }));
  const barData = byCategory;

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <PageHeader
        title="Giderler"
        subtitle="Şirket içi gider kalemlerini ekleyin, kategoriye göre analiz edin ve kasaya bağlayarak harcamayı düşürün."
        badge="Genel Giderler"
        badgeTone="red"
      />

      <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <Filter size={14} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Gider filtreleri</p>
              <p className="text-xs text-muted-foreground">Varsayılan görünüm tüm geçmiş kayıtları gösterir.</p>
            </div>
          </div>
          {!readOnly && (
            <Button size="sm" onClick={() => setModal("new")} className="gap-1.5 h-8 text-xs shrink-0">
              <Plus size={13} /> Gider Ekle
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs w-full">
          <Select
            className="h-8 w-auto min-w-[120px] text-xs"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            options={[
              { value: "Tümü", label: "Tüm geçmiş" },
              ...months.map((m) => ({ value: m, label: m })),
            ]}
          />
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Başlangıç tarihi"
          />
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Bitiş tarihi"
          />
          <Select
            className="h-8 w-auto min-w-[120px] text-xs"
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            options={[
              { value: "Tümü", label: "Tüm markalar" },
              { value: "Markasız", label: "Markasız" },
              ...activeBrands.map((b) => ({
                value: b.id,
                label: b.shortName || b.name,
              })),
            ]}
          />
          <Select
            className="h-8 w-auto min-w-[110px] text-xs"
            value={filterKasa}
            onChange={(e) => setFilterKasa(e.target.value)}
            options={[
              { value: "Tümü", label: "Tüm kasalar" },
              ...kasas
                .filter((k) => !k.archived)
                .map((k) => ({ value: k.id, label: k.name })),
            ]}
          />
          <Select
            className="h-8 w-auto min-w-[120px] text-xs"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
            options={[
              { value: "Tümü", label: "Tüm kaynaklar" },
              { value: "Manuel", label: "Manuel" },
              { value: "Planlanan", label: "Planlanan" },
            ]}
          />
          <Select
            className="h-8 w-auto min-w-[115px] text-xs"
            value={filterLink}
            onChange={(e) => setFilterLink(e.target.value as typeof filterLink)}
            options={[
              { value: "Tümü", label: "Kasa: tümü" },
              { value: "Kasaya bağlı", label: "Kasaya bağlı" },
              { value: "Kasasız", label: "Kasasız" },
            ]}
          />
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-48 pl-7 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Açıklama / marka ara"
            />
          </div>
          <NumberInput value={minAmount} onChange={setMinAmount} min={0} step={50} className="h-8 w-24 text-xs" placeholder="Min" />
          <NumberInput value={maxAmount} onChange={setMaxAmount} min={0} step={50} className="h-8 w-24 text-xs" placeholder="Max" />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Filtreleri temizle
          </Button>
        </div>
        <div className="flex gap-1 flex-wrap w-full">
          {["Tümü", ...EXPENSE_CATEGORIES.filter((c) => expenses.some((e) => e.category === c))].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={[
                "text-xs px-2 py-1 rounded-md transition-colors",
                filterCat === cat
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              ].join(" ")}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Gider", value: fmt(totalYillik),                        cls: "text-red-400" },
          { label: "Kasaya Bağlı", value: fmt(linkedTotal),                        cls: "text-green-500" },
          { label: "Plan Kaynaklı", value: fmt(plannedTotal),                      cls: "text-blue-500" },
          { label: "Kayıt Sayısı", value: String(displayedExpenses.length),        cls: "text-foreground" },
        ].map(k => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Kategori Dağılımı">
          <DonutPie data={pieData} height={260} colors={["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#06b6d4","#8b5cf6"]} />
        </SectionCard>
        <SectionCard title="Kategori Karşılaştırması">
          <BreakdownBar
            data={barData}
            series={[{ key: "yillik", label: "Toplam Gider", color: CHART_COLORS.gider }]}
            categoryKey="kategori"
            height={260}
            horizontal
          />
        </SectionCard>
      </div>

      {/* Expense entries */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap w-full">
            <p className="text-sm font-medium text-foreground">Gider Kayıtları</p>
            <span className="text-xs text-muted-foreground ml-auto">
              {displayedExpenses.length} / {expenses.length} kayıt gösteriliyor
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {["Tarih","Kategori","Marka","Açıklama","Kaynak","Kasa","Tutar",""].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.map((e) => {
                const linkedTx = e.kasaTxId ? kasaTxIndex.get(e.kasaTxId) : undefined;
                const kasaLabel = linkedTx ? kasaNameById.get(linkedTx.kasaId) ?? "—" : null;
                return (
                  <tr key={e.id} className="border-b border-border/60 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs text-muted-foreground">{e.category}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {e.brandId ? (
                        <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
                          <Tag size={11} /> {brandLabel(brands, e.brandId)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <div>{e.description}</div>
                      {e.plannedItemId && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-300 mt-0.5">
                          Planlanan bağlantısı: {e.plannedItemId.slice(0, 8)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {e.plannedItemId ? (
                        <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40">
                          <CalendarRange size={10} /> Planlanan
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Manuel</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {kasaLabel ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Wallet size={11} /> {kasaLabel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-red-400 tabular-nums font-medium whitespace-nowrap">{fmt(e.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setModal(e)}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          aria-label={readOnly ? "Detayı görüntüle" : "Gideri düzenle"}
                        >
                          {readOnly ? <Eye size={13} /> : <Pencil size={13} />}
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Bu gider kaydı silinsin mi? Bağlı plan bağlantısı temizlenir.")) {
                                deleteExpense(e.id);
                              }
                            }}
                            className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                            aria-label="Gideri sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedExpenses.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground/40">Kayıt bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={readOnly ? "Gider Detayı" : modal === "new" ? "Gider Ekle" : "Gideri Düzenle"}
        size="sm"
      >
        <ExpenseForm
          initial={modal !== "new" && modal !== null ? modal : undefined}
          readOnly={readOnly}
          kasas={kasas}
          brands={activeBrands}
          defaultKasaId={defaultKasaId}
          kasaTransactions={kasaTransactions}
          onSave={(data) => {
            if (modal === "new") addExpense(data);
            else if (modal !== null) updateExpense(modal.id, data);
          }}
          onCreate={(data, kasa) => recordExpense(data, kasa)}
          onDelete={!readOnly && modal !== "new" && modal !== null ? () => { deleteExpense(modal.id); setModal(null); } : undefined}
          onClose={() => setModal(null)}
        />
      </Modal>
    </div>
  );
}
