"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Eye, Wallet } from "lucide-react";
import {
  useStore,
  calcKasaBalance,
  DEFAULT_KASA_ID,
  type ExpenseEntry,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { fmt, CHART_COLORS } from "@/lib/data";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/page-header";
import SectionCard from "@/components/section-card";
import DonutPie from "@/components/charts/donut-pie";
import BreakdownBar from "@/components/charts/breakdown-bar";

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
  });

  // Kasa düşümü sadece yeni kayıt eklenirken sorulur.
  const activeKasas = kasas.filter((k) => !k.archived);
  const hasKasa = activeKasas.length > 0;
  const [deductFromKasa, setDeductFromKasa] = useState<boolean>(!isEdit && hasKasa);
  const [kasaId, setKasaId] = useState<string>(defaultKasaId);
  const [feeUsd, setFeeUsd] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

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
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Açıklama" required>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} required placeholder="Ne için ödendi?" />
          </Field>
        </FormGrid>

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

  const totalYillik = expenses.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const byCategory = EXPENSE_CATEGORIES.map((cat) => {
    const items = expenses.filter((e) => e.category === cat);
    return { kategori: cat, yillik: items.reduce((s, e) => s + e.amount, 0), count: items.length };
  }).filter((c) => c.yillik > 0);

  const displayedExpenses = filterCat === "Tümü"
    ? expenses
    : expenses.filter((e) => e.category === filterCat);

  const sortedExpenses = [...displayedExpenses].sort((a, b) => b.date.localeCompare(a.date));

  const pieData = byCategory.map((c) => ({ name: c.kategori, value: c.yillik }));
  const barData = byCategory;

  return (
    <div className="p-3 sm:p-6 md:p-8">
      <PageHeader
        title="Giderler"
        subtitle={
          isSupabaseClientMode()
            ? "Tüm gider kalemleri · Supabase expense_entries ile senkronize"
            : "Tüm gider kalemleri, kategori analizi ve harcama takibi"
        }
        badge="Genel Giderler"
        badgeTone="red"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Toplam Gider", value: fmt(totalYillik),                        cls: "text-red-400" },
          { label: "Aylık Ort.",   value: fmt(Math.round(totalYillik / 12)),       cls: "text-amber-400" },
          { label: "Kayıt Sayısı", value: String(expenses.length),                 cls: "text-foreground" },
          { label: "Kategori",     value: String(byCategory.length),               cls: "text-foreground" },
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
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">Gider Kayıtları</p>
            <div className="flex gap-1 flex-wrap">
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
          {!readOnly && (
            <Button size="sm" onClick={() => setModal("new")} className="gap-1.5 h-7 text-xs shrink-0">
              <Plus size={13} /> Gider Ekle
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {["Tarih","Kategori","Açıklama","Kasa","Tutar",""].map((h, i) => (
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
                    <td className="px-4 py-3 text-foreground">{e.description}</td>
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
                      <button
                        type="button"
                        onClick={() => setModal(e)}
                        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        aria-label={readOnly ? "Detayı görüntüle" : "Gideri düzenle"}
                      >
                        {readOnly ? <Eye size={13} /> : <Pencil size={13} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedExpenses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/40">Kayıt bulunamadı</td></tr>
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
