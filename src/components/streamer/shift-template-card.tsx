"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Coffee, Sparkles, Check, AlertTriangle, Undo2, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { WEEKDAYS_LONG, type Employee, type WeeklyPlan } from "@/store/store";
import { weekStartFromDateIso } from "@/lib/data";
import {
  SHIFT_TEMPLATE_7H,
  SHIFT_TEMPLATE_SPAN_HOURS,
  SHIFT_TEMPLATE_WORK_HOURS,
  buildShiftBlocks,
} from "@/lib/shift-template";

type PlanInput = Omit<WeeklyPlan, "id">;

/**
 * Önerilen 7 saatlik vardiya şablonu kartı. Yayıncı/yönetici, değişken bir
 * başlangıç saati seçip haftanın BOŞ günlerine şablonu uygular. Dolu günlere
 * dokunulmaz (mevcut planlar korunur).
 */
export function ShiftTemplateCard({
  weekStart,
  weekDays,
  employeeId,
  userId,
  existingPlans,
  defaultStartTime = "20:00",
  onApply,
  employees,
  onSelectEmployee,
  onUndo,
}: {
  weekStart: string;
  /** Haftanın 7 günü (Pzt→Paz) ISO. */
  weekDays: string[];
  employeeId: string;
  userId: string;
  /** Bu yayıncı + hafta için mevcut planlar (dolu gün tespiti). */
  existingPlans: WeeklyPlan[];
  defaultStartTime?: string;
  /** Planları ekler ve oluşturulan kayıt id'lerini döndürür (geri al için). */
  onApply: (plans: PlanInput[]) => string[];
  /** Şablonun uygulanacağı yayıncıyı seçmek için (opsiyonel — yönetici görünümü). */
  employees?: Employee[];
  onSelectEmployee?: (id: string) => void;
  /** Verilen plan id'lerini siler (son uygulamayı geri al). */
  onUndo?: (ids: string[]) => void;
}) {
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [confirming, setConfirming] = useState(false);
  // Son uygulanan kayıtların id'leri (bu yayıncı için) — geri al butonu için.
  const [lastApplied, setLastApplied] = useState<{ employeeId: string; ids: string[] } | null>(null);

  const targetEmployee = employees?.find((e) => e.id === employeeId);

  // Hangi günlerde zaten plan var?
  const filledDays = useMemo(() => {
    const set = new Set<string>();
    for (const p of existingPlans) set.add(p.date);
    return set;
  }, [existingPlans]);

  const emptyDays = useMemo(
    () => weekDays.filter((d) => !filledDays.has(d)),
    [weekDays, filledDays]
  );

  // Varsayılan seçim: boş günler.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(emptyDays));

  // Hafta değişince seçimi boş günlerle yenile.
  const weekKey = weekDays.join("|");
  const [lastWeekKey, setLastWeekKey] = useState(weekKey);
  if (weekKey !== lastWeekKey) {
    setLastWeekKey(weekKey);
    setSelected(new Set(emptyDays));
  }

  const toggleDay = (d: string) => {
    if (filledDays.has(d)) return; // dolu gün — değiştirilemez
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const blocks = useMemo(() => buildShiftBlocks(startTime), [startTime]);
  const targetDays = useMemo(
    () => weekDays.filter((d) => selected.has(d) && !filledDays.has(d)),
    [weekDays, selected, filledDays]
  );

  const apply = () => {
    if (targetDays.length === 0) return;
    const now = new Date().toISOString();
    const plans: PlanInput[] = [];
    for (const day of targetDays) {
      for (const b of blocks) {
        plans.push({
          employeeId,
          weekStart: weekStartFromDateIso(day) || weekStart,
          date: day,
          startTime: b.startTime,
          endTime: b.endTime,
          activity: b.activity,
          brandName: "",
          notes: b.notes,
          status: "planned",
          createdBy: userId,
          createdAt: now,
        });
      }
    }
    const ids = onApply(plans) ?? [];
    setLastApplied({ employeeId, ids: ids.filter(Boolean) });
    setConfirming(false);
  };

  const undo = () => {
    if (!lastApplied || lastApplied.ids.length === 0) return;
    onUndo?.(lastApplied.ids);
    setLastApplied(null);
  };

  // Yayıncı/hafta değişince onay ve "geri al" durumunu sıfırla.
  const undoKey = `${employeeId}|${weekKey}`;
  const [lastUndoKey, setLastUndoKey] = useState(undoKey);
  if (undoKey !== lastUndoKey) {
    setLastUndoKey(undoKey);
    setConfirming(false);
    if (lastApplied && lastApplied.employeeId !== employeeId) setLastApplied(null);
  }

  return (
    <Card className="border-[#FF6B00]/30 bg-gradient-to-br from-orange-50/50 to-card dark:from-orange-950/20">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#FF6B00]" />
            Önerilen {SHIFT_TEMPLATE_SPAN_HOURS} saatlik şablon
          </CardTitle>
          <CardDescription>
            Sosyal medya odaklı · 2-3 derin görev · değişken başlangıç saati
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {employees && onSelectEmployee && (
            <div className="flex items-center gap-1.5">
              <User size={13} className="text-muted-foreground" />
              <Select
                aria-label="Hedef yayıncı"
                value={employeeId}
                onChange={(e) => {
                  setConfirming(false);
                  onSelectEmployee(e.target.value);
                }}
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
                className="h-8 w-[150px]"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-muted-foreground" htmlFor="shift-start">
              Başlangıç (S+0)
            </label>
            <Input
              id="shift-start"
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setConfirming(false);
              }}
              className="h-8 w-[110px]"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blok zaman çizelgesi */}
        <ol className="space-y-1.5">
          {SHIFT_TEMPLATE_7H.map((b, i) => {
            const gen = blocks[i];
            const isBreak = b.kind === "break";
            return (
              <li
                key={`${b.activity}-${i}`}
                className={[
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  isBreak
                    ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-950/25"
                    : "border-border bg-background/60",
                ].join(" ")}
              >
                <span className="flex h-9 min-w-[3.25rem] flex-col items-center justify-center rounded-md bg-muted text-[10px] font-mono font-semibold text-muted-foreground">
                  <span>{gen?.startTime}</span>
                  <span className="text-[8px] opacity-60">S+{b.offsetHours}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    {isBreak && <Coffee size={12} className="text-amber-500" />}
                    {b.activity}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {b.description}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {b.durationHours} saat
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock size={13} />
            Toplam süre <strong className="text-foreground">{SHIFT_TEMPLATE_SPAN_HOURS} saat</strong>{" "}
            (çalışma {SHIFT_TEMPLATE_WORK_HOURS}s + 1s mola)
          </span>
          <span className="text-muted-foreground">
            Bitiş <strong className="font-mono text-foreground">{buildShiftBlocks(startTime).at(-1)?.endTime}</strong>
          </span>
        </div>

        {/* Gün seçimi */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Uygulanacak günler (yalnızca boş günler — dolu günlere dokunulmaz)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {weekDays.map((d, i) => {
              const isFilled = filledDays.has(d);
              const isSelected = selected.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  disabled={isFilled}
                  title={isFilled ? "Bu günde zaten plan var" : d}
                  className={[
                    "flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-[11px] transition",
                    isFilled
                      ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/50 line-through"
                      : isSelected
                        ? "border-[#FF6B00]/60 bg-[#FF6B00]/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-[#FF6B00]/40",
                  ].join(" ")}
                >
                  <span className="font-semibold">{WEEKDAYS_LONG[i].slice(0, 3)}</span>
                  <span className="text-[9px] opacity-70">{d.slice(8, 10)}</span>
                  {isFilled && <span className="mt-0.5 text-[8px]">dolu</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Son uygulamayı geri al */}
        {lastApplied && lastApplied.ids.length > 0 && lastApplied.employeeId === employeeId && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 text-[11px] dark:border-emerald-500/40 dark:bg-emerald-950/25 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
              <Check size={13} /> {lastApplied.ids.length} plan kaydı eklendi
              {targetEmployee ? ` — ${targetEmployee.name}` : ""}. Saatler yanlışsa geri alabilirsin.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              onClick={undo}
            >
              <Undo2 size={13} /> Son uygulamayı geri al
            </Button>
          </div>
        )}

        {emptyDays.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50/50 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/25 dark:text-emerald-200">
            <Check size={13} /> Bu haftanın tüm günleri planlı — şablon uygulanacak boş gün yok.
          </div>
        ) : confirming ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[#FF6B00]/40 bg-[#FF6B00]/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-foreground">
              <AlertTriangle size={13} className="text-[#FF6B00]" />
              <strong>{targetEmployee?.name ?? "Bu yayıncı"}</strong> için {targetDays.length} güne{" "}
              {targetDays.length * SHIFT_TEMPLATE_7H.length} kayıt eklenecek. Onaylıyor musun?
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setConfirming(false)}>
                Vazgeç
              </Button>
              <Button type="button" size="sm" className="h-7 gap-1.5" onClick={apply}>
                <Check size={13} /> Onayla & uygula
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle size={12} className="text-amber-500" />
              {targetEmployee ? <strong className="text-foreground">{targetEmployee.name}</strong> : null}{" "}
              {targetDays.length} güne, gün başına {SHIFT_TEMPLATE_7H.length} blok eklenecek
              ({targetDays.length * SHIFT_TEMPLATE_7H.length} kayıt).
            </span>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirming(true)}
              disabled={targetDays.length === 0}
            >
              <Sparkles size={13} /> Şablonu uygula
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
