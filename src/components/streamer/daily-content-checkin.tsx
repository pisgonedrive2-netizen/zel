"use client";

import { useMemo, useState } from "react";
import { Check, ExternalLink, Link2, Plus, Trash2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PlatformGlyph } from "@/lib/platform-glyph";
import { todayDateLocal, weekStartFromDateIso } from "@/lib/data";
import type { Brand, WeekBrandReel } from "@/store/store";

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Kick", "Twitter / X", "Telegram", "Diğer"];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** URL'den platformu tahmin et. */
function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram")) return "Instagram";
  if (u.includes("tiktok")) return "TikTok";
  if (u.includes("youtu")) return "YouTube";
  if (u.includes("kick.com")) return "Kick";
  if (u.includes("twitter") || u.includes("x.com")) return "Twitter / X";
  if (u.includes("t.me") || u.includes("telegram")) return "Telegram";
  return "Diğer";
}

/** ISO (tarih veya tarih+saat) → YYYY-MM-DD. */
function dateOnly(iso: string | undefined | null): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** today'den geriye N günün ISO listesi (eski → yeni). */
function lastNDays(n: number): string[] {
  const today = todayDateLocal();
  const [y, m, d] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m - 1, d - i, 12, 0, 0);
    out.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
        dt.getDate()
      ).padStart(2, "0")}`
    );
  }
  return out;
}

function weekdayIdx(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7; // Pzt=0
}

interface Props {
  employeeId: string;
  brands: Brand[];
  /** Bu yayıncıya ait tüm hafta reel/içerik kayıtları (filtrelenmemiş olabilir). */
  reels: WeekBrandReel[];
  onAdd: (r: Omit<WeekBrandReel, "id" | "createdAt">) => void;
  onDelete: (id: string) => void;
  /** Salt-okunur (admin görüntüleme vb.) — ekleme/silme gizlenir. */
  readOnly?: boolean;
  days?: number;
}

/**
 * 30 günlük günlük içerik check-in'i.
 * Her gün için içerik üretildiyse "tik" atılır; tik atmak için içeriğin URL'i
 * zorunludur. Kayıtlar `week_brand_reels` üzerinde tutulur (achievement takvimi
 * ve izlenme refresh'i ile aynı veri).
 */
export function DailyContentCheckin({
  employeeId,
  brands,
  reels,
  onAdd,
  onDelete,
  readOnly = false,
  days = 30,
}: Props) {
  const today = todayDateLocal();
  const dayList = useMemo(() => lastNDays(days), [days]);

  // gün → bu yayıncının o günkü içerikleri
  const byDay = useMemo(() => {
    const map = new Map<string, WeekBrandReel[]>();
    for (const r of reels) {
      if (r.employeeId !== employeeId) continue;
      const d = dateOnly(r.publishedAt ?? r.createdAt ?? r.weekStart);
      if (!d) continue;
      const arr = map.get(d) ?? [];
      arr.push(r);
      map.set(d, arr);
    }
    return map;
  }, [reels, employeeId]);

  const doneCount = useMemo(
    () => dayList.filter((d) => (byDay.get(d)?.length ?? 0) > 0).length,
    [dayList, byDay]
  );

  const [selectedDay, setSelectedDay] = useState<string>(today);

  // Ekleme formu
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [touchedPlatform, setTouchedPlatform] = useState(false);

  const selectedReels = byDay.get(selectedDay) ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u || !brandId) return;
    onAdd({
      employeeId,
      weekStart: weekStartFromDateIso(selectedDay),
      brandId,
      contentUrl: u,
      platform,
      publishedAt: `${selectedDay}T12:00:00.000Z`,
      notes: note.trim(),
    });
    setUrl("");
    setNote("");
    setTouchedPlatform(false);
  };

  const fmtDayLabel = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS_SHORT[m - 1]}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
            Günlük içerik check-in ({days} gün)
          </CardTitle>
          <CardDescription>
            İçerik ürettiğin günü işaretle — işaretlemek için içeriğin URL&apos;ini eklemen zorunlu.
          </CardDescription>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-center">
          <span className="text-lg font-bold tabular-nums text-foreground">
            {doneCount}
            <span className="text-sm font-normal text-muted-foreground">/{days}</span>
          </span>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">gün işaretli</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gün ızgarası */}
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {dayList.map((iso) => {
            const count = byDay.get(iso)?.length ?? 0;
            const done = count > 0;
            const isToday = iso === today;
            const isSelected = iso === selectedDay;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDay(iso)}
                title={`${iso}${done ? ` · ${count} içerik` : " · içerik yok"}`}
                className={[
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[10px] font-medium transition",
                  done
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border/60 bg-muted/30 text-muted-foreground/70 hover:bg-muted",
                  isSelected ? "ring-2 ring-primary" : isToday ? "ring-1 ring-[#FF6B00]/70" : "",
                ].join(" ")}
              >
                <span className="text-[8px] uppercase opacity-60">{WEEKDAY_SHORT[weekdayIdx(iso)]}</span>
                <span className="text-xs font-semibold">{Number(iso.slice(8, 10))}</span>
                {done ? (
                  <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span className="h-[11px]" />
                )}
                {count > 1 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[8px] font-bold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Seçili gün paneli */}
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">
            {fmtDayLabel(selectedDay)}
            {selectedDay === today && <span className="ml-1 text-[10px] text-[#FF6B00]">· bugün</span>}
          </p>

          {/* O günün içerikleri */}
          {selectedReels.length > 0 ? (
            <ul className="space-y-1.5">
              {selectedReels.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5"
                >
                  <PlatformGlyph platform={r.platform} size={15} className="shrink-0 text-muted-foreground" />
                  <a
                    href={r.contentUrl}
                    target="_blank"
                    rel="noopener"
                    className="flex-1 min-w-0 truncate font-mono text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.contentUrl}
                  </a>
                  {r.lastViews != null && (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {r.lastViews.toLocaleString("tr-TR")} izl.
                    </span>
                  )}
                  <a
                    href={r.contentUrl}
                    target="_blank"
                    rel="noopener"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Aç"
                  >
                    <ExternalLink size={12} />
                  </a>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="shrink-0 text-muted-foreground/50 hover:text-red-600"
                      title="Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <X size={12} /> Bu gün için içerik eklenmedi.
            </p>
          )}

          {/* Ekleme formu */}
          {!readOnly && (
            <form onSubmit={submit} className="space-y-2 border-t border-border/60 pt-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                <Field label="Marka" required>
                  <Select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    options={brands.map((b) => ({ value: b.id, label: `${b.shortName} — ${b.name}` }))}
                    required
                  />
                </Field>
                <Field label="Platform">
                  <Select
                    value={platform}
                    onChange={(e) => {
                      setPlatform(e.target.value);
                      setTouchedPlatform(true);
                    }}
                    options={PLATFORMS.map((p) => ({ value: p, label: p }))}
                  />
                </Field>
              </div>
              <Field label="İçerik URL'i" required hint="Tik atmak için içeriğin linki zorunludur">
                <div className="flex items-center gap-1.5">
                  <Link2 size={14} className="shrink-0 text-muted-foreground" />
                  <Input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUrl(v);
                      if (!touchedPlatform && v.trim()) setPlatform(detectPlatform(v));
                    }}
                    placeholder="https://instagram.com/reel/…"
                    className="font-mono text-xs"
                  />
                </div>
              </Field>
              <Field label="Kısa not (opsiyonel)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. 2. reels, Stories" />
              </Field>
              <Button type="submit" size="sm" className="gap-1.5" disabled={!url.trim() || !brandId}>
                <Plus size={14} /> İşaretle ve URL ekle
              </Button>
            </form>
          )}
        </div>

        {/* Efsane */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="flex h-3 w-3 items-center justify-center rounded border border-emerald-400/60 bg-emerald-500/15">
              <Check size={8} className="text-emerald-600" />
            </span>
            İçerik eklendi
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-border/60 bg-muted/30" />
            Boş gün
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
