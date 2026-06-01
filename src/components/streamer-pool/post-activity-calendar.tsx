"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoToLocalDateOnly, todayDateLocal } from "@/lib/data";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function dateOnly(iso: string | undefined | null): string {
  return isoToLocalDateOnly(iso);
}

function ymOf(date: string): string {
  return date.slice(0, 7);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Bir günden bir önceki günün ISO'su. */
function prevDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1, 12, 0, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

interface ActivityCalendarProps {
  /** Paylaşım tarihleri (ISO). Aynı gün birden fazla olabilir — sayım yapılır. */
  activityDates: string[];
  title?: string;
  description?: string;
  /** İlk açılışta gösterilecek ay (YYYY-MM). */
  initialMonthYm?: string;
}

/**
 * Yayıncı paylaşım "achievement" takvimi. Her gün için o gün reel/post
 * paylaşılıp paylaşılmadığını gösterir; aylık ızgara + seri (streak) ve
 * toplam istatistikleri sunar. Tarihler API'den gelen postedAt/publishedAt
 * (yoksa createdAt) üzerinden beslenir.
 */
export function PostActivityCalendar({
  activityDates,
  title = "Paylaşım takvimi",
  description = "Hangi gün içerik paylaştığınızın achievement takibi",
  initialMonthYm,
}: ActivityCalendarProps) {
  const today = todayDateLocal();
  const defaultMonth =
    initialMonthYm && /^\d{4}-\d{2}$/.test(initialMonthYm)
      ? initialMonthYm
      : ymOf(today);
  const [month, setMonth] = useState<string>(defaultMonth);

  useEffect(() => {
    if (initialMonthYm && /^\d{4}-\d{2}$/.test(initialMonthYm)) {
      setMonth(initialMonthYm);
    }
  }, [initialMonthYm]);

  // Tarih → o gün paylaşım sayısı.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const raw of activityDates) {
      const d = dateOnly(raw);
      if (!d) continue;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [activityDates]);

  // Seri (streak) hesapları — bugünden (veya dünden) geriye doğru.
  const { currentStreak, longestStreak, totalDays, totalPosts } = useMemo(() => {
    const days = Array.from(counts.keys()).sort();
    const set = new Set(days);
    let longest = 0;
    for (const d of days) {
      // Bu gün bir serinin başlangıcı mı? (önceki gün yoksa)
      if (set.has(prevDay(d))) continue;
      let len = 1;
      let cursor = d;
      // İleriye git
      // (basit: bir sonraki günü hesapla)
      const next = (date: string) => {
        const [y, m, dd] = date.split("-").map(Number);
        const dt = new Date(y, m - 1, dd + 1, 12, 0, 0);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
          dt.getDate()
        ).padStart(2, "0")}`;
      };
      while (set.has(next(cursor))) {
        cursor = next(cursor);
        len++;
      }
      if (len > longest) longest = len;
    }
    // Mevcut seri: bugün ya da dünden başlayıp geriye.
    let cur = 0;
    let anchor = set.has(today) ? today : set.has(prevDay(today)) ? prevDay(today) : "";
    while (anchor && set.has(anchor)) {
      cur++;
      anchor = prevDay(anchor);
    }
    const totalP = Array.from(counts.values()).reduce((s, n) => s + n, 0);
    return {
      currentStreak: cur,
      longestStreak: longest,
      totalDays: days.length,
      totalPosts: totalP,
    };
  }, [counts, today]);

  // Ay ızgarası — Pazartesi başlangıçlı.
  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1, 12, 0, 0);
    const daysInMonth = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Pzt=0
    const cells: ({ date: string; day: number } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const monthPosted = useMemo(
    () => grid.filter((c) => c && counts.has(c.date)).length,
    [grid, counts]
  );

  const [my, mm] = month.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[mm - 1]} ${my}`;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck size={16} className="text-[#FF6B00]" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Önceki ay"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-foreground">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= ymOf(today)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="Sonraki ay"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* İstatistik rozetleri */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill
            icon={<Flame size={14} className="text-orange-500" />}
            label="Güncel seri"
            value={`${currentStreak} gün`}
          />
          <StatPill
            icon={<Trophy size={14} className="text-amber-500" />}
            label="En uzun seri"
            value={`${longestStreak} gün`}
          />
          <StatPill
            icon={<CalendarCheck size={14} className="text-emerald-500" />}
            label="Bu ay paylaşım"
            value={`${monthPosted} gün`}
          />
          <StatPill
            icon={<CalendarCheck size={14} className="text-sky-500" />}
            label="Toplam içerik"
            value={`${totalPosts}`}
            sub={`${totalDays} gün`}
          />
        </div>

        {/* Hafta günü başlıkları */}
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Gün ızgarası */}
        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} className="aspect-square" />;
            const count = counts.get(cell.date) ?? 0;
            const posted = count > 0;
            const isToday = cell.date === today;
            const isFuture = cell.date > today;
            return (
              <div
                key={cell.date}
                title={
                  posted
                    ? `${cell.date} · ${count} paylaşım`
                    : isFuture
                      ? cell.date
                      : `${cell.date} · paylaşım yok`
                }
                className={[
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[11px] font-medium transition",
                  posted
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : isFuture
                      ? "border-dashed border-border/50 bg-transparent text-muted-foreground/40"
                      : "border-border/60 bg-muted/30 text-muted-foreground/70",
                  isToday ? "ring-2 ring-[#FF6B00]/70" : "",
                ].join(" ")}
              >
                <span>{cell.day}</span>
                {posted && (
                  <span className="mt-0.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-emerald-500">
                    {count > 1 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[8px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Açıklama / efsane */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded border border-emerald-400/50 bg-emerald-500/15" />
            Paylaşım yapıldı
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded border border-border/60 bg-muted/30" />
            Paylaşım yok
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded border-2 border-[#FF6B00]/70" />
            Bugün
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold text-foreground">
          {value}
          {sub && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
