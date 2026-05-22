"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tarih yardımcıları (yerel saat dilimine bağlı) ─────────────────────────
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
// Pazartesi başlangıçlı hafta düzeni — Türkiye için doğal.
const TR_WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toIsoDateTime(d: Date): string {
  return `${toIsoDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseValue(value: string | undefined, withTime: boolean): Date | null {
  if (!value) return null;
  // YYYY-MM-DD veya YYYY-MM-DDTHH:mm formatlarını destekler.
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!isoMatch) return null;
  const [, ys, ms, ds, hs, mins] = isoMatch;
  const year = Number(ys);
  const month = Number(ms) - 1;
  const day = Number(ds);
  const hour = withTime && hs ? Number(hs) : 0;
  const minute = withTime && mins ? Number(mins) : 0;
  const d = new Date(year, month, day, hour, minute);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDisplay(d: Date, withTime: boolean): string {
  const date = d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  if (!withTime) return date;
  return `${date} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  // Pazartesi başlangıçlı 6x7 grid. getDay(): 0=Pazar, 1=Pzt, ..., 6=Cmt
  const first = new Date(year, month, 1);
  const firstDow = (first.getDay() + 6) % 7; // 0 = Pazartesi
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length < 42) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));
  return rows;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Komponent ──────────────────────────────────────────────────────────────
