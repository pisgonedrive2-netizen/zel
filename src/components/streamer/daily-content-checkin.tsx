"use client";

import { useMemo, useState } from "react";
import { Check, ExternalLink, Link2, Pencil, Plus, Trash2, X, Loader2, Sparkles } from "lucide-react";
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
import {
  isoToLocalDateOnly,
  localNoonTimestampIso,
  todayDateLocal,
  weekStartFromDateIso,
} from "@/lib/data";
import type { Brand, WeekBrandReel } from "@/store/store";

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Kick", "Twitter / X", "Telegram", "Diğer"];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Markaya bağlı olmayan içerik için sentinel. */
const BRAND_OTHER = "__other__";

/** İçerik türleri (yayıncının o gün ne attığı). */
const CONTENT_TYPES: { value: string; label: string }[] = [
  { value: "reels", label: "Reels / kısa video" },
  { value: "post", label: "Post / gönderi" },
  { value: "story", label: "Story / hikaye" },
  { value: "video", label: "Video (uzun)" },
  { value: "live", label: "Canlı yayın" },
  { value: "other", label: "Diğer" },
];
const CONTENT_TYPE_LABEL: Record<string, string> = {
  reels: "Reels",
  post: "Post",
  story: "Story",
  video: "Video",
  live: "Canlı",
  other: "Diğer",
};

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

