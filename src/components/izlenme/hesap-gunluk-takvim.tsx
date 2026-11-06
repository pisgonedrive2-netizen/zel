"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Minimize2,
  RefreshCw,
  CalendarRange,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HESAP_TAG_LABEL } from "@/lib/yeni-hesaplar";
import {
  hesapGunlukIstanbulDate,
  type HesapGunlukItem,
  type HesapGunlukReport,
  type HesapGunlukRow,
  type HesapGunlukStore,
} from "@/lib/hesap-gunluk-aktivite-shared";
import {
  FAMILY_COLOR,
  FAMILY_LABEL,
  VideoPlayerModal,
  VideoThumb,
  fmtCompact,
  type PlayableMedia,
} from "@/components/izlenme/link-thumb";

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function ymOf(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(y, m - 1, 1 - (startPad - i));
    cells.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
    });
  }
  for (let day = 1; day <= count; day++) {
    cells.push({
      date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [ly, lm, ld] = last.date.split("-").map(Number);
    const d = new Date(ly, lm - 1, ld + 1);
    cells.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
    });
  }
  return cells;
}

function dayTone(report: HesapGunlukReport | undefined, isFuture: boolean): string {
  if (isFuture) return "bg-muted/30 text-muted-foreground";
  if (!report) return "bg-muted/50 text-muted-foreground ring-1 ring-dashed ring-border/70";
  if (!report.final) return "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-200";
  if (report.missing === 0 && report.errors === 0) {
    return "bg-emerald-500/20 text-emerald-900 ring-1 ring-emerald-500/40 dark:text-emerald-200";
  }
  if (report.posted === 0 && report.missing > 0) {
    return "bg-rose-500/20 text-rose-900 ring-1 ring-rose-500/40 dark:text-rose-200";
  }
  return "bg-orange-500/15 text-orange-900 ring-1 ring-orange-500/30 dark:text-orange-200";
}

function monthStats(byDate: Record<string, HesapGunlukReport>, ym: string) {
  let green = 0;
  let partial = 0;
  let red = 0;
  let filled = 0;
  for (const [date, report] of Object.entries(byDate)) {
    if (!date.startsWith(ym)) continue;
    filled += 1;
    if (!report.final) continue;
    if (report.missing === 0 && report.errors === 0) green += 1;
    else if (report.posted === 0 && report.missing > 0) red += 1;
    else partial += 1;
  }
  return { filled, green, partial, red };
}

function platformFamily(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("instagram")) return "instagram";
  if (p.includes("youtube")) return "youtube";
  if (p.includes("tiktok")) return "tiktok";
  return "diger";
}

function contentLabel(t: string) {
  const x = t.toLowerCase();
  if (x === "story") return "hikaye";
  if (x === "reels" || x === "short") return "reel";
  return "video";
}