export interface DateTimePickerProps {
  /** ISO formatı: "YYYY-MM-DD" veya "YYYY-MM-DDTHH:mm" */
  value: string;
  onChange: (value: string) => void;
  /** Sadece tarih ("date") veya tarih+saat ("datetime") */
  mode?: "date" | "datetime";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Form içinde gönderilmesi için */
  name?: string;
  id?: string;
  /** Minimum tarih (YYYY-MM-DD). */
  min?: string;
  /** Maksimum tarih. */
  max?: string;
  "aria-required"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

export function DateTimePicker({
  value,
  onChange,
  mode = "date",
  placeholder,
  required = false,
  disabled = false,
  className,
  name,
  id,
  min,
  max,
  "aria-required": ariaRequired,
  "aria-describedby": ariaDescribedby,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const withTime = mode === "datetime";
  const parsed = React.useMemo(() => parseValue(value, withTime), [value, withTime]);
  const [open, setOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState<{ y: number; m: number }>(() => {
    const d = parsed ?? new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // Popover açıldığında, seçilen tarihin ayını göster.
  React.useEffect(() => {
    if (open && parsed) {
      setViewMonth({ y: parsed.getFullYear(), m: parsed.getMonth() });
    }
  }, [open, parsed]);

  const matrix = React.useMemo(
    () => getMonthMatrix(viewMonth.y, viewMonth.m),
    [viewMonth],
  );

  const minDate = React.useMemo(() => parseValue(min, false), [min]);
  const maxDate = React.useMemo(() => parseValue(max, false), [max]);

  const isDisabledDay = (d: Date): boolean => {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const commitDate = (d: Date) => {
    // Tarih + (gerekirse) önceki saati koru.
    const time = parsed && withTime ? { h: parsed.getHours(), m: parsed.getMinutes() } : null;
    const final = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      time?.h ?? 0,
      time?.m ?? 0,
    );
    onChange(withTime ? toIsoDateTime(final) : toIsoDate(final));
    if (!withTime) setOpen(false);
  };

  const commitTime = (h: number, m: number) => {
    const base = parsed ?? new Date();
    const final = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      h,
      m,
    );
    onChange(toIsoDateTime(final));
  };

  const today = new Date();
  const displayText = parsed ? formatDisplay(parsed, withTime) : "";

  const navMonth = (dir: -1 | 1) => {
    setViewMonth((prev) => {
      const next = new Date(prev.y, prev.m + dir, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* Native bir hidden input ile form gönderimi & required validasyonu desteklenir. */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}
      <PopoverPrimitive.Trigger
        id={id}
        type="button"
        disabled={disabled}
        aria-required={ariaRequired ?? required}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-left text-[13px]",
          "transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          disabled && "opacity-60 cursor-not-allowed",
          className,
        )}
      >
        <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
        <span className={cn("flex-1 truncate", !displayText && "text-muted-foreground")}>
          {displayText || placeholder || (withTime ? "Tarih ve saat seç" : "Tarih seç")}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-[100]"
        >
          <PopoverPrimitive.Popup
            className={cn(
              // Modal'ın z-50'sinin üzerinde kalmalı — yoksa modal içinde tarih takvimi gizli kalır.
              "z-[100] w-[19rem] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg",
              "data-[open]:animate-in data-[open]:fade-in-0",
              "data-[closed]:animate-out data-[closed]:fade-out-0",
            )}
          >
            {/* Üst: ay navigasyonu */}
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => navMonth(-1)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Önceki ay"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={viewMonth.m}
                  onChange={(e) => setViewMonth((p) => ({ ...p, m: Number(e.target.value) }))}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium"
                  aria-label="Ay"
                >
                  {TR_MONTHS.map((mn, i) => (
                    <option key={mn} value={i}>{mn}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={viewMonth.y}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    if (Number.isFinite(y) && y > 1900 && y < 2200) {
                      setViewMonth((p) => ({ ...p, y }));
                    }
                  }}
                  className="w-16 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums"
                  aria-label="Yıl"
                />
              </div>
              <button
                type="button"
                onClick={() => navMonth(1)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Sonraki ay"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Hafta gün başlıkları */}
            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {TR_WEEKDAYS_SHORT.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Takvim ızgarası */}
            <div className="grid grid-cols-7 gap-0.5">
              {matrix.flat().map((d, idx) => {
                if (!d) return <div key={idx} className="h-8" />;
                const isSelected = isSameDay(d, parsed);
                const isToday = isSameDay(d, today);
                const isOther = d.getMonth() !== viewMonth.m;
                const isDis = isDisabledDay(d);
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDis}
                    onClick={() => commitDate(d)}
                    className={cn(
                      "h-8 rounded-md text-xs tabular-nums transition-colors",
                      "hover:bg-accent focus-visible:outline-1 focus-visible:outline-ring",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold",
                      !isSelected && isToday && "ring-1 ring-inset ring-primary/50 font-semibold",
                      !isSelected && isOther && "text-muted-foreground/40",
                      isDis && "opacity-30 cursor-not-allowed",
                    )}
                    aria-label={d.toLocaleDateString("tr-TR")}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Saat seçici */}
            {withTime && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                <Clock size={13} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Saat</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={parsed?.getHours() ?? 0}
                  onChange={(e) => {
                    const h = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                    commitTime(h, parsed?.getMinutes() ?? 0);
                  }}
                  className="w-12 rounded-md border border-border bg-background px-1.5 py-1 text-center text-sm tabular-nums"
                  aria-label="Saat"
                />
                <span className="text-sm text-muted-foreground">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={parsed?.getMinutes() ?? 0}
                  onChange={(e) => {
                    const m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                    commitTime(parsed?.getHours() ?? 0, m);
                  }}
                  className="w-12 rounded-md border border-border bg-background px-1.5 py-1 text-center text-sm tabular-nums"
                  aria-label="Dakika"
                />
                <div className="ml-auto flex gap-1">
                  {[
                    ["09:00", 9, 0],
                    ["12:00", 12, 0],
                    ["18:00", 18, 0],
                  ].map(([label, h, m]) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => commitTime(Number(h), Number(m))}
                      className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Alt aksiyonlar */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  commitDate(now);
                  if (withTime) {
                    commitTime(now.getHours(), now.getMinutes());
                  }
                }}
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-accent"
              >
                {withTime ? "Şimdi" : "Bugün"}
              </button>
              {parsed && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Temizle
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Kapat
              </button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
