"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  Printer,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { BRAND_CHART_COLORS } from "@/lib/brand-viewership-series";
import { weekdayShort } from "@/lib/i18n/weekday";
import { t } from "@/lib/i18n/t";
import { shiftWeekStartIso, weekDayIsosFromStart } from "@/lib/data";
import type { WeeklyPlan } from "@/store/store";
import {
  GALAGRUP_BRANDS,
  SHORT_NAME,
  clearSlot,
  computeMonthPlanKpis,
  copyTemplateWeekSlots,
  createFoxstreamMonthlyTemplate,
  expandTemplateWeekToPlans,
  findSlot,
  monthWeekStartsFromAnchor,
  type MonthlyBrandId,
  type MonthlyContentKind,
  type MonthlySlot,
  upsertSlot,
  validateMonthPlanRules,
} from "@/lib/monthly-content-template";

function fillTpl(template: string, params?: Record<string, string | number>): string {
  let s = t(template);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKS = [1, 2, 3, 4] as const;

const KIND_OPTIONS: { value: MonthlyContentKind; label: string }[] = [
  { value: "reels", label: "Reels" },
  { value: "adult", label: "Yetişkin" },
  { value: "vlog", label: "Vlog" },
  { value: "kick", label: "Kick yayını" },
  { value: "edit", label: "Edit / montaj" },
  { value: "off", label: "İzin" },
  { value: "flex", label: "Serbest" },
];

const BRAND_OPTIONS: { value: MonthlyBrandId; label: string }[] = [
  { value: "br-padi", label: "Padişah" },
  { value: "br-gala", label: "Galabet" },
  { value: "br-boffice", label: "Boffice" },
  { value: "br-pipo", label: "Pipo" },
  { value: "br-hit", label: "Hit" },
];

function cellTone(slot: MonthlySlot | undefined): string {
  if (!slot) return "border-dashed border-border/60 bg-muted/20 text-muted-foreground";
  if (slot.kind === "off") return "border-border bg-muted/40 text-muted-foreground";
  if (slot.kind === "edit") return "border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-100";
  if (slot.kind === "flex") return "border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-200";
  if (slot.reelsMode === "galagrup") {
    return "border-teal-500/40 bg-teal-950/40 text-teal-50";
  }
  const primary = slot.brandIds[0];
  if (primary === "br-padi") return "border-violet-500/40 bg-violet-600/25 text-violet-50";
  if (primary === "br-gala") return "border-emerald-500/40 bg-emerald-600/20 text-emerald-50";
  if (primary === "br-hit") return "border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100";
  if (primary === "br-pipo") return "border-cyan-500/40 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  if (primary === "br-boffice") return "border-purple-500/40 bg-purple-500/15 text-purple-950 dark:text-purple-100";
  return "border-border bg-card";
}

function slotsToCsv(slots: MonthlySlot[], weekStarts: string[], employeeName?: string): string {
  const header = ["Hafta", "HaftaBaşlangıç", "Gün", "Tür", "Başlık", "Markalar", "Adet", "Not", "Yayıncı"];
  const rows = [...slots]
    .sort((a, b) => a.weekIndex - b.weekIndex || a.dayIndex - b.dayIndex)
    .map((s) => {
      const brands = s.brandIds.map((id) => SHORT_NAME[id]).join("+");
      return [
        String(s.weekIndex),
        weekStarts[s.weekIndex - 1] ?? "",
        weekdayShort(s.dayIndex),
        s.kind,
        s.title,
        brands,
        String(s.quantity),
        (s.notes ?? "").replaceAll("\n", " "),
        employeeName ?? "",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",");
    });
  return [header.join(","), ...rows].join("\n");
}

export function MonthlyContentPlanPanel({
  employeeId,
  employeeName,
  userId,
  monthAnchorMonday,
  onChangeMonthAnchor,
  existingPlans,
  onApplyPlans,
  readOnly,
}: {
  employeeId: string;
  employeeName?: string;
  userId?: string;
  /** Ayın 1. plan haftası (Pazartesi ISO). */
  monthAnchorMonday: string;
  onChangeMonthAnchor?: (iso: string) => void;
  existingPlans: WeeklyPlan[];
  /** Planları ekler; oluşturulan id'leri döner. */
  onApplyPlans: (plans: Omit<WeeklyPlan, "id">[]) => string[];
  readOnly?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(() => createFoxstreamMonthlyTemplate().slots);
  const [edit, setEdit] = useState<{ weekIndex: 1 | 2 | 3 | 4; dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6 } | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(1);

  const weekStarts = useMemo(
    () => monthWeekStartsFromAnchor(monthAnchorMonday),
    [monthAnchorMonday],
  );
  const kpis = useMemo(() => computeMonthPlanKpis(slots), [slots]);
  const warnings = useMemo(() => validateMonthPlanRules(slots), [slots]);

  const editingSlot = edit
    ? findSlot(slots, edit.weekIndex, edit.dayIndex) ?? {
        id: `new-w${edit.weekIndex}-d${edit.dayIndex}`,
        weekIndex: edit.weekIndex,
        dayIndex: edit.dayIndex,
        kind: "flex" as const,
        brandIds: [] as MonthlyBrandId[],
        quantity: 1,
        title: "Serbest",
      }
    : null;

  const applyWeek = (weekIndex: 1 | 2 | 3 | 4, mode: "fill-empty" | "overwrite") => {
    const weekStart = weekStarts[weekIndex - 1];
    if (!weekStart || !employeeId) return;
    const draft = expandTemplateWeekToPlans(slots, weekIndex, weekStart, employeeId, userId);
    const days = weekDayIsosFromStart(weekStart);
    const filled = new Set(
      existingPlans
        .filter((p) => p.employeeId === employeeId && p.status !== "cancelled")
        .map((p) => p.date.slice(0, 10)),
    );
    const toWrite =
      mode === "overwrite"
        ? draft
        : draft.filter((p) => !filled.has(p.date.slice(0, 10)));
    if (toWrite.length === 0) {
      setApplyMsg(fillTpl("Hafta {n}: yazılacak boş gün yok (veya zaten dolu).", { n: weekIndex }));
      return;
    }
    const ids = onApplyPlans(toWrite);
    const range = `${days[0]} … ${days[6]}${employeeName ? ` · ${employeeName}` : ""}`;
    setApplyMsg(
      fillTpl("Hafta {n} → {count} plan yazıldı ({range}).", {
        n: weekIndex,
        count: ids.length,
        range,
      }),
    );
  };

  const applyAllWeeks = () => {
    if (!employeeId) return;
    let total = 0;
    for (const w of WEEKS) {
      const weekStart = weekStarts[w - 1];
      if (!weekStart) continue;
      const draft = expandTemplateWeekToPlans(slots, w, weekStart, employeeId, userId);
      const filled = new Set(
        existingPlans
          .filter((p) => p.employeeId === employeeId && p.status !== "cancelled")
          .map((p) => p.date.slice(0, 10)),
      );
      const toWrite = draft.filter((p) => !filled.has(p.date.slice(0, 10)));
      if (toWrite.length) total += onApplyPlans(toWrite).length;
    }
    setApplyMsg(
      fillTpl("4 hafta → {count} plan yazıldı ({name}).", {
        count: total,
        name: employeeName ?? employeeId,
      }),
    );
  };

  const copyWeekToNext = () => {
    if (selectedWeek >= 4) {
      setApplyMsg(t("4. haftadan sonra şablon haftası yok — takvim haftasını kaydırın."));
      return;
    }
    const next = (selectedWeek + 1) as 1 | 2 | 3 | 4;
    setSlots((s) => copyTemplateWeekSlots(s, selectedWeek, next));
    const tgtStart = weekStarts[next - 1];
    if (tgtStart && employeeId) {
      const after = copyTemplateWeekSlots(slots, selectedWeek, next);
      const plans = expandTemplateWeekToPlans(after, next, tgtStart, employeeId, userId);
      const filled = new Set(
        existingPlans
          .filter((p) => p.employeeId === employeeId && p.status !== "cancelled")
          .map((p) => p.date.slice(0, 10)),
      );
      const toWrite = plans.filter((p) => !filled.has(p.date.slice(0, 10)));
      if (toWrite.length) onApplyPlans(toWrite);
      setApplyMsg(
        fillTpl("Şablon hafta {from} → {to} kopyalandı", {
          from: selectedWeek,
          to: next,
        }) +
          (toWrite.length
            ? fillTpl(" · {count} plan yazıldı.", { count: toWrite.length })
            : t(" · hedef hafta doluydu, yalnızca şablon güncellendi.")),
      );
    } else {
      setApplyMsg(
        fillTpl("Şablon hafta {from} → {to} kopyalandı", {
          from: selectedWeek,
          to: next,
        }),
      );
    }
    setSelectedWeek(next);
  };

  const resetTemplate = () => {
    setSlots(createFoxstreamMonthlyTemplate().slots);
    setApplyMsg(t("Şablon varsayılana sıfırlandı."));
  };

  const downloadCsv = () => {
    const csv = slotsToCsv(slots, weekStarts, employeeName);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aylik-icerik-plani-${weekStarts[0] ?? "plan"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setApplyMsg(t("CSV indirildi."));
  };

  const printPlan = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!win) {
      window.print();
      return;
    }
    const range = `${weekStarts[0] ?? ""} → ${weekStarts[3] ? weekDayIsosFromStart(weekStarts[3])[6] : ""}`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${t("Aylık İçerik Planı")}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;color:#111;background:#fff}
  h1{font-size:18px;margin:0 0 4px} .meta{font-size:12px;color:#555;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}
  th{background:#f3f3f3;font-size:10px;text-transform:uppercase}
  .kpi{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 16px}
  .kpi span{border:1px solid #ddd;border-radius:8px;padding:6px 10px;font-size:12px}
  .kpi b{display:block;font-size:16px}
  @media print{body{padding:0}}
</style></head><body>
<h1>${t("Aylık İçerik Planı")}${employeeName ? ` · ${employeeName}` : ""}</h1>
<p class="meta">${range}</p>
<div class="kpi">
  <span><b>${kpis.totalReelsShoot}</b>${t("Toplam reels")}</span>
  <span><b>${kpis.totalAdult}</b>${t("Yetişkin")}</span>
  <span><b>${kpis.totalVlog}</b>${t("Vlog")}</span>
  <span><b>${kpis.totalKick}</b>${t("Kick yayını")}</span>
  <span><b>${kpis.galaStock}</b>${t("Gala stok")}</span>
</div>
${node.querySelector("[data-print-grid]")?.outerHTML ?? ""}
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Card className="border-border/80 shadow-sm print:shadow-none print:border-0">
      <CardHeader className="pb-3 gap-2 print:pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <CalendarRange size={16} className="text-muted-foreground print:hidden" />
              {t("Aylık İçerik Planı")}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {t("4 haftalık şablon · düzenlenebilir · seçili yayıncıya hafta olarak yazılır")}
              {employeeName ? ` (${employeeName})` : ""}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onChangeMonthAnchor?.(shiftWeekStartIso(monthAnchorMonday, -4))}
              disabled={!onChangeMonthAnchor}
            >
              −4 {t("hf")}
            </Button>
            <span className="text-[11px] tabular-nums text-muted-foreground px-1">
              {weekStarts[0]} → {weekStarts[3] ? weekDayIsosFromStart(weekStarts[3])[6] : "—"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onChangeMonthAnchor?.(shiftWeekStartIso(monthAnchorMonday, 4))}
              disabled={!onChangeMonthAnchor}
            >
              +4 {t("hf")}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={downloadCsv}>
              <Download size={12} /> {t("CSV")}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={printPlan}>
              <Printer size={12} /> {t("Yazdır")}
            </Button>
            {!readOnly && (
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={resetTemplate}>
                <RotateCcw size={12} /> {t("Sıfırla")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={printRef} className="space-y-4">
          {/* Grid */}
          <div data-print-grid className="overflow-x-auto rounded-xl border border-border print:overflow-visible">
            <table className="w-full min-w-[720px] border-collapse text-left print:min-w-0">
              <thead>
                <tr className="bg-muted/40">
                  <th className="w-16 px-2 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("Hafta")}
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th
                      key={d}
                      className="px-1.5 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold"
                    >
                      {weekdayShort(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKS.map((w) => (
                  <tr key={w} className="border-t border-border/60">
                    <td className="px-2 py-1.5 align-top">
                      <div className="text-[11px] font-bold tabular-nums">
                        {w}. {t("hf")}
                      </div>
                      <div className="text-[9px] text-muted-foreground tabular-nums">
                        {weekStarts[w - 1]?.slice(5)}
                      </div>
                    </td>
                    {WEEKDAYS.map((d) => {
                      const s = findSlot(slots, w, d);
                      return (
                        <td key={d} className="p-1 align-top">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => setEdit({ weekIndex: w, dayIndex: d })}
                            className={cn(
                              "w-full min-h-[64px] rounded-lg border px-1.5 py-1.5 text-left transition-colors print:min-h-0 print:rounded-none",
                              cellTone(s),
                              !readOnly && "hover:ring-1 hover:ring-ring/50 cursor-pointer",
                              readOnly && "cursor-default",
                            )}
                          >
                            {s ? (
                              <>
                                <p className="text-[10px] font-semibold leading-snug line-clamp-2">{t(s.title)}</p>
                                {s.reelsMode === "galagrup" && (
                                  <div className="mt-1 flex flex-wrap gap-0.5 print:hidden">
                                    {s.brandIds.map((b) => (
                                      <span
                                        key={b}
                                        className="inline-block h-1.5 w-1.5 rounded-full"
                                        style={{ background: BRAND_CHART_COLORS[b] ?? "#888" }}
                                        title={SHORT_NAME[b]}
                                      />
                                    ))}
                                  </div>
                                )}
                                {s.notes && (
                                  <p className="mt-0.5 text-[9px] opacity-70 line-clamp-1">{t(s.notes)}</p>
                                )}
                              </>
                            ) : (
                              <p className="text-[10px] opacity-60 inline-flex items-center gap-1">
                                <Pencil size={10} className="print:hidden" /> {t("Boş")}
                              </p>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* KPI + reels */}
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {[
                { n: kpis.totalReelsShoot, l: "Toplam reels" },
                { n: kpis.totalAdult, l: "Yetişkin" },
                { n: kpis.totalVlog, l: "Vlog" },
                { n: kpis.totalEdit, l: "Edit / montaj" },
                { n: kpis.totalKick, l: "Kick yayını" },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-border bg-card px-3 py-2.5">
                  <p className="text-xl font-bold tabular-nums leading-none">{k.n}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{t(k.l)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("Reels dağılımı (çekim)")}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["br-padi", kpis.reelsByBrand["br-padi"] ?? 0],
                    ["br-gala", kpis.galaPublish],
                    ["br-boffice", kpis.reelsByBrand["br-boffice"] ?? 0],
                    ["br-pipo", kpis.reelsByBrand["br-pipo"] ?? 0],
                    ["br-hit", kpis.reelsByBrand["br-hit"] ?? 0],
                  ] as const
                ).map(([id, n]) => (
                  <div
                    key={id}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-full print:hidden"
                      style={{ background: BRAND_CHART_COLORS[id] }}
                    />
                    <span className="font-medium">{SHORT_NAME[id]}</span>
                    <span className="tabular-nums font-bold">{n}</span>
                  </div>
                ))}
                <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs">
                  <span className="font-medium">{t("Gala stok")}</span>
                  <span className="tabular-nums font-bold">{kpis.galaStock}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {fillTpl(
                  "Gala: {shoot} çekim → {publish} paylaşım + {stock} stok (çekim günlerinde markayı aradan çıkarmak için).",
                  {
                    shoot: kpis.reelsByBrand["br-gala"] ?? 0,
                    publish: kpis.galaPublish,
                    stock: kpis.galaStock,
                  },
                )}
              </p>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1 print:hidden">
            {warnings.map((w) => (
              <p key={w.code} className="text-[11px] text-amber-900 dark:text-amber-100 inline-flex gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                {fillTpl(w.template, w.params)}
              </p>
            ))}
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 print:hidden">
            <Select
              className="w-36 h-8 text-xs"
              value={String(selectedWeek)}
              onChange={(e) => setSelectedWeek(Number(e.target.value) as 1 | 2 | 3 | 4)}
              options={WEEKS.map((w) => ({
                value: String(w),
                label: fillTpl("Hafta {n}", { n: w }),
              }))}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={!employeeId}
              onClick={() => applyWeek(selectedWeek, "overwrite")}
            >
              <Check size={12} /> {t("Haftayı plana yaz")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={!employeeId}
              onClick={() => {
                if (
                  window.confirm(
                    fillTpl("Hafta {n} için şablon boş günlere yazılsın mı?", { n: selectedWeek }),
                  )
                ) {
                  applyWeek(selectedWeek, "fill-empty");
                }
              }}
            >
              {t("Boş günlere bas")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs gap-1"
              disabled={!employeeId}
              onClick={applyAllWeeks}
            >
              {t("4 haftayı yaz")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={copyWeekToNext}
              disabled={selectedWeek >= 4}
            >
              <Copy size={12} /> {t("Sonraki haftaya kopyala")}
              <ChevronRight size={12} />
            </Button>
            {applyMsg && (
              <p className="text-[11px] text-muted-foreground w-full sm:w-auto sm:ml-auto">{applyMsg}</p>
            )}
          </div>
        )}
      </CardContent>

      {edit && editingSlot && !readOnly && (
        <SlotEditorModal
          slot={editingSlot}
          onClose={() => setEdit(null)}
          onSave={(next) => {
            setSlots((s) => upsertSlot(s, next));
            setEdit(null);
          }}
          onClear={() => {
            setSlots((s) => clearSlot(s, edit.weekIndex, edit.dayIndex));
            setEdit(null);
          }}
        />
      )}
    </Card>
  );
}

function SlotEditorModal({
  slot,
  onClose,
  onSave,
  onClear,
}: {
  slot: MonthlySlot;
  onClose: () => void;
  onSave: (s: MonthlySlot) => void;
  onClear: () => void;
}) {
  const [kind, setKind] = useState<MonthlyContentKind>(slot.kind);
  const [title, setTitle] = useState(slot.title);
  const [notes, setNotes] = useState(slot.notes ?? "");
  const [quantity, setQuantity] = useState(slot.quantity);
  const [brandId, setBrandId] = useState<MonthlyBrandId | "">(slot.brandIds[0] ?? "");
  const [galagrup, setGalagrup] = useState(slot.reelsMode === "galagrup");
  const [stockQty, setStockQty] = useState(slot.stockQty ?? 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={fillTpl("Düzenle · {week}. hafta · gün {day}", {
        week: slot.weekIndex,
        day: slot.dayIndex + 1,
      })}
      size="md"
    >
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">{t("Tür")}</span>
            <Select
              className="h-9 text-xs"
              value={kind}
              onChange={(e) => setKind(e.target.value as MonthlyContentKind)}
              options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
            />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">{t("Adet")}</span>
            <Input
              type="number"
              min={1}
              max={10}
              className="h-9 text-xs"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        <label className="text-xs space-y-1 block">
          <span className="text-muted-foreground">{t("Başlık")}</span>
          <Input className="h-9 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {kind === "reels" && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border"
              checked={galagrup}
              onChange={(e) => setGalagrup(e.target.checked)}
            />
            {t("Galagrup günü (Boffice + Pipo + Hit + Gala + Padi · 1’er)")}
          </label>
        )}
        {kind !== "edit" && kind !== "off" && kind !== "flex" && !galagrup && (
          <label className="text-xs space-y-1 block">
            <span className="text-muted-foreground">{t("Marka")}</span>
            <Select
              className="h-9 text-xs"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value as MonthlyBrandId | "")}
              options={[
                { value: "", label: t("— Marka —") },
                ...BRAND_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              ]}
            />
          </label>
        )}
        {kind === "reels" && brandId === "br-gala" && !galagrup && (
          <label className="text-xs space-y-1 block">
            <span className="text-muted-foreground">{t("Stok (çekimden ayrılacak)")}</span>
            <Input
              type="number"
              min={0}
              max={quantity}
              className="h-9 text-xs"
              value={stockQty}
              onChange={(e) => setStockQty(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        )}
        <label className="text-xs space-y-1 block">
          <span className="text-muted-foreground">{t("Not")}</span>
          <Textarea
            className="text-xs min-h-[64px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("Opsiyonel")}
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const brandIds: MonthlyBrandId[] = galagrup
                ? [...GALAGRUP_BRANDS]
                : brandId
                  ? [brandId]
                  : [];
              onSave({
                ...slot,
                kind,
                title: title.trim() || KIND_OPTIONS.find((k) => k.value === kind)?.label || "Plan",
                notes: notes.trim() || undefined,
                quantity: galagrup ? 5 : quantity,
                brandIds,
                reelsMode: kind === "reels" ? (galagrup ? "galagrup" : "single") : undefined,
                stockQty: kind === "reels" && !galagrup && stockQty > 0 ? stockQty : undefined,
              });
            }}
          >
            {t("Kaydet")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            {t("Vazgeç")}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-rose-600 ml-auto" onClick={onClear}>
            {t("Günü temizle")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
