"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Pencil, Search, CheckCircle2, Circle, Receipt, Calendar,
  ExternalLink, AlertCircle, X, Image as ImageIcon, MessageSquare, Clock, Wallet,
  ArrowRightLeft, Lock, Unlock, History, AlertTriangle, Eye,
} from "lucide-react";
import {
  useStore,
  DEFAULT_KASA_ID,
  type ContentExpense,
  type Employee,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import {
  canViewRamizWallet,
  filterKasasForRamizViewer,
  filterKasaTransactionsForRamizViewer,
} from "@/lib/ramiz-wallet-access";
import { logAudit } from "@/store/audit-log";
import { fmt, defaultSnapshotDateInMonth, toYearMonthLocal } from "@/lib/data";
import {
  computeTronPanelMetrics,
  kasaPaymentBalance,
  kasaSelectOptionLabel,
} from "@/lib/kasa-tron-metrics";
import { fmtDateTime } from "@/lib/fmt-date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input as UInput } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { t } from "@/lib/i18n/t";
import { Field, Input, NumberInput, OptionalNumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { BrandMultiSelect } from "@/components/brand-multi-select";
import {
  buildExpenseBrandFields,
  expenseMatchesBrand,
  formatExpenseBrandLabel,
  resolveExpenseBrandIds,
} from "@/lib/content-expense-brands";
import { ProofUploader } from "@/components/proof-uploader";
import { NoI18n } from "@/components/no-i18n";
import { MonthlyExportMenu } from "@/components/monthly-export-menu";
import type { AppNotification } from "@/store/store";
import {
  exportContentExpensesCsv,
  exportContentExpensesPdf,
  listAvailableMonths,
} from "@/lib/monthly-exports";
import {
  expenseReviewStatus,
  isActiveContentExpense,
  settlementLabel,
  CONTENT_EXPENSE_CATEGORIES,
  CONTENT_EXPENSE_EXCEPTION_KINDS,
  CONTENT_EXPENSE_EXCEPTION_LABELS,
  encodeExpenseExceptionInNotes,
  exceptionLabel,
  isExceptionWriteOff,
  isPayrollSettled,
  isKasaSettled,
  canAdminPayContentFromKasa,
  hasDoubleSettlementConflict,
  matchesSettlementFilter,
  resolveExpenseException,
  isUnsettledApprovedContent,
  isExpenseCountedPaid,
  isWithdrawnContentExpense,
  filterContentExpensesForViewer,
  isContentExpenseReleasedToTeam,
  contentExpenseReleasePatch,
  isPayrollLinkedContentExpense,
  isAwaitingContentExpenseReview,
  type ContentExpenseExceptionKind,
  type ContentExpenseSettlementFilter,
} from "@/lib/content-expense";
import {
  fetchLockedContentExpenseMonths,
  isContentExpenseMonthLocked,
  setContentExpenseMonthLocked,
} from "@/lib/content-expense-month-lock";
import { ContentExpenseKasaPayModal } from "@/components/content-expense-kasa-pay-modal";
import { ContentExpenseBulkPayrollToKasaModal } from "@/components/content-expense-bulk-payroll-to-kasa-modal";
import { isMainAdmin } from "@/lib/user-guards";
import { useAuditLog } from "@/store/audit-log";
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

function ymLabel(m: string) {
  const d = new Date(m + "-01");
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

// ── Expense form ──────────────────────────────────────────────────────────
function ExpenseForm({
  initial,
  defaultDate,
  onSave,
  onDelete,
  onClose,
  adminSettle,
}: {
  initial?: ContentExpense;
  /** Yeni kayıt için varsayılan tarih (seçili ay filtresinden). */
  defaultDate?: string;
  onSave: (d: Omit<ContentExpense, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
  /** Yönetici: ödeme yolunu düzenlerken maaş ↔ kasa geçişi. */
  adminSettle?: {
    onPayFromKasa: () => void;
    onSettlePayroll: () => void;
    onUnsettlePayroll: () => void;
    onUnpayKasa: () => void;
  };
}) {
  const { brands, employees } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const initDate = initial?.date ?? defaultDate ?? today;
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(() =>
    initial ? resolveExpenseBrandIds(initial, brands) : []
  );
  const initialExc = initial ? resolveExpenseException(initial) : {};
  const [form, setForm] = useState<Omit<ContentExpense, "id">>({
    date:        initDate,
    month:       initDate.slice(0, 7),
    employeeId:  initial?.employeeId  ?? employees.find(e => e.kind === "streamer")?.id ?? "",
    brandId:     initial?.brandId,
    brandIds:    initial?.brandIds,
    brandName:   initial?.brandName   ?? "",
    category:    initial?.category    ?? "Vlog",
    description: initial?.description ?? "",
    amountUsd:   initial?.amountUsd   ?? 0,
    amountThb:   initial?.amountThb,
    paid:        initial?.paid        ?? false,
    paidDate:    initial?.paidDate,
    notes:       encodeExpenseExceptionInNotes(initial?.notes ?? "", undefined, undefined),
    screenshotUrl: initial?.screenshotUrl ?? "",
    reviewStatus: initial?.reviewStatus,
    settlementMode: initial?.settlementMode,
    salaryExtraId: initial?.salaryExtraId,
    kasaTxId: initial?.kasaTxId,
    exceptionKind: initialExc.kind,
    exceptionNote: initialExc.note,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const applyBrands = (ids: string[]) => {
    setSelectedBrandIds(ids);
    setForm((f) => ({ ...f, ...buildExpenseBrandFields(ids, brands) }));
  };

  const showAdminSettle = Boolean(adminSettle && initial);
  const payrollNow = initial ? isPayrollSettled(initial) : false;
  const kasaNow = initial ? isKasaSettled(initial) : false;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...form, ...buildExpenseBrandFields(selectedBrandIds, brands) });
        onClose();
      }}
    >
      <div className="grid gap-4">
        {showAdminSettle && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Ödeme yolu (yönetici)</p>
            <p className="text-[11px] text-muted-foreground">
              Şu an: <span className="font-medium text-foreground">{settlementLabel(initial!)}</span>
              {" · "}Alanları kaydetmek ayrı; ödeme yolunu aşağıdaki butonlarla değiştirin.
            </p>
            <div className="flex flex-wrap gap-2">
              {!kasaNow && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    const msg = payrollNow
                      ? "Maaş masrafından çıkarıp kasadan ödendi yapılsın mı?"
                      : "Kasadan ödendi olarak işaretlensin mi?";
                    if (!window.confirm(msg)) return;
                    adminSettle!.onPayFromKasa();
                    onClose();
                  }}
                >
                  {payrollNow ? "Kasaya taşı" : "Kasadan öde"}
                </Button>
              )}
              {!payrollNow && !kasaNow && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    adminSettle!.onSettlePayroll();
                    onClose();
                  }}
                >
                  Maaşa masraf ekle
                </Button>
              )}
              {payrollNow && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!window.confirm("Bordro bağlantısı kaldırılsın mı?")) return;
                    adminSettle!.onUnsettlePayroll();
                    onClose();
                  }}
                >
                  Bordrodan çıkar
                </Button>
              )}
              {kasaNow && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!window.confirm("Kasa ödemesi geri alınsın mı?")) return;
                    adminSettle!.onUnpayKasa();
                    onClose();
                  }}
                >
                  Kasa ödemesini geri al
                </Button>
              )}
            </div>
          </div>
        )}
        <FormGrid>
          <Field label="Tarih" required>
            <DateTimePicker mode="date" value={form.date} onChange={(v) => { set("date", v); set("month", v.slice(0, 7)); }} required />
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
          <Field label="Marka(lar)" hint="Birden fazla seçilirse tutar markalar arasında eşit bölünür">
            <BrandMultiSelect brands={brands} value={selectedBrandIds} onChange={applyBrands} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka Etiketi" hint='Marka listesinde yoksa manuel etiket (ör. "Siteler")'>
            <Input
              value={form.brandName}
              onChange={(e) => {
                set("brandName", e.target.value);
                if (selectedBrandIds.length) setSelectedBrandIds([]);
              }}
              placeholder="Gala / Pipo / Siteler"
            />
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
          <Field
            label="Ödendi mi?"
            hint={
              adminSettle
                ? "Kasa / maaş geçişi için yukarıdaki ödeme yolu butonlarını kullanın"
                : undefined
            }
          >
            <Select value={form.paid ? "yes" : "no"} onChange={e => set("paid", e.target.value === "yes")}
              options={[{ value: "no", label: "Bekliyor" }, { value: "yes", label: "Ödendi" }]}
              disabled={Boolean(adminSettle)}
            />
          </Field>
          <Field label="Ödeme Tarihi">
            <DateTimePicker mode="date" value={form.paidDate ?? ""} onChange={(v) => set("paidDate", v || undefined)} disabled={!form.paid || Boolean(adminSettle)} />
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
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 dark:border-amber-500/35 dark:bg-amber-950/25 px-3 py-3 space-y-3">
          <p className="text-xs font-medium text-foreground">Özel durum (elzem / hack / hibe)</p>
          <p className="text-[11px] text-muted-foreground">
            Hack veya hibe: bordro/ödeme borcuna yazılmaz. Elzem: kayıt tutulur, ödeme yolu ayrıca seçilir.
          </p>
          <FormGrid>
            <Field label="Durum">
              <Select
                value={form.exceptionKind ?? ""}
                onChange={(e) => {
                  const v = e.target.value as ContentExpenseExceptionKind | "";
                  set("exceptionKind", v || undefined);
                  if (!v) set("exceptionNote", undefined);
                }}
                options={[
                  { value: "", label: "Yok (normal)" },
                  ...CONTENT_EXPENSE_EXCEPTION_KINDS.map((k) => ({
                    value: k,
                    label: CONTENT_EXPENSE_EXCEPTION_LABELS[k],
                  })),
                ]}
              />
            </Field>
            <Field label="Kısa açıklama" hint="Opsiyonel — örn. hesap hacklendi">
              <Input
                value={form.exceptionNote ?? ""}
                onChange={(e) => set("exceptionNote", e.target.value || undefined)}
                placeholder="Neden / bağlam"
                disabled={!form.exceptionKind}
              />
            </Field>
          </FormGrid>
        </div>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="" />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Harcama Ekle"} />
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
function ExpenseSlaPanel({
  pendingReviews,
  employees,
  onSelect,
}: {
  pendingReviews: ContentExpense[];
  employees: Employee[];
  onSelect: (e: ContentExpense) => void;
}) {
  const buckets = useMemo(() => {
    const now = Date.now();
    const fresh: ContentExpense[] = [];
    const warning: ContentExpense[] = [];
    const overdue: ContentExpense[] = [];
    for (const e of pendingReviews) {
      const submittedAt = e.submittedAt
        ? new Date(e.submittedAt).getTime()
        : new Date(e.date).getTime();
      const ageDays = Math.floor((now - submittedAt) / 86_400_000);
      if (ageDays >= 7) overdue.push(e);
      else if (ageDays >= 3) warning.push(e);
      else fresh.push(e);
    }
    return { fresh, warning, overdue };
  }, [pendingReviews]);

  const oldestEmployee = useMemo(() => {
    const map = new Map<string, { count: number; oldest: number }>();
    const now = Date.now();
    for (const e of pendingReviews) {
      const submitted = e.submittedAt ? new Date(e.submittedAt).getTime() : new Date(e.date).getTime();
      const ageDays = Math.floor((now - submitted) / 86_400_000);
      const cur = map.get(e.employeeId) ?? { count: 0, oldest: 0 };
      cur.count += 1;
      cur.oldest = Math.max(cur.oldest, ageDays);
      map.set(e.employeeId, cur);
    }
    return Array.from(map.entries())
      .map(([id, info]) => ({ id, ...info, name: employees.find((em) => em.id === id)?.name ?? "?" }))
      .sort((a, b) => b.oldest - a.oldest);
  }, [pendingReviews, employees]);

  if (pendingReviews.length === 0) return null;

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/20 dark:border-blue-500/40 dark:bg-blue-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock size={15} className="text-blue-700 dark:text-blue-300" /> Onay SLA paneli
        </CardTitle>
        <CardDescription className="text-xs">
          Bekleyen yayıncı gönderimlerinin yaşlanması — 7+ gün “gecikme”, 3-6 gün “uyarı”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <SlaTile label="Taze (≤2g)" count={buckets.fresh.length} accent="text-emerald-700 dark:text-emerald-300" />
          <SlaTile label="Uyarı (3-6g)" count={buckets.warning.length} accent="text-amber-700 dark:text-amber-300" />
          <SlaTile label="Gecikme (7+g)" count={buckets.overdue.length} accent="text-red-700 dark:text-red-300" />
        </div>
        {buckets.overdue.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50/40 dark:border-red-500/45 dark:bg-red-950/30 px-3 py-2">
            <p className="text-[11px] font-medium text-red-900 dark:text-red-100 mb-1">
              7+ gün bekleyen ({buckets.overdue.length})
            </p>
            <ul className="space-y-1">
              {buckets.overdue.slice(0, 5).map((e) => {
                const emp = employees.find((em) => em.id === e.employeeId);
                const submittedAt = e.submittedAt ? new Date(e.submittedAt).getTime() : new Date(e.date).getTime();
                const ageDays = Math.floor((Date.now() - submittedAt) / 86_400_000);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(e)}
                      className="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-red-100/50 dark:hover:bg-red-900/30 text-left text-xs"
                    >
                      <span className="truncate">
                        <span className="font-medium text-red-900 dark:text-red-100">{ageDays}g</span>
                        {" · "}
                        <NoI18n>
                          {emp?.name ?? "?"} · {e.brandName} · {e.description.slice(0, 60)}
                        </NoI18n>
                      </span>
                      <span className="tabular-nums font-semibold shrink-0 text-red-900 dark:text-red-100">
                        {fmt(e.amountUsd)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {buckets.overdue.length > 5 && (
                <li className="text-[10px] text-muted-foreground italic px-2">
                  +{buckets.overdue.length - 5} kayıt daha — aşağıdaki listede
                </li>
              )}
            </ul>
          </div>
        )}
        {oldestEmployee.length > 0 && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <p className="font-medium text-muted-foreground mb-1">Yayıncıya göre bekleme (en eski → )</p>
            <div className="flex flex-wrap gap-1.5">
              {oldestEmployee.slice(0, 6).map((s) => (
                <Badge
                  key={s.id}
                  variant="outline"
                  className={`text-[10px] ${
                    s.oldest >= 7
                      ? "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40"
                      : s.oldest >= 3
                        ? "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40"
                        : "text-muted-foreground border-border bg-muted/30"
                  }`}
                >
                  {s.name} · {s.count} kayıt · max {s.oldest}g
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SlaTile({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent}`}>{count}</p>
    </div>
  );
}

function ContentExpensesPageInner() {
  const { user } = useAuth();
  const canRamizWallet = canViewRamizWallet(user);
  const readOnly = useIsReadOnly("write.content_review");
  const {
    contentExpenses, brands, employees, salaryExtras,
    addContentExpense, updateContentExpense, deleteContentExpense,
    payContentExpense, unpayContentExpense,
    settleContentExpenseToPayroll,
    unsettleContentExpenseFromPayroll,
    kasas, kasaTransactions,
    pushNotification,
  } = useStore();
  const auditEntries = useAuditLog((s) => s.entries);
  const viewKasas = useMemo(
    () => filterKasasForRamizViewer(kasas, canRamizWallet),
    [kasas, canRamizWallet],
  );
  const viewKasaTransactions = useMemo(
    () => filterKasaTransactionsForRamizViewer(kasaTransactions, canRamizWallet),
    [kasaTransactions, canRamizWallet],
  );
  const searchParams = useSearchParams();
  const defaultKasaId =
    viewKasas.find((k) => k.isDefault && !k.archived)?.id ??
    viewKasas.find((k) => !k.archived)?.id ??
    DEFAULT_KASA_ID;

  const [modal, setModal]    = useState<"new" | ContentExpense | null>(null);
  const [reviewModal, setReviewModal] = useState<ContentExpense | null>(null);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [brandIdFilter, setBrandIdFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [paidFilter,  setPaidFilter]  = useState<"all" | "paid" | "unpaid">("all");
  const [settlementFilter, setSettlementFilter] =
    useState<ContentExpenseSettlementFilter>("all");
  const [lockedMonths, setLockedMonths] = useState<string[]>([]);
  const [kasaPayQueue, setKasaPayQueue] = useState<ContentExpense[] | null>(null);
  const [bulkPayrollOpen, setBulkPayrollOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);

  useEffect(() => {
    void fetchLockedContentExpenseMonths().then(setLockedMonths);
  }, []);

  const monthLocked =
    monthFilter !== "all" && isContentExpenseMonthLocked(monthFilter, lockedMonths);
  const canLockMonths = user ? isMainAdmin(user) : false;
  /** Ana Orkun oturumu (impersonation değil) — kilitli ayda yazabilir. */
  const isOrkun = canLockMonths && !user?.impersonatorId;

  const visibleExpenses = useMemo(
    () => filterContentExpensesForViewer(contentExpenses, user),
    [contentExpenses, user],
  );

  const assertMonthWritable = (monthYm: string, actionLabel: string): boolean => {
    if (isOrkun) return true;
    if (isContentExpenseMonthLocked(monthYm, lockedMonths)) {
      window.alert(
        `${ymLabel(monthYm)} kilitli. ${actionLabel} için önce ayı açın (yalnızca Orkun).`
      );
      return false;
    }
    return true;
  };

  const notifyStreamer = (body: {
    expenseId: string;
    submittedBy: string;
    type: AppNotification["type"];
    title: string;
    message: string;
  }) => {
    if (!body.submittedBy) return;
    void fetch("/api/content-expenses/notify-streamer", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  useEffect(() => {
    const m = searchParams.get("month");
    const emp = searchParams.get("employee");
    const cat = searchParams.get("category");
    const brandId = searchParams.get("brand");
    const review = searchParams.get("review");
    const settlement = searchParams.get("settlement");
    if (m) setMonthFilter(m);
    if (emp) setEmployeeFilter(emp);
    if (cat) setCategoryFilter(cat);
    if (brandId) {
      setBrandIdFilter(brandId);
      const b = brands.find((x) => x.id === brandId);
      if (b) setBrandFilter(b.shortName || b.name);
    }
    if (
      settlement === "kasa" ||
      settlement === "payroll" ||
      settlement === "awaiting" ||
      settlement === "conflict" ||
      settlement === "exception" ||
      settlement === "withdrawn" ||
      settlement === "all"
    ) {
      setSettlementFilter(settlement);
    }
    if (review) {
      const exp = visibleExpenses.find((e) => e.id === review);
      if (exp) setReviewModal(exp);
    }
  }, [searchParams, visibleExpenses, brands]);

  const months = useMemo(
    () => Array.from(new Set(visibleExpenses.map(e => e.month))).sort((a, b) => b.localeCompare(a)),
    [visibleExpenses]
  );
  const brandNames = useMemo(
    () => Array.from(new Set(visibleExpenses.map(e => e.brandName))).sort(),
    [visibleExpenses]
  );
  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...CONTENT_EXPENSE_CATEGORIES,
          ...visibleExpenses.map((e) => e.category).filter(Boolean),
        ])
      ).sort(),
    [visibleExpenses]
  );

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of visibleExpenses) {
      if (
        hasDoubleSettlementConflict(e, {
          salaryExtras,
          kasaTransactions: viewKasaTransactions,
        })
      ) {
        ids.add(e.id);
      }
    }
    return ids;
  }, [visibleExpenses, salaryExtras, viewKasaTransactions]);

  const monthClose = useMemo(() => {
    const ym =
      monthFilter !== "all"
        ? monthFilter
        : toYearMonthLocal(new Date());
    const rows = visibleExpenses.filter((e) => e.month === ym);
    const sum = (list: ContentExpense[]) =>
      list.reduce((s, e) => s + (e.amountUsd || 0), 0);
    const pending = rows.filter((e) => {
      const s = expenseReviewStatus(e);
      return s === "pending" || s === "needs_info";
    });
    const awaiting = rows.filter(isUnsettledApprovedContent);
    const payroll = rows.filter(
      (e) => isPayrollSettled(e) && !isKasaSettled(e) && !isExceptionWriteOff(e),
    );
    const kasa = rows.filter(isKasaSettled);
    const writeOffs = rows.filter(isExceptionWriteOff);
    const conflicts = rows.filter((e) => conflictIds.has(e.id));
    return {
      ym,
      pending: { n: pending.length, usd: sum(pending) },
      awaiting: { n: awaiting.length, usd: sum(awaiting) },
      payroll: { n: payroll.length, usd: sum(payroll) },
      kasa: { n: kasa.length, usd: sum(kasa) },
      writeOffs: { n: writeOffs.length, usd: sum(writeOffs) },
      conflicts: { n: conflicts.length, usd: sum(conflicts) },
    };
  }, [visibleExpenses, monthFilter, conflictIds]);

  const filtered = useMemo(
    () => visibleExpenses
      .filter(e => {
        const brandOk =
          brandIdFilter === "all"
            ? brandFilter === "all" || e.brandName === brandFilter
            : (() => {
                const b = brands.find((x) => x.id === brandIdFilter);
                return b ? expenseMatchesBrand(e, b, brands) : false;
              })();
        const settlementOk = matchesSettlementFilter(e, settlementFilter, {
          hasConflict: conflictIds.has(e.id),
        });
        return (
          (monthFilter === "all" || e.month === monthFilter) &&
          brandOk &&
          (categoryFilter === "all" || e.category === categoryFilter) &&
          (employeeFilter === "all" || e.employeeId === employeeFilter) &&
          (paidFilter === "all" ||
            (paidFilter === "paid"
              ? isExpenseCountedPaid(e)
              : !isExpenseCountedPaid(e))) &&
          settlementOk &&
          (search === "" ||
            e.description.toLowerCase().includes(search.toLowerCase()) ||
            e.brandName.toLowerCase().includes(search.toLowerCase()) ||
            e.category.toLowerCase().includes(search.toLowerCase()) ||
            (employees.find((em) => em.id === e.employeeId)?.name ?? "")
              .toLowerCase()
              .includes(search.toLowerCase()))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    [
      visibleExpenses,
      monthFilter,
      brandFilter,
      brandIdFilter,
      brands,
      categoryFilter,
      employeeFilter,
      paidFilter,
      settlementFilter,
      conflictIds,
      search,
      employees,
    ]
  );

  const settlementHistory = useMemo(
    () =>
      auditEntries
        .filter(
          (a) =>
            a.action === "expense_settlement" ||
            a.action === "expense_month_lock"
        )
        .slice(0, 80),
    [auditEntries]
  );

  // Geri çekilen ve reddedilen kayıtlar hiçbir grafiğe/KPI'a girmemeli.
  const activeFiltered = useMemo(
    () => filtered.filter(isActiveContentExpense),
    [filtered],
  );
  const total = activeFiltered.reduce((s, e) => s + e.amountUsd, 0);
  const totalPaid = activeFiltered
    .filter(isExpenseCountedPaid)
    .reduce((s, e) => s + e.amountUsd, 0);
  const totalAwaiting = activeFiltered
    .filter(isUnsettledApprovedContent)
    .reduce((s, e) => s + e.amountUsd, 0);
  const totalKasa = activeFiltered
    .filter((e) => isKasaSettled(e) && !isExceptionWriteOff(e))
    .reduce((s, e) => s + e.amountUsd, 0);
  const totalPayroll = activeFiltered
    .filter((e) => isPayrollSettled(e) && !isKasaSettled(e) && !isExceptionWriteOff(e))
    .reduce((s, e) => s + e.amountUsd, 0);
  const totalUnpaid = totalAwaiting;
  const pendingReviews = visibleExpenses.filter((e) =>
    isAwaitingContentExpenseReview(e, salaryExtras),
  );
  const unreleasedForTeam = useMemo(() => {
    if (!isOrkun) return [];
    return contentExpenses.filter(
      (e) => !isWithdrawnContentExpense(e) && !isContentExpenseReleasedToTeam(e),
    );
  }, [contentExpenses, isOrkun]);
  const releaseExpenseToTeam = (exp: ContentExpense) => {
    if (!user?.id) return;
    updateContentExpense(exp.id, contentExpenseReleasePatch(user.id));
    logAudit({
      actorId: user.id,
      actorName: user.name ?? "Orkun",
      action: "expense_team_release",
      detail: `${exp.brandName} · ${fmt(exp.amountUsd)} · ${exp.id}`,
    });
    setReviewModal((cur) =>
      cur?.id === exp.id
        ? { ...cur, ...contentExpenseReleasePatch(user.id) }
        : cur,
    );
  };
  const canReview = user?.role === "admin" || user?.role === "auditor";
  const canMarkPaid = user?.role === "admin";

  const openKasaPay = (rows: ContentExpense[]) => {
    const locked = rows.find((e) => isContentExpenseMonthLocked(e.month, lockedMonths));
    if (locked) {
      assertMonthWritable(locked.month, "Kasadan ödeme");
      return;
    }
    setKasaPayQueue(rows);
  };

  const confirmKasaPay = (opts: { kasaId: string; paidDate: string }) => {
    const rows = kasaPayQueue ?? [];
    if (rows.length === 0) return;
    const activeKasa =
      viewKasas.find((k) => k.id === opts.kasaId && !k.archived) ??
      viewKasas.find((k) => !k.archived);
    for (const e of rows) {
      if (!assertMonthWritable(e.month, "Kasadan ödeme")) return;
      const fromPayroll = isPayrollSettled(e);
      if (activeKasa) {
        payContentExpense({
          contentExpenseId: e.id,
          kasaId: activeKasa.id,
          paidDate: opts.paidDate,
        });
      } else {
        updateContentExpense(e.id, {
          paid: true,
          paidDate: opts.paidDate,
          settlementMode: "kasa",
        });
      }
      notifyStreamer({
        expenseId: e.id,
        submittedBy: e.submittedBy ?? "",
        type: "expense_paid",
        title: fromPayroll
          ? "Harcaman kasadan ödendi (maaşa yazılmadı)"
          : "Harcaman kasadan ödendi",
        message: fromPayroll
          ? `${e.brandName} · ${fmt(e.amountUsd)} — maaş masrafından çıkarıldı, kasadan ödendi.`
          : `${e.brandName} · ${fmt(e.amountUsd)} kasadan ödendi.`,
      });
      pushNotification({
        type: "expense_paid",
        title: fromPayroll ? "Kasaya taşındı" : "Harcama ödendi",
        message: `${e.brandName} · ${fmt(e.amountUsd)} · kasadan.`,
        forRole: "streamer",
        forUserId: e.submittedBy,
        triggeredBy: user?.id,
        refId: e.id,
        href: "/yayinci/harcamalar",
      });
      logAudit({
        actorId: user?.id ?? "unknown",
        actorName: user?.name ?? "?",
        action: "expense_settlement",
        detail: fromPayroll
          ? `payroll→kasa · ${e.brandName} · ${fmt(e.amountUsd)} · ${e.id}`
          : `kasa · ${e.brandName} · ${fmt(e.amountUsd)} · ${e.id}`,
      });
    }
    setKasaPayQueue(null);
  };

  const toggleMonthLock = async () => {
    if (!canLockMonths || monthFilter === "all" || lockBusy) return;
    const nextLocked = !monthLocked;
    setLockBusy(true);
    const res = await setContentExpenseMonthLocked(monthFilter, nextLocked);
    setLockBusy(false);
    if (!res.ok) {
      window.alert(res.error ?? "Kilit güncellenemedi");
      return;
    }
    setLockedMonths(res.lockedMonths);
    logAudit({
      actorId: user?.id ?? "unknown",
      actorName: user?.name ?? "?",
      action: "expense_month_lock",
      detail: `${nextLocked ? "kilit" : "aç"} · ${monthFilter}`,
    });
  };
  const byBrand     = useMemo(() => {
    const map = new Map<string, number>();
    activeFiltered.forEach(e => map.set(e.brandName, (map.get(e.brandName) ?? 0) + e.amountUsd));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeFiltered]);

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
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">İçerik Harcamaları</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Yayıncı vlog / yetişkin içerik / site videosu üretim giderleri · marka bazlı izleme
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canMarkPaid && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setBulkPayrollOpen(true)}
            >
              <ArrowRightLeft size={14} /> Maaş → Kasa
            </Button>
          )}
          {(canReview || canMarkPaid) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setHistoryOpen(true)}
            >
              <History size={14} /> Ödeme geçmişi
            </Button>
          )}
          {canLockMonths && monthFilter !== "all" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={lockBusy}
              onClick={() => void toggleMonthLock()}
            >
              {monthLocked ? <Unlock size={14} /> : <Lock size={14} />}
              {monthLocked ? "Ayı aç" : "Ayı kilitle"}
            </Button>
          )}
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
            <Button
              size="sm"
              onClick={() => {
                if (monthFilter !== "all" && !assertMonthWritable(monthFilter, "Yeni harcama")) return;
                setModal("new");
              }}
              className="gap-1.5"
              disabled={monthLocked && !isOrkun}
            >
              <Plus size={14} /> Harcama Ekle
              {monthFilter !== "all" && <span className="text-[10px] opacity-70">({ymLabel(monthFilter)})</span>}
            </Button>
          )}
        </div>
      </div>

      {monthLocked && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-950/30 px-3 py-2.5 text-sm">
          <Lock size={14} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {ymLabel(monthFilter)} kilitli
              {isOrkun ? " — Orkun override" : ""}
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/80 mt-0.5">
              {isOrkun
                ? "Diğer adminler yazamaz; sen kilitliyken de işlem yapabilirsin veya ayı açabilirsin."
                : "Bu ay için ödeme yolu değişikliği ve düzenleme kapalı. Yalnızca Orkun ayı açabilir."}
            </p>
          </div>
        </div>
      )}

      {/* Aylık kapanış özeti */}
      {canMarkPaid && (
        <Card className="mb-6 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt size={15} /> Aylık kapanış · {ymLabel(monthClose.ym)}
            </CardTitle>
            <CardDescription className="text-xs">
              Onay bekleyen → ödeme bekleyen → maaş/kasa. Hibe/hack bordroya yazılmaz. Çakışmaları önce temizle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["İnceleme", monthClose.pending, "pending"],
                  ["Ödeme bekliyor", monthClose.awaiting, "awaiting"],
                  ["Maaş", monthClose.payroll, "payroll"],
                  ["Kasa", monthClose.kasa, "kasa"],
                  ["Hibe/hack", monthClose.writeOffs, "exception"],
                  ["Çakışma", monthClose.conflicts, "conflict"],
                ] as const
              ).map(([label, bag, filter]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (monthFilter === "all") setMonthFilter(monthClose.ym);
                    setSettlementFilter(filter === "pending" ? "all" : filter);
                    if (filter === "pending") setPaidFilter("unpaid");
                  }}
                  className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
                >
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{bag.n}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">{fmt(bag.usd)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {conflictIds.size > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50/50 dark:border-red-500/40 dark:bg-red-950/25 px-3 py-2.5 text-sm">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700 dark:text-red-300" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-100">
              {conflictIds.size} kayıtta çift ödeme riski
            </p>
            <p className="text-xs text-red-800/90 dark:text-red-200/80 mt-0.5">
              Hem bordro hem kasa bağlantısı var. Filtrede &quot;Çakışma&quot; ile listeleyin; birini geri alın.
            </p>
          </div>
        </div>
      )}

      {isOrkun && unreleasedForTeam.length > 0 && (
        <Card className="mb-6 border-violet-300 bg-violet-50/40 dark:border-violet-500/45 dark:bg-violet-950/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye size={16} className="text-violet-700 dark:text-violet-300" />
              Ekibe kapalı yeni harcamalar
            </CardTitle>
            <CardDescription>
              {unreleasedForTeam.length} kayıt yalnızca sizde görünür. İnceledikten sonra ekibe açın;
              diğer yöneticilere ayrı bildirim gitmez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unreleasedForTeam.slice(0, 12).map((e) => {
              const emp = employees.find((em) => em.id === e.employeeId);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200/80 bg-card px-3 py-2 dark:border-violet-500/35"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      <NoI18n>{emp?.name ?? "—"}</NoI18n>
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {e.date} · {fmt(e.amountUsd)}
                      </span>
                    </p>
                    <NoI18n as="p" className="text-xs text-muted-foreground line-clamp-1">
                      {e.brandName} — {e.description}
                    </NoI18n>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setReviewModal(e)}
                  >
                    İncele
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => releaseExpenseToTeam(e)}
                  >
                    Ekibe aç
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* SLA / aging — admin & denetçi */}
      {canReview && pendingReviews.length > 0 && (
        <ExpenseSlaPanel
          pendingReviews={pendingReviews}
          employees={employees}
          onSelect={(e) => setReviewModal(e)}
        />
      )}

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
                        <Badge variant="outline" className="text-[10px]">
                          {formatExpenseBrandLabel(e, brands)}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{emp?.name} · {e.date}</span>
                      </div>
                      <NoI18n as="p" className="text-sm text-foreground line-clamp-1 mt-0.5">{e.description}</NoI18n>
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Toplam (Filtreli)", value: fmt(total), cls: "text-foreground font-bold", icon: Receipt },
          { label: "Kapatılmış", value: fmt(totalPaid), cls: "text-green-600", icon: CheckCircle2 },
          { label: "Ödeme Bekleyen", value: fmt(totalUnpaid), cls: totalUnpaid > 0 ? "text-amber-600" : "text-muted-foreground", icon: Circle },
          { label: "Kasadan", value: fmt(totalKasa), cls: "text-blue-600", icon: Wallet },
          { label: "Maaştan", value: fmt(totalPayroll), cls: "text-violet-600", icon: CheckCircle2 },
          { label: "Kayıt", value: String(activeFiltered.length), cls: "text-foreground", icon: Receipt },
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
            <CardDescription>{activeFiltered.length} harcama · {monthFilter === "all" ? "tüm aylar" : ymLabel(monthFilter)}</CardDescription>
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
        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-44 text-xs h-8"
          options={[{ value: "all", label: "Tüm Kategoriler" }, ...categories.map(c => ({ value: c, label: c }))]} />
        <Select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="w-44 text-xs h-8"
          options={[
            { value: "all", label: "Tüm Yayıncılar" },
            ...employees
              .filter((em) => visibleExpenses.some((x) => x.employeeId === em.id))
              .map((em) => ({ value: em.id, label: em.name })),
          ]} />
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(["all", "unpaid", "paid"] as const).map(f => (
            <button key={f} onClick={() => setPaidFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                paidFilter === f ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}>
              {f === "all" ? "Tümü" : f === "paid" ? "Kapatılmış" : "Bekleyen"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card flex-wrap">
          {(
            [
              ["all", "Yol: tümü"],
              ["awaiting", "Ödeme bekliyor"],
              ["payroll", "Maaş"],
              ["kasa", "Kasa"],
              ["exception", "Özel durum"],
              ["conflict", "Çakışma"],
              ...(isOrkun ? [["withdrawn", "Geri çekilen"] as const] : []),
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setSettlementFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                settlementFilter === f
                  ? f === "conflict"
                    ? "bg-red-600 text-white"
                    : f === "exception"
                      ? "bg-amber-600 text-white"
                      : f === "withdrawn"
                        ? "bg-slate-700 text-white"
                        : "bg-violet-600 text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {label}
              {f === "conflict" && conflictIds.size > 0 ? ` (${conflictIds.size})` : ""}
              {f === "withdrawn"
                ? ` (${visibleExpenses.filter(isWithdrawnContentExpense).length})`
                : ""}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <UInput aria-label="İçerik harcaması ara" placeholder="Açıklama veya marka..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-8 text-sm pl-8" />
        </div>
      </div>

      {/* Tablo */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Tarih","Yayıncı","Marka","Kategori","Açıklama","USD","Durum","Ödeme",""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const emp   = employees.find(em => em.id === e.employeeId);
                const brand = brands.find(b => b.id === e.brandId);
                const conflict = conflictIds.has(e.id);
                const rowLocked = isContentExpenseMonthLocked(e.month, lockedMonths);
                const rowWriteBlocked = rowLocked && !isOrkun;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border/60 hover:bg-accent/20 transition-colors ${
                      conflict ? "bg-red-50/70 dark:bg-red-950/25" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Calendar size={10} className="opacity-50" />
                        {e.date}
                        {rowLocked && (
                          isOrkun ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1 gap-0.5 text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-500/40 dark:bg-amber-950/40"
                              title="Ay kilitli — Orkun olarak yazmaya devam edebilirsin"
                            >
                              <Lock size={8} />
                              Kilitli ay — Orkun override
                            </Badge>
                          ) : (
                            <span title="Ay kilitli">
                              <Lock size={10} className="text-amber-600" />
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap"><NoI18n>{emp?.name ?? "—"}</NoI18n></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px]"
                        style={brand ? { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" } : {}}>
                        <NoI18n>{e.brandName}</NoI18n>
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap"><NoI18n>{e.category}</NoI18n></td>
                    <td className="px-3 py-2.5">
                      <NoI18n as="p" className="text-sm text-foreground">{e.description}</NoI18n>
                      {e.amountThb && (
                        <p className="text-[11px] text-muted-foreground">{e.amountThb.toLocaleString("tr-TR")} THB</p>
                      )}
                      {conflict && (
                        <Badge variant="outline" className="mt-1 text-[9px] text-red-700 border-red-300 bg-red-50 gap-1">
                          <AlertTriangle size={9} /> Çift ödeme riski
                        </Badge>
                      )}
                      {exceptionLabel(e) && (
                        <Badge variant="outline" className="mt-1 text-[9px] text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-500/40 dark:bg-amber-950/40 gap-1">
                          <AlertTriangle size={9} /> {exceptionLabel(e)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold text-foreground whitespace-nowrap">{fmt(e.amountUsd)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {(() => {
                        if (isPayrollLinkedContentExpense(e, salaryExtras)) {
                          return (
                            <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 dark:text-violet-300 dark:border-violet-500/45 dark:bg-violet-950/40 gap-1 text-[10px]">
                              <CheckCircle2 size={10} /> Maaşa eklendi
                            </Badge>
                          );
                        }
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
                        if (isExpenseCountedPaid(e)) return (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40 gap-1 text-[10px]">
                            <CheckCircle2 size={10} /> {isKasaSettled(e) ? "Kasadan" : isPayrollSettled(e) ? "Maaştan" : "Kapatıldı"}
                          </Badge>
                        );
                        return (
                          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40 gap-1 text-[10px]">
                            <CheckCircle2 size={10} /> Onaylı · Ödeme Bekliyor
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">
                      {settlementLabel(e, salaryExtras)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {e.screenshotUrl && (
                          <a href={e.screenshotUrl} target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" title="Kanıtı aç">
                            <ImageIcon size={11} />
                          </a>
                        )}
                        {canMarkPaid && !rowWriteBlocked && (
                          <ProofUploader
                            compact
                            value={e.screenshotUrl ?? ""}
                            onChange={(url) => updateContentExpense(e.id, { screenshotUrl: url || undefined })}
                            folder="expense"
                          />
                        )}
                        {!readOnly && !rowWriteBlocked && (
                          <button onClick={() => setModal(e)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Düzenle">
                            <Pencil size={12} />
                          </button>
                        )}
                        {canReview &&
                          isAwaitingContentExpenseReview(e, salaryExtras) &&
                          !rowWriteBlocked && (
                          <button
                            type="button"
                            onClick={() => setReviewModal(e)}
                            className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                            aria-label="Harcamayı incele ve onayla"
                          >
                            İncele
                          </button>
                        )}
                        {canMarkPaid && canAdminPayContentFromKasa(e) && !rowWriteBlocked && (
                          <button
                            type="button"
                            onClick={() => openKasaPay([e])}
                            className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-950/45 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            aria-label={isPayrollSettled(e) ? "Kasaya taşı" : "Kasadan öde"}
                          >
                            {isPayrollSettled(e) ? "Kasaya taşı" : "Kasadan öde"}
                          </button>
                        )}
                        {canMarkPaid &&
                          (expenseReviewStatus(e) === "approved" ||
                            expenseReviewStatus(e) === "pending" ||
                            expenseReviewStatus(e) === "needs_info") &&
                          !isPayrollSettled(e) &&
                          !isKasaSettled(e) &&
                          !rowWriteBlocked &&
                          canAdminPayContentFromKasa(e) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!assertMonthWritable(e.month, "Maaşa ekleme")) return;
                              settleContentExpenseToPayroll(e.id, {
                                reviewedBy: user?.id,
                              });
                              notifyStreamer({
                                expenseId: e.id,
                                submittedBy: e.submittedBy ?? "",
                                type: "expense_approved",
                                title: "Harcaman bordroya eklendi",
                                message: `${e.brandName} · ${fmt(e.amountUsd)} bu ay maaş masrafına işlendi.`,
                              });
                              logAudit({
                                actorId: user?.id ?? "unknown",
                                actorName: user?.name ?? "?",
                                action: "expense_settlement",
                                detail: `payroll · ${e.brandName} · ${fmt(e.amountUsd)} · ${e.id}`,
                              });
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950/45 dark:text-violet-200 hover:bg-violet-200 transition-colors"
                          >
                            Maaşa ekle
                          </button>
                        )}
                        {canMarkPaid && isPayrollSettled(e) && !rowWriteBlocked && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!assertMonthWritable(e.month, "Bordrodan çıkarma")) return;
                              if (window.confirm(t("Bordro bağlantısı kaldırılsın mı? İlgili maaş kalemi silinir."))) {
                                unsettleContentExpenseFromPayroll(e.id);
                                logAudit({
                                  actorId: user?.id ?? "unknown",
                                  actorName: user?.name ?? "?",
                                  action: "expense_settlement",
                                  detail: `unsettle payroll · ${e.brandName} · ${e.id}`,
                                });
                              }
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Bordrodan çıkar
                          </button>
                        )}
                        {isOrkun && isWithdrawnContentExpense(e) && !rowWriteBlocked && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (!assertMonthWritable(e.month, "Yeniden açma")) return;
                                if (
                                  !window.confirm(
                                    "Geri çekilen harcama yeniden açılsın mı? İncelemede olarak yayıncıya ve yöneticilere görünür olur."
                                  )
                                ) {
                                  return;
                                }
                                updateContentExpense(e.id, {
                                  reviewStatus: "pending",
                                  reviewedAt: undefined,
                                  reviewedBy: undefined,
                                  reviewerNote: "Orkun tarafından yeniden açıldı.",
                                  notes: (e.notes ?? "").replace(/\s*\[streamer_cleared\]/gi, "").trim(),
                                });
                                logAudit({
                                  actorId: user?.id ?? "unknown",
                                  actorName: user?.name ?? "?",
                                  action: "expense_settlement",
                                  detail: `restore withdrawn · ${e.brandName} · ${e.id}`,
                                });
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/45 dark:text-blue-200 hover:bg-blue-200 transition-colors"
                            >
                              Yeniden aç
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!assertMonthWritable(e.month, "Kalıcı silme")) return;
                                if (
                                  !window.confirm(
                                    "Bu geri çekilen harcama kalıcı silinsin mi? Bu işlem geri alınamaz."
                                  )
                                ) {
                                  return;
                                }
                                deleteContentExpense(e.id);
                                logAudit({
                                  actorId: user?.id ?? "unknown",
                                  actorName: user?.name ?? "?",
                                  action: "expense_settlement",
                                  detail: `hard delete withdrawn · ${e.brandName} · ${e.id}`,
                                });
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-200 hover:bg-red-200 transition-colors"
                            >
                              Kalıcı sil
                            </button>
                          </>
                        )}
                        {canMarkPaid && isKasaSettled(e) && !rowWriteBlocked && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!assertMonthWritable(e.month, "Kasa geri alma")) return;
                              if (
                                window.confirm(
                                  "Kasa ödemesi geri alınsın mı? Kasa hareketi silinir; harcama yeniden ödeme bekler."
                                )
                              ) {
                                unpayContentExpense(e.id);
                                logAudit({
                                  actorId: user?.id ?? "unknown",
                                  actorName: user?.name ?? "?",
                                  action: "expense_settlement",
                                  detail: `unsettle kasa · ${e.brandName} · ${e.id}`,
                                });
                              }
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Kasa ödemesini geri al
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
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Eşleşen kayıt yok.</td></tr>
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
            key={modal === "new" ? `new-${monthFilter}` : modal.id}
            initial={modal === "new" ? undefined : modal}
            defaultDate={modal === "new" && monthFilter !== "all" ? defaultSnapshotDateInMonth(monthFilter) : undefined}
            onSave={d => {
              if (modal === "new") {
                if (!assertMonthWritable(d.month, "Yeni harcama")) return;
                addContentExpense({
                  ...d,
                  ...(isOrkun && user?.id
                    ? contentExpenseReleasePatch(user.id)
                    : {}),
                });
              } else {
                if (!assertMonthWritable(modal.month, "Düzenleme")) return;
                if (d.month && !assertMonthWritable(d.month, "Düzenleme")) return;
                const becameWriteOff =
                  (d.exceptionKind === "hibe" || d.exceptionKind === "hack") &&
                  !(
                    modal.exceptionKind === "hibe" ||
                    modal.exceptionKind === "hack" ||
                    resolveExpenseException(modal).kind === "hibe" ||
                    resolveExpenseException(modal).kind === "hack"
                  );
                updateContentExpense(modal.id, d);
                if (becameWriteOff && isPayrollSettled(modal)) {
                  unsettleContentExpenseFromPayroll(modal.id);
                }
                if (d.exceptionKind) {
                  logAudit({
                    actorId: user?.id ?? "unknown",
                    actorName: user?.name ?? "?",
                    action: "expense_settlement",
                    detail: `exception ${d.exceptionKind}${d.exceptionNote ? ` · ${d.exceptionNote}` : ""} · ${modal.brandName} · ${modal.id}`,
                  });
                }
              }
            }}
            onDelete={modal !== "new" ? () => {
              if (!assertMonthWritable(modal.month, "Silme")) return;
              deleteContentExpense(modal.id);
              setModal(null);
            } : undefined}
            onClose={() => setModal(null)}
            adminSettle={
              canMarkPaid && modal !== "new" && !isContentExpenseMonthLocked(modal.month, lockedMonths)
                ? {
                    onPayFromKasa: () => {
                      setModal(null);
                      openKasaPay([modal]);
                    },
                    onSettlePayroll: () => {
                      if (!assertMonthWritable(modal.month, "Maaşa ekleme")) return;
                      settleContentExpenseToPayroll(modal.id);
                      logAudit({
                        actorId: user?.id ?? "unknown",
                        actorName: user?.name ?? "?",
                        action: "expense_settlement",
                        detail: `payroll · ${modal.brandName} · ${fmt(modal.amountUsd)} · ${modal.id}`,
                      });
                    },
                    onUnsettlePayroll: () => {
                      if (!assertMonthWritable(modal.month, "Bordrodan çıkarma")) return;
                      unsettleContentExpenseFromPayroll(modal.id);
                    },
                    onUnpayKasa: () => {
                      if (!assertMonthWritable(modal.month, "Kasa geri alma")) return;
                      unpayContentExpense(modal.id);
                    },
                  }
                : undefined
            }
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
            kasas={viewKasas}
            kasaTransactions={viewKasaTransactions}
            defaultKasaId={defaultKasaId}
            onAttachProof={canMarkPaid ? (url) => {
              updateContentExpense(reviewModal.id, { screenshotUrl: url || undefined });
              setReviewModal({ ...reviewModal, screenshotUrl: url || undefined });
            } : undefined}
            onApprove={(note, settlement, kasaPayload) => {
              if (!assertMonthWritable(reviewModal.month, "Onay")) return;
              const today = new Date().toISOString().slice(0, 10);
              const tag = `[ICEXP:${reviewModal.id}]`;
              const existingTx = useStore.getState().kasaTransactions.find((t) => {
                const blob = `${t.notes ?? ""} ${t.purpose ?? ""}`;
                return blob.includes(tag);
              });
              // Onay + kasa aynı anda yazılır. Önce "sadece onay" persist edilirse
              // kasa bağlantısı ezilip kayıt yeniden "ödeme bekliyor"a düşüyordu.
              if (settlement === "existing_kasa" && kasaPayload?.existingKasaTxId) {
                payContentExpense({
                  contentExpenseId: reviewModal.id,
                  kasaId: kasaPayload.kasaId,
                  paidDate: today,
                  existingKasaTxId: kasaPayload.existingKasaTxId,
                  reviewerNote: note,
                  reviewedBy: user?.id,
                });
              } else if ((settlement === "kasa" && kasaPayload) || (settlement !== "payroll" && existingTx)) {
                payContentExpense({
                  contentExpenseId: reviewModal.id,
                  kasaId: kasaPayload?.kasaId ?? existingTx!.kasaId,
                  paidDate: today,
                  feeUsd: kasaPayload?.feeUsd ?? 0,
                  notes: note,
                  reviewerNote: note,
                  reviewedBy: user?.id,
                });
              } else if (settlement === "payroll") {
                settleContentExpenseToPayroll(reviewModal.id, {
                  reviewedBy: user?.id,
                  reviewerNote: note,
                });
              } else {
                updateContentExpense(reviewModal.id, {
                  reviewStatus: "approved",
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: user?.id,
                  reviewerNote: note,
                });
              }
              const paidNow =
                (settlement === "existing_kasa" && Boolean(kasaPayload?.existingKasaTxId)) ||
                (settlement === "kasa" && Boolean(kasaPayload)) ||
                (settlement !== "payroll" && Boolean(existingTx));
              const payrollNow = settlement === "payroll";
              notifyStreamer({
                expenseId: reviewModal.id,
                submittedBy: reviewModal.submittedBy ?? "",
                type: paidNow ? "expense_paid" : "expense_approved",
                title: paidNow
                  ? "Harcaman onaylandı ve ödendi"
                  : payrollNow
                    ? "Harcaman onaylandı — maaşa masraf eklendi"
                    : "Harcaman onaylandı",
                message: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} — ${note || (paidNow ? "Kasadan ödendi" : payrollNow ? "Bordro masrafı" : "Onaylandı")}`,
              });
              logAudit({
                actorId: user?.id ?? "unknown",
                actorName: user?.name ?? "?",
                action: paidNow || payrollNow ? "expense_settlement" : "expense_approved",
                detail: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} · ${settlement} · ${reviewModal.id}`,
              });
              setReviewModal(null);
            }}
            onMarkException={(kind, note, adminMsg) => {
              if (!assertMonthWritable(reviewModal.month, "Özel durum")) return;
              const writeOff = kind === "hibe" || kind === "hack";
              updateContentExpense(reviewModal.id, {
                exceptionKind: kind,
                exceptionNote: note || undefined,
                reviewStatus: "approved",
                reviewedAt: new Date().toISOString(),
                reviewedBy: user?.id,
                reviewerNote:
                  adminMsg ||
                  `${CONTENT_EXPENSE_EXCEPTION_LABELS[kind]}${note ? ` — ${note}` : ""}`,
              });
              if (writeOff && isPayrollSettled(reviewModal)) {
                unsettleContentExpenseFromPayroll(reviewModal.id);
              }
              notifyStreamer({
                expenseId: reviewModal.id,
                submittedBy: reviewModal.submittedBy ?? "",
                type: "general",
                title: `Harcama: ${CONTENT_EXPENSE_EXCEPTION_LABELS[kind]}`,
                message: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} — ${note || adminMsg || CONTENT_EXPENSE_EXCEPTION_LABELS[kind]}`,
              });
              logAudit({
                actorId: user?.id ?? "unknown",
                actorName: user?.name ?? "?",
                action: "expense_settlement",
                detail: `exception ${kind}${note ? ` · ${note}` : ""} · ${reviewModal.brandName} · ${reviewModal.id}`,
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
              notifyStreamer({
                expenseId: reviewModal.id,
                submittedBy: reviewModal.submittedBy ?? "",
                type: "expense_rejected",
                title: "Harcaman reddedildi",
                message: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} — ${note}`,
              });
              logAudit({
                actorId: user?.id ?? "unknown",
                actorName: user?.name ?? "?",
                action: "expense_rejected",
                detail: `${reviewModal.brandName} · ${fmt(reviewModal.amountUsd)} · ${note.slice(0, 120)}`,
              });
              setReviewModal(null);
            }}
            onReleaseToTeam={
              isOrkun && !isContentExpenseReleasedToTeam(reviewModal)
                ? () => releaseExpenseToTeam(reviewModal)
                : undefined
            }
            onNeedsInfo={(note) => {
              const thread = [
                ...(reviewModal.reviewThread ?? []),
                {
                  authorId: user?.id ?? "admin",
                  authorRole: (user?.role === "auditor" ? "auditor" : "admin") as "admin" | "auditor",
                  message: note,
                  at: new Date().toISOString(),
                },
              ];
              updateContentExpense(reviewModal.id, {
                reviewStatus: "needs_info",
                reviewedAt: new Date().toISOString(),
                reviewedBy: user?.id,
                reviewerNote: note,
                reviewThread: thread,
              });
              notifyStreamer({
                expenseId: reviewModal.id,
                submittedBy: reviewModal.submittedBy ?? "",
                type: "general",
                title: "Harcaman için ek bilgi gerekiyor",
                message: `${reviewModal.brandName} · ${note}`,
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

      <ContentExpenseKasaPayModal
        open={Boolean(kasaPayQueue?.length)}
        onClose={() => setKasaPayQueue(null)}
        expenses={kasaPayQueue ?? []}
        kasas={viewKasas}
        kasaTransactions={viewKasaTransactions}
        defaultKasaId={defaultKasaId}
        title={
          (kasaPayQueue ?? []).some((e) => isPayrollSettled(e))
            ? "Maaş → kasaya taşı"
            : undefined
        }
        onConfirm={confirmKasaPay}
      />

      <ContentExpenseBulkPayrollToKasaModal
        open={bulkPayrollOpen}
        onClose={() => setBulkPayrollOpen(false)}
        expenses={contentExpenses}
        employees={employees}
        months={months.length ? months : [toYearMonthLocal(new Date())]}
        monthLabel={ymLabel}
        onPick={(rows) => {
          setBulkPayrollOpen(false);
          openKasaPay(rows);
        }}
      />

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Ödeme yolu geçmişi"
        size="lg"
      >
        <div className="max-h-[420px] overflow-y-auto space-y-2">
          {settlementHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Henüz ödeme yolu kaydı yok.
            </p>
          ) : (
            settlementHistory.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-border px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.actorName}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {fmtDateTime(a.at)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {a.action === "expense_month_lock" ? "Ay kilidi" : "Ödeme yolu"} · {a.detail}
                </p>
              </div>
            ))
          )}
        </div>
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
  onMarkException,
  onReject,
  onNeedsInfo,
  onReleaseToTeam,
  onClose,
  onAttachProof,
}: {
  expense: ContentExpense;
  reviewerId: string;
  employees: { id: string; name: string }[];
  canMarkPaid: boolean;
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  defaultKasaId: string;
  onApprove: (
    note: string,
    settlement: "approve_only" | "kasa" | "payroll" | "existing_kasa",
    kasa?: { kasaId: string; feeUsd: number; existingKasaTxId?: string }
  ) => void;
  onMarkException: (
    kind: ContentExpenseExceptionKind,
    note: string,
    adminMsg: string,
  ) => void;
  onReject: (note: string) => void;
  onNeedsInfo: (note: string) => void;
  onReleaseToTeam?: () => void;
  onClose: () => void;
  onAttachProof?: (url: string) => void;
}) {
  const [note, setNote] = useState(expense.reviewerNote ?? "");
  const existingExc = resolveExpenseException(expense);
  const [excKind, setExcKind] = useState<ContentExpenseExceptionKind | "">(
    existingExc.kind ?? "",
  );
  const [excNote, setExcNote] = useState(existingExc.note ?? "");
  const [settlement, setSettlement] = useState<
    "approve_only" | "kasa" | "payroll" | "existing_kasa"
  >(canMarkPaid ? "kasa" : "approve_only");
  const [existingKasaTxId, setExistingKasaTxId] = useState("");
  const activeKasas = kasas.filter((k) => !k.archived);
  const [kasaId, setKasaId] = useState<string>(defaultKasaId);
  const [feeUsd, setFeeUsd] = useState<number>(0);
  const selectedKasa = activeKasas.find((k) => k.id === kasaId) ?? activeKasas[0];
  const tronPanel = useMemo(
    () => computeTronPanelMetrics(kasas, kasaTransactions),
    [kasas, kasaTransactions],
  );
  const balance = selectedKasa
    ? kasaPaymentBalance(selectedKasa.id, kasas, kasaTransactions, tronPanel)
    : 0;
  const projected = balance - (expense.amountUsd || 0) - feeUsd;
  const isLow = settlement === "kasa" && projected < 0;
  const recentOutTxs = useMemo(() => {
    return [...kasaTransactions]
      .filter((t) => t.direction === "out")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);
  }, [kasaTransactions]);
  const emp = employees.find(em => em.id === expense.employeeId);
  const submitted = expense.submittedAt ? fmtDateTime(expense.submittedAt) : "—";
  const writeOffSelected = excKind === "hibe" || excKind === "hack";

  return (
    <div className="space-y-4">
      {onReleaseToTeam && (
        <div className="rounded-lg border border-violet-300 bg-violet-50/50 dark:border-violet-500/40 dark:bg-violet-950/30 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-violet-900 dark:text-violet-100">
            Bu harcama henüz diğer yöneticilere kapalı. İnceledikten sonra ekibe açabilirsiniz.
          </p>
          <Button type="button" size="sm" onClick={onReleaseToTeam}>
            Ekibe aç
          </Button>
        </div>
      )}
      {/* Görsel önizleme + yönetici sonradan ekleyebilir (audit log yok) */}
      {onAttachProof ? (
        <Field label="Kanıt görseli" hint="Yayıncı göndermediyse sonradan ekleyebilirsiniz. Bu işlem loglanmaz.">
          <ProofUploader
            value={expense.screenshotUrl ?? ""}
            onChange={onAttachProof}
            folder="expense"
            placeholder="Resim yükle veya https://... yapıştır"
          />
        </Field>
      ) : expense.screenshotUrl ? (
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
      ) : null}

      {/* Detaylar */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Yayıncı:</span> <strong><NoI18n>{emp?.name}</NoI18n></strong></div>
        <div><span className="text-muted-foreground">Tarih:</span> <strong>{expense.date}</strong></div>
        <div><span className="text-muted-foreground">Marka:</span> <Badge variant="outline"><NoI18n>{expense.brandName}</NoI18n></Badge></div>
        <div><span className="text-muted-foreground">Kategori:</span> <strong><NoI18n>{expense.category}</NoI18n></strong></div>
        <div><span className="text-muted-foreground">Tutar:</span> <strong className="text-base">{fmt(expense.amountUsd)}</strong>
          {expense.amountThb ? ` (${expense.amountThb.toLocaleString("tr-TR")} ฿)` : ""}</div>
        <div><span className="text-muted-foreground">Gönderim:</span> <span className="text-xs">{submitted}</span></div>
      </div>

      <div className="px-3 py-2.5 rounded-lg bg-muted/40 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Açıklama</p>
        <NoI18n as="p" className="text-sm">{expense.description}</NoI18n>
        {expense.notes && (
          <>
            <p className="text-xs text-muted-foreground mt-2 mb-1">Yayıncı notu</p>
            <NoI18n as="p" className="text-xs">{expense.notes}</NoI18n>
          </>
        )}
      </div>

      {(expense.reviewThread?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 max-h-48 overflow-y-auto space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">İnceleme yazışması</p>
          {expense.reviewThread!.map((m, i) => (
            <div key={i} className="text-xs border-b border-border/50 pb-2 last:border-0">
              <span className="font-medium">{m.authorRole === "streamer" ? "Yayıncı" : "Yönetici"}</span>
              <span className="text-muted-foreground"> · {fmtDateTime(m.at)}</span>
              <NoI18n as="p" className="mt-0.5 whitespace-pre-wrap">{m.message}</NoI18n>
            </div>
          ))}
        </div>
      )}

      {/* Yönetici notu */}
      <Field label="Yönetici mesajı" hint="Onay / red / detay iste — yayıncı bu metni görür ve yanıtlayabilir">
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ek bilgi, neden vs..." rows={3} />
      </Field>

      {canMarkPaid && (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 dark:border-amber-500/35 dark:bg-amber-950/25 px-3 py-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Özel durum (hack / hibe / elzem)
          </p>
          <p className="text-[11px] text-muted-foreground">
            Hibe veya hack seçilirse harcama ödeme borcuna yazılmaz. Elzem kayıt tutar; ödeme yolunu ayrıca seçebilirsin.
          </p>
          <FormGrid>
            <Field label="Durum">
              <Select
                value={excKind}
                onChange={(e) => setExcKind(e.target.value as ContentExpenseExceptionKind | "")}
                options={[
                  { value: "", label: "Yok — normal onay" },
                  ...CONTENT_EXPENSE_EXCEPTION_KINDS.map((k) => ({
                    value: k,
                    label: CONTENT_EXPENSE_EXCEPTION_LABELS[k],
                  })),
                ]}
              />
            </Field>
            <Field label="Kısa açıklama">
              <Input
                value={excNote}
                onChange={(e) => setExcNote(e.target.value)}
                placeholder="örn. hesap hacklendi / hibe edildi"
                disabled={!excKind}
              />
            </Field>
          </FormGrid>
          {excKind && (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:border-amber-500/50"
              onClick={() => onMarkException(excKind, excNote.trim(), note.trim())}
            >
              <AlertTriangle size={13} />
              {CONTENT_EXPENSE_EXCEPTION_LABELS[excKind]} olarak kaydet
            </Button>
          )}
        </div>
      )}

      {canMarkPaid && !writeOffSelected ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ödeme yolu</p>
          <div className="space-y-2 text-sm">
            {([
              { id: "approve_only" as const, label: "Sadece onayla", hint: "Ödeme yolu sonra seçilir" },
              { id: "kasa" as const, label: "Kasadan düş", hint: "Hemen kasa çıkışı oluşturulur" },
              {
                id: "existing_kasa" as const,
                label: "Önceden ödendi (mevcut kasa)",
                hint: "Yeni çıkış yok — bordro/ödeme hareketine bağlanır",
              },
              { id: "payroll" as const, label: "Maaşa masraf ekle", hint: "Bu ay bordro netine dahil edilir" },
            ]).map((opt) => (
              <label key={opt.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="settlement"
                  checked={settlement === opt.id}
                  onChange={() => setSettlement(opt.id)}
                  className="mt-0.5"
                />
                <span>
                  <strong>{opt.label}</strong>
                  <span className="block text-[10px] text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {settlement === "existing_kasa" && (
            <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/40 dark:border-emerald-500/35 dark:bg-emerald-950/20 p-3 space-y-2">
              <p className="text-[11px] text-emerald-900 dark:text-emerald-100">
                Örn. Ponpon Ekim maaşı zaten kasadan çıktıysa, aynı hareketi seçin — bakiye tekrar düşmez.
              </p>
              <Field label="Mevcut kasa çıkışı" required>
                <Select
                  value={existingKasaTxId}
                  onChange={(e) => setExistingKasaTxId(e.target.value)}
                  options={[
                    { value: "", label: "Hareket seçin…" },
                    ...recentOutTxs.map((t) => ({
                      value: t.id,
                      label: `${t.date.slice(0, 10)} · −${fmt(t.amountUsd)} · ${t.purpose.slice(0, 48)}`,
                    })),
                  ]}
                />
              </Field>
            </div>
          )}
          {settlement === "kasa" && activeKasas.length > 0 && (
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
                        label: kasaSelectOptionLabel(k, kasas, kasaTransactions, tronPanel),
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
      ) : !canMarkPaid ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-200">
          Denetçi onayı harcamayı kabul eder; ödeme işaretleme yetkisi yöneticidedir.
        </p>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
          Hibe/hack seçili — yukarıdaki “olarak kaydet” ile kapat; kasa/maaş yolu kullanılmaz.
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
        {!writeOffSelected && (
          <Button
            type="button"
            onClick={() =>
              onApprove(
                note,
                canMarkPaid ? settlement : "approve_only",
                canMarkPaid && settlement === "existing_kasa" && existingKasaTxId
                  ? {
                      kasaId:
                        kasaTransactions.find((t) => t.id === existingKasaTxId)?.kasaId ??
                        selectedKasa?.id ??
                        defaultKasaId,
                      feeUsd: 0,
                      existingKasaTxId,
                    }
                  : canMarkPaid && settlement === "kasa" && selectedKasa
                    ? { kasaId: selectedKasa.id, feeUsd }
                    : undefined,
              )
            }
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 size={13} /> Onayla
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ContentExpensesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-foreground">İçerik harcamaları yükleniyor…</div>
      }
    >
      <ContentExpensesPageInner />
    </Suspense>
  );
}