/** URL'den içerik türünü tahmin et (reels / post / story / video). */
function detectContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("/stories/") || u.includes("/story/")) return "story";
  if (u.includes("/reel") || u.includes("/shorts/")) return "reels";
  if (u.includes("/p/") || u.includes("/post")) return "post";
  if (u.includes("tiktok.com")) return "reels";
  if (u.includes("youtu") && u.includes("watch")) return "video";
  if (u.includes("kick.com")) return "live";
  return "reels";
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
  onUpdate?: (id: string, patch: Partial<WeekBrandReel>) => void;
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
  onUpdate,
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
  const [contentType, setContentType] = useState("reels");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? BRAND_OTHER);
  const [note, setNote] = useState("");
  const [touchedPlatform, setTouchedPlatform] = useState(false);
  const [touchedType, setTouchedType] = useState(false);
  // API otomatik metadata
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaHint, setMetaHint] = useState<string | null>(null);
  const [fetchedPublishedAt, setFetchedPublishedAt] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);

  const brandNameOf = (id: string) => {
    if (!id || id === BRAND_OTHER) return "Diğer";
    const b = brands.find((x) => x.id === id);
    return b ? b.shortName : "Diğer";
  };

  const selectedReels = byDay.get(selectedDay) ?? [];

  // URL girilince platform + içerik türü tahmini + API'den yayın tarihi/izlenme çek.
  const autoFetchMeta = async (u: string) => {
    if (!u.trim()) return;
    setMetaLoading(true);
    setMetaHint(null);
    try {
      const res = await fetch("/api/social/url-metadata", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u.trim() }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        publishedAt?: string;
        platform?: string;
        error?: string;
      };
      if (json.ok && json.publishedAt) {
        setFetchedPublishedAt(json.publishedAt);
        if (json.platform && !touchedPlatform) setPlatform(json.platform);
        setMetaHint(
          `API · yayın ${new Date(json.publishedAt).toLocaleString("tr-TR", {
            dateStyle: "medium",
            timeStyle: "short",
          })}`
        );
      } else if (!json.ok) {
        setMetaHint(json.error ?? "Yayın tarihi otomatik alınamadı — gün manuel işaretlenir.");
      }
    } catch {
      setMetaHint("API'ye ulaşılamadı — gün manuel işaretlenir.");
    } finally {
      setMetaLoading(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setNote("");
    setTouchedPlatform(false);
    setTouchedType(false);
    setMetaHint(null);
    setFetchedPublishedAt(undefined);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    // API yayın tarihi varsa onu kullan (achievement gerçek tarihe yansır),
    // yoksa seçili günün öğlenine sabitle.
    const dayIso = isoToLocalDateOnly(fetchedPublishedAt) || selectedDay;
    const publishedAt = fetchedPublishedAt?.includes("T")
      ? fetchedPublishedAt
      : localNoonTimestampIso(dayIso);
    const payload = {
      employeeId,
      weekStart: weekStartFromDateIso(dayIso) || dayIso,
      brandId: brandId === BRAND_OTHER ? "" : brandId,
      contentUrl: u,
      platform,
      contentType,
      publishedAt,
      notes: note.trim(),
    };
    if (editingId && onUpdate) {
      onUpdate(editingId, payload);
      setEditingId(null);
    } else {
      onAdd(payload);
    }
    resetForm();
  };

  const startEdit = (r: WeekBrandReel) => {
    setEditingId(r.id);
    setSelectedDay(dateOnly(r.publishedAt ?? r.createdAt) || selectedDay);
    setUrl(r.contentUrl);
    setPlatform(r.platform);
    setContentType(r.contentType ?? "reels");
    setBrandId(r.brandId || BRAND_OTHER);
    setNote(r.notes ?? "");
    setTouchedPlatform(true);
    setTouchedType(true);
    setFetchedPublishedAt(r.publishedAt);
    setMetaHint(r.publishedAt ? "Mevcut kayıt — kaydet ile güncellenir." : null);
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
                  {r.contentType && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                      {CONTENT_TYPE_LABEL[r.contentType] ?? r.contentType}
                    </span>
                  )}
                  <span
                    className={[
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                      r.brandId
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {brandNameOf(r.brandId)}
                  </span>
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
                  {!readOnly && onUpdate && (
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="shrink-0 text-muted-foreground/50 hover:text-foreground"
                      title="Düzenle"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
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
              {editingId && (
                <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/40 rounded-md px-2 py-1">
                  Düzenleme modu —{" "}
                  <button type="button" className="underline" onClick={() => { setEditingId(null); resetForm(); }}>
                    iptal
                  </button>
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Marka" required>
                  <Select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    options={[
                      ...brands.map((b) => ({ value: b.id, label: `${b.shortName} — ${b.name}` })),
                      { value: BRAND_OTHER, label: "Diğer (markaya bağlı değil)" },
                    ]}
                    required
                  />
                </Field>
                <Field label="İçerik türü" required>
                  <Select
                    value={contentType}
                    onChange={(e) => {
                      setContentType(e.target.value);
                      setTouchedType(true);
                    }}
                    options={CONTENT_TYPES}
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
              <Field
                label="İçerik URL'i"
                required
                hint={metaHint ?? "Tik atmak için içeriğin linki zorunludur — link yapıştırınca tür/tarih otomatik gelir"}
              >
                <div className="flex items-center gap-1.5">
                  <Link2 size={14} className="shrink-0 text-muted-foreground" />
                  <Input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUrl(v);
                      setFetchedPublishedAt(undefined);
                      setMetaHint(null);
                      if (v.trim()) {
                        if (!touchedPlatform) setPlatform(detectPlatform(v));
                        if (!touchedType) setContentType(detectContentType(v));
                      }
                    }}
                    onBlur={(e) => autoFetchMeta(e.target.value)}
                    placeholder="https://instagram.com/reel/…"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1 px-2"
                    title="API'den yayın tarihi ve türü otomatik getir"
                    disabled={!url.trim() || metaLoading}
                    onClick={() => autoFetchMeta(url)}
                  >
                    {metaLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span className="hidden sm:inline">Otomatik</span>
                  </Button>
                </div>
              </Field>
              <Field label="Kısa not (opsiyonel)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. 2. reels, kampanya" />
              </Field>
              <Button type="submit" size="sm" className="gap-1.5" disabled={!url.trim()}>
                {editingId ? <Check size={14} /> : <Plus size={14} />}
                {editingId ? "Kaydet (Supabase)" : "İşaretle ve URL ekle"}
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