export function HesapGunlukTakvim({
  store,
  selectedDate,
  onSelectDate,
  onCheckDay,
  onBackfill,
  busy,
  autoFilling,
  readOnly,
  error,
}: {
  store: HesapGunlukStore | null;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onCheckDay: (date: string) => void;
  onBackfill: (days: number) => void;
  busy: boolean;
  autoFilling?: boolean;
  readOnly: boolean;
  error?: string | null;
}) {
  const today = hesapGunlukIstanbulDate();
  const [ym, setYm] = useState(() => ymOf(selectedDate ?? store?.latestDate ?? today));
  const [expanded, setExpanded] = useState(true);
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const cells = useMemo(() => daysInMonth(ym), [ym]);
  const byDate = store?.byDate ?? {};
  const selected = selectedDate ? byDate[selectedDate] ?? null : null;
  const stats = useMemo(() => monthStats(byDate, ym), [byDate, ym]);
  const filledCount = Object.keys(byDate).length;
  const monthLabel = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  }, [ym]);

  useEffect(() => {
    if (selectedDate) setYm(ymOf(selectedDate));
  }, [selectedDate]);

  const canScanSelected =
    !!selectedDate && selectedDate <= today && !readOnly && !busy;

  return (
    <section
      className={cn(
        "mb-6 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-card/80 shadow-sm",
        expanded ? "p-4 sm:p-5 lg:p-6" : "p-4"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold sm:text-base">Paylaşım takvimi</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-[13px]">
            Gece 00:00’de bir önceki gün kesin kapanır. Sayfa açılınca eksik günler otomatik
            doldurulur — tek taramada thumb + link + izlenme toplanır. Güne tıkla, kim ne paylaşmış gör.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <Minimize2 size={14} className="mr-1.5" /> : <Expand size={14} className="mr-1.5" />}
            {expanded ? "Daralt" : "Genişlet"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={readOnly || busy}
            onClick={() => onBackfill(14)}
          >
            <CalendarRange size={14} className={cn("mr-1.5", busy && "animate-pulse")} />
            {busy ? "Dolduruluyor…" : "Yeniden doldur"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canScanSelected}
            onClick={() => selectedDate && onCheckDay(selectedDate)}
          >
            <RefreshCw size={14} className={cn("mr-1.5", busy && "animate-spin")} />
            {selectedDate && selectedDate < today ? "Seçili günü tara" : "Bugünü kontrol et"}
          </Button>
        </div>
      </div>

      {(autoFilling || busy) && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
          <RefreshCw size={12} className="animate-spin" />
          {autoFilling ? "Geçmiş günler otomatik dolduruluyor…" : "Tarama sürüyor…"}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-md bg-muted/60 px-2 py-1 tabular-nums">Kayıtlı gün · {filledCount}</span>
        <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-300">
          Tam · {stats.green}
        </span>
        <span className="rounded-md bg-orange-500/10 px-2 py-1 text-orange-900 dark:text-orange-300">
          Kısmi · {stats.partial}
        </span>
        <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-800 dark:text-rose-300">
          Yok · {stats.red}
        </span>
      </div>

      <div
        className={cn(
          "mt-4 gap-5",
          expanded && "xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)] xl:items-start"
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              onClick={() => setYm((v) => shiftMonth(v, -1))}
              aria-label="Önceki ay"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-medium capitalize sm:text-base">{monthLabel}</p>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              onClick={() => setYm((v) => shiftMonth(v, 1))}
              aria-label="Sonraki ay"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div
            className={cn(
              "mt-3 grid grid-cols-7 text-center font-medium uppercase tracking-wide text-muted-foreground",
              expanded ? "gap-1.5 text-[11px]" : "gap-1 text-[10px]"
            )}
          >
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className={cn("grid grid-cols-7", expanded ? "gap-1.5 sm:gap-2" : "gap-1")}>
            {cells.map((cell) => {
              const report = byDate[cell.date];
              const isFuture = cell.date > today;
              const isToday = cell.date === today;
              const isSelected = selectedDate === cell.date;
              const thumbs = (report?.rows ?? [])
                .flatMap((r) => r.items ?? [])
                .map((i) => i.thumbnailUrl)
                .filter(Boolean)
                .slice(0, 3) as string[];
              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onSelectDate(cell.date)}
                  className={cn(
                    "relative flex flex-col items-stretch overflow-hidden rounded-xl text-left transition",
                    expanded ? "min-h-[4.75rem] sm:min-h-[5.5rem]" : "min-h-[3.25rem]",
                    !cell.inMonth && "opacity-35",
                    dayTone(report, isFuture),
                    isSelected && "outline outline-2 outline-offset-1 outline-primary",
                    isToday && !isSelected && "outline outline-1 outline-offset-0 outline-foreground/25",
                    isFuture && "cursor-default opacity-40"
                  )}
                >
                  <div className={cn("flex items-center justify-between px-1.5 pt-1.5", expanded ? "sm:px-2" : "")}>
                    <span className={cn("font-semibold tabular-nums", expanded ? "text-sm" : "text-xs")}>
                      {Number(cell.date.slice(8))}
                    </span>
                    {report && (
                      <span className="text-[9px] tabular-nums opacity-80">
                        {report.posted}/{report.posted + report.missing}
                      </span>
                    )}
                  </div>
                  {expanded && thumbs.length > 0 && (
                    <div className="mt-auto flex gap-0.5 px-1 pb-1 pt-1">
                      {thumbs.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${cell.date}-${i}`}
                          src={src}
                          alt=""
                          className="h-7 w-5 flex-1 rounded object-cover sm:h-9"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                  )}
                  {expanded && !report && !isFuture && (
                    <span className="mt-auto px-1.5 pb-1.5 text-[9px] opacity-50">boş</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/50" /> Hepsi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-orange-500/50" /> Kısmen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/50" /> Kimse yok
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-border bg-muted/50" />{" "}
              Henüz taranmadı
            </span>
          </div>
        </div>

        <div className={cn(expanded ? "mt-5 xl:mt-0" : "mt-4")}>
          {selected ? (
            <DayDetail report={selected} onPlay={setPlaying} />
          ) : selectedDate ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
              <p className="text-sm font-medium">{selectedDate}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu gün henüz yok. Otomatik doldurma bitince gelir; veya şimdi tarayabilirsin.
              </p>
              {canScanSelected && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => onCheckDay(selectedDate)}
                >
                  <RefreshCw size={14} className={cn("mr-1.5", busy && "animate-spin")} />
                  Bu günü tara
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Bir güne tıkla — hesap ve önizlemeler burada açılır.</p>
          )}
        </div>
      </div>

      {playing && <VideoPlayerModal media={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
}

function DayDetail({
  report,
  onPlay,
}: {
  report: HesapGunlukReport;
  onPlay: (m: PlayableMedia) => void;
}) {
  const posted = report.rows.filter((r) => r.kind === "video" || r.kind === "story");
  const missing = report.rows.filter((r) => r.kind === "none");
  const errored = report.rows.filter((r) => r.kind === "error");
  const checkedLabel = (() => {
    try {
      return new Date(report.checkedAt).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return report.checkedAt;
    }
  })();

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-background/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold tabular-nums">{report.date}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {report.final ? "Kesin" : "Ara"}
            {" · "}
            {report.posted} paylaşan · {report.missing} paylaşmayan
            {report.errors > 0 ? ` · ${report.errors} hata` : ""}
            {" · "}
            {checkedLabel}
          </p>
        </div>
        <Badge variant={report.final ? "default" : "secondary"} className="text-[10px]">
          {report.final ? "kesin" : "ara"}
        </Badge>
      </div>

      {posted.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Paylaşan · {posted.length}
          </p>
          {posted.map((row) => (
            <AccountPreview key={`${row.platform}-${row.handle}`} row={row} onPlay={onPlay} />
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
            Paylaşmayan · {missing.length}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((r) => (
              <li key={`${r.platform}-${r.handle}`}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/5 px-2.5 py-1 text-[11px] hover:bg-rose-500/10"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: FAMILY_COLOR[platformFamily(r.platform)] }}
                  />
                  {r.handle}
                  {r.tag && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                      {HESAP_TAG_LABEL[r.tag]}
                    </Badge>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {errored.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Hata · {errored.length}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {errored.map((r) => (
              <li key={`${r.platform}-${r.handle}`}>
                {r.platform} {r.handle}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {posted.length === 0 && missing.length === 0 && (
        <p className="text-xs text-muted-foreground">Bu gün için satır yok.</p>
      )}
    </div>
  );
}

function AccountPreview({
  row,
  onPlay,
}: {
  row: HesapGunlukRow;
  onPlay: (m: PlayableMedia) => void;
}) {
  const family = platformFamily(row.platform);
  const items = row.items ?? [];
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: FAMILY_COLOR[family] }}
        >
          {FAMILY_LABEL[family] ?? row.platform}
        </span>
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          {row.handle}
          <ExternalLink size={11} className="text-muted-foreground" />
        </a>
        {row.tag && (
          <Badge variant="secondary" className="text-[10px]">
            {HESAP_TAG_LABEL[row.tag]}
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground">
          {[
            row.videoCount ? `${row.videoCount} video` : null,
            row.storyCount ? `${row.storyCount} hikaye` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {items.map((item) => (
            <ItemThumb key={item.url} item={item} family={family} onPlay={onPlay} />
          ))}
        </div>
      ) : row.sampleUrl ? (
        <a
          href={row.sampleUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Örnek paylaşım →
        </a>
      ) : (
        <p className="text-[11px] text-muted-foreground">Önizleme yok (yeniden doldur).</p>
      )}
    </div>
  );
}

function ItemThumb({
  item,
  family,
  onPlay,
}: {
  item: HesapGunlukItem;
  family: string;
  onPlay: (m: PlayableMedia) => void;
}) {
  const media: PlayableMedia = {
    url: item.url,
    title: item.title,
    views: item.views,
    family,
    thumbnailUrl: item.thumbnailUrl,
  };
  return (
    <div className="space-y-0.5">
      <VideoThumb
        media={media}
        onPlay={onPlay}
        compact
        badge={contentLabel(item.contentType)}
      />
      {(item.views != null && item.views > 0) || item.title ? (
        <p className="line-clamp-1 px-0.5 text-[9px] text-muted-foreground">
          {item.views != null && item.views > 0 ? fmtCompact(item.views) : ""}
          {item.views != null && item.views > 0 && item.title ? " · " : ""}
          {item.title ?? ""}
        </p>
      ) : null}
    </div>
  );
}
