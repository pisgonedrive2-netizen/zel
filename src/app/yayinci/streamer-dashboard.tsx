"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Wallet, TrendingDown, CalendarDays, Clapperboard, Eye, ExternalLink,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Receipt, Hash, History,
  Instagram, Youtube, Globe, MessageCircle, Send, Twitch, Music2, Lock,
  Plus, Pencil, Image as ImageIcon, Trash2, Clock,
  Check, X as CloseIcon, Link2, Activity, TrendingUp, Video,
  Download, FileSpreadsheet, Target,
} from "lucide-react";
import {
  useStore, calcNetPayable, calcOpenAdvanceBalance, calcAdvanceRepaid,
  WEEKDAYS_LONG, isPayrollActive, weekStartOf, nextWeekStartOf,
  sumApprovedContentExpenses, plannedPayrollPlusApprovedContent, totalCashOutPaidForMonth,
  type ContentExpense, type WeeklyPlan, type StreamerAccount, type BrandLink, type LinkSnapshot,
  type Brand, type BrandViewership, type WeekBrandReel,
} from "@/store/store";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { BrandLogo } from "@/components/brand-logo";
import { fmt, toYearMonthLocal, defaultSnapshotDateInMonth } from "@/lib/data";
import { payrollDueShort } from "@/lib/payroll-dates";
import {
  downloadBrandMonthCsv,
  downloadBrandMonthPdf,
  weekOverlapsMonth,
  type BrandMonthPdfInput,
} from "@/lib/marka-izlenme-pdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, OptionalNumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ProofUploader } from "@/components/proof-uploader";
import { canStreamerEditExpense, canStreamerWithdrawExpense, isActiveContentExpense } from "@/lib/content-expense";

// ── helpers ──────────────────────────────────────────────────────────────
const monthLabel = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("youtube"))   return Youtube;
  if (p.includes("twitch"))    return Twitch;
  if (p.includes("instagram")) return Instagram;
  if (p.includes("tiktok"))    return Music2;
  if (p.includes("telegram"))  return Send;
  if (p.includes("kick"))      return Globe;
  if (p.includes("twitter") || p.includes("x")) return MessageCircle;
  return Globe;
}

const PLATFORMS = [
  "Instagram", "YouTube", "Twitch", "Kick", "TikTok",
  "Telegram", "Twitter / X", "Web Site", "Diğer",
] as const;

/** URL'den favicon URL'i üret (Google s2 servisi). */
function faviconFor(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

/** URL'i dış sekmede aç. Hostname döndürür. */
function urlHostname(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return url; }
}

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

/** Seçilen takvim ayı için link izlenmesi (snapshot öncelikli; bu ay + veri yoksa lastViews). */
function linkMonthViewsMeta(
  link: BrandLink,
  ym: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
) {
  const snapsInMonth = allSnaps
    .filter((s) => s.linkId === link.id && s.date.startsWith(ym))
    .sort((a, b) => b.date.localeCompare(a.date));
  let displayViews: number | null = null;
  let snapDate: string | null = null;
  if (snapsInMonth.length > 0) {
    displayViews = snapsInMonth[0].views;
    snapDate = snapsInMonth[0].date;
  } else if (ym === todayYm && link.lastViews != null) {
    displayViews = link.lastViews;
    snapDate = link.lastSnapshotDate ?? null;
  }
  let delta = 0;
  if (snapsInMonth.length >= 2) {
    delta = snapsInMonth[0].views - snapsInMonth[1].views;
  } else if (snapsInMonth.length === 1) {
    const before = allSnaps
      .filter((s) => s.linkId === link.id && s.date.slice(0, 7) < ym)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (before) delta = snapsInMonth[0].views - before.views;
  } else if (ym === todayYm && link.lastViews != null) {
    const before = allSnaps
      .filter((s) => s.linkId === link.id && s.date.slice(0, 7) < ym)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (before) delta = link.lastViews - before.views;
  }
  return { displayViews, snapDate, snapsInMonth, delta };
}

function formatDateLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

/** Haftalık grup başlığı (örn. 12 May – 18 May 2026) */
function weekRangeLabel(weekStartIso: string) {
  const a = new Date(weekStartIso + "T00:00:00");
  const b = new Date(weekStartIso + "T00:00:00");
  b.setDate(b.getDate() + 6);
  return `${a.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
}

const ACTIVITIES = ["Yayın", "Vlog Çekimi", "Yetişkin İçerik", "Site Videoları", "Edit / Post-Prod", "Reklam Çekimi", "Toplantı", "İzin"] as const;

// ── Expense Submit Form ─────────────────────────────────────────────────
function ExpenseSubmitForm({ employeeId, userId, initial, onSave, onDelete, onClose }: {
  employeeId: string;
  userId: string;
  initial?: ContentExpense;
  onSave: (d: Omit<ContentExpense, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { brands } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Omit<ContentExpense, "id">>({
    date:        initial?.date        ?? today,
    month:       initial?.month       ?? today.slice(0, 7),
    employeeId,
    brandId:     initial?.brandId,
    brandName:   initial?.brandName   ?? "",
    category:    initial?.category    ?? "Vlog",
    description: initial?.description ?? "",
    amountUsd:   initial?.amountUsd   ?? 0,
    amountThb:   initial?.amountThb,
    paid:        initial?.paid        ?? false,
    paidDate:    initial?.paidDate,
    notes:       initial?.notes       ?? "",
    screenshotUrl: initial?.screenshotUrl ?? "",
    submittedAt:  initial?.submittedAt  ?? new Date().toISOString(),
    submittedBy:  initial?.submittedBy  ?? userId,
    reviewStatus: initial?.reviewStatus ?? "pending",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleBrand = (bid: string) => {
    if (!bid) { setForm(f => ({ ...f, brandId: undefined })); return; }
    const b = brands.find(x => x.id === bid);
    setForm(f => ({ ...f, brandId: bid, brandName: b?.shortName ?? f.brandName }));
  };

  const readOnly = initial ? !canStreamerEditExpense(initial) : false;

  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (readOnly) { onClose(); return; }
      if (form.amountUsd <= 0) return;
      onSave({ ...form, reviewStatus: "pending", submittedAt: new Date().toISOString() });
      onClose();
    }}>
      <fieldset disabled={readOnly} className="grid gap-4 disabled:opacity-90">
        <FormGrid>
          <Field label="Tarih" required>
            <DateTimePicker mode="date" value={form.date} onChange={(v) => { set("date", v); set("month", v.slice(0, 7)); }} required />
          </Field>
          <Field label="Marka">
            <Select value={form.brandId ?? ""} onChange={e => handleBrand(e.target.value)}
              options={[{ value: "", label: "— Marka yok / serbest —" }, ...brands.map(b => ({ value: b.id, label: `${b.name} (${b.shortName})` }))]} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka Etiketi" hint='Marka olmayan satırlar için manuel etiket (ör. "Siteler", "Reklam")'>
            <Input value={form.brandName} onChange={e => set("brandName", e.target.value)} placeholder="Gala / Pipo / Siteler" />
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
        <Field label="Kanıt (Resim yükle veya URL yapıştır)" hint="Dekont/ekran görüntüsü — doğrudan resim yükleyebilir veya Gyazo/Imgur linki yapıştırabilirsin">
          <ProofUploader
            value={form.screenshotUrl ?? ""}
            onChange={(v) => set("screenshotUrl", v)}
            folder="expense"
            placeholder="Resim dosyası yükle veya https://... yapıştır"
            disabled={readOnly}
          />
        </Field>
        <Field label="Ek Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="" />
        </Field>
      </fieldset>
      {readOnly && initial && (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
          Bu kayıt onaylandı, reddedildi veya geri çekildi; yalnızca görüntüleyebilirsin.
        </p>
      )}
      <FormActions
        onCancel={onClose}
        onDelete={onDelete}
        deleteLabel="Gönderimi geri çek"
        hideSubmit={readOnly}
        submitLabel={initial ? "Güncelle & Tekrar Gönder" : "Gönder & Onaya Yolla"}
      />
    </form>
  );
}

// ── Weekly Plan Form ────────────────────────────────────────────────────
function WeeklyPlanForm({ employeeId, userId, weekStart, initial, onSave, onDelete, onClose }: {
  employeeId: string;
  userId: string;
  weekStart: string;
  initial?: WeeklyPlan;
  onSave: (d: Omit<WeeklyPlan, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { brands } = useStore();
  const [form, setForm] = useState<Omit<WeeklyPlan, "id">>({
    employeeId,
    weekStart,
    date:       initial?.date      ?? weekStart,
    startTime:  initial?.startTime ?? "",
    endTime:    initial?.endTime   ?? "",
    activity:   initial?.activity  ?? "Yayın",
    brandName:  initial?.brandName ?? "",
    notes:      initial?.notes     ?? "",
    status:     initial?.status    ?? "planned",
    createdBy:  initial?.createdBy ?? userId,
    createdAt:  initial?.createdAt ?? new Date().toISOString(),
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  // Bu hafta haftanın günleri
  const weekDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [weekStart]);

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Tarih" required>
            <Select value={form.date} onChange={e => set("date", e.target.value)} required
              options={weekDays.map(d => ({ value: d, label: formatDateLong(d) }))} />
          </Field>
          <Field label="Aktivite" required>
            <Select value={form.activity} onChange={e => set("activity", e.target.value)} required
              options={ACTIVITIES.map(a => ({ value: a, label: a }))} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Başlangıç">
            <Input type="time" value={form.startTime ?? ""} onChange={e => set("startTime", e.target.value)} />
          </Field>
          <Field label="Bitiş">
            <Input type="time" value={form.endTime ?? ""} onChange={e => set("endTime", e.target.value)} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka / Konu">
            <Input value={form.brandName ?? ""} onChange={e => set("brandName", e.target.value)} placeholder="Gala / Padi vs."
              list="brand-dl" />
            <datalist id="brand-dl">
              {brands.map(b => <option key={b.id} value={b.shortName} />)}
            </datalist>
          </Field>
          <Field label="Durum">
            <Select value={form.status} onChange={e => set("status", e.target.value as WeeklyPlan["status"])}
              options={[
                { value: "planned", label: "Planlandı" },
                { value: "in_progress", label: "Devam Ediyor" },
                { value: "completed", label: "Tamamlandı" },
                { value: "cancelled", label: "İptal" },
              ]} />
          </Field>
        </FormGrid>
        <Field label="Not">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Detay..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Plan Ekle"} />
    </form>
  );
}

// ── Streamer Account Form ────────────────────────────────────────────────
function AccountForm({ employeeId, initial, onSave, onDelete, onClose }: {
  employeeId: string;
  initial?: StreamerAccount;
  onSave: (d: Omit<StreamerAccount, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<StreamerAccount, "id">>({
    employeeId,
    platform: initial?.platform ?? "Instagram",
    handle:   initial?.handle   ?? "",
    url:      initial?.url      ?? "",
    notes:    initial?.notes    ?? "",
    status:   initial?.status   ?? "active",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));
  const favicon = faviconFor(form.url);

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Platform" required>
            <Select value={form.platform} onChange={e => set("platform", e.target.value)} required
              options={PLATFORMS.map(p => ({ value: p, label: p }))} />
          </Field>
          <Field label="Durum">
            <Select value={form.status} onChange={e => set("status", e.target.value as StreamerAccount["status"])}
              options={[
                { value: "active",   label: "Aktif" },
                { value: "inactive", label: "Pasif" },
              ]} />
          </Field>
        </FormGrid>
        <Field label="Kullanıcı Adı / Handle" required>
          <Input value={form.handle} onChange={e => set("handle", e.target.value)} required placeholder="@kullanici" />
        </Field>
        <Field label="URL" hint="Tam adresi yapıştır (örn. https://instagram.com/...)">
          <Input type="url" value={form.url} onChange={e => set("url", e.target.value)}
            placeholder="https://..." className="font-mono text-xs" />
        </Field>
        {favicon && form.url && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={favicon} alt="" loading="lazy" className="w-6 h-6 rounded border border-border bg-white object-contain p-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{urlHostname(form.url)}</p>
              <p className="text-[10px] text-muted-foreground truncate">{form.url}</p>
            </div>
            <a href={form.url} target="_blank" rel="noopener" className="text-blue-600 hover:text-blue-700 shrink-0">
              <ExternalLink size={12} />
            </a>
          </div>
        )}
        <Field label="Not">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="" rows={2} />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Hesap Ekle"} />
    </form>
  );
}

// ── Brand Link Form ──────────────────────────────────────────────────────
function BrandLinkForm({ ownerId, brands, initial, onSave, onDelete, onClose }: {
  ownerId: string;
  brands: { id: string; name: string; shortName: string }[];
  initial?: BrandLink;
  onSave: (d: Omit<BrandLink, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<BrandLink, "id">>({
    brandId:   initial?.brandId   ?? brands[0]?.id ?? "",
    platform:  initial?.platform  ?? "Instagram",
    handle:    initial?.handle    ?? "",
    url:       initial?.url       ?? "",
    ownerId:   initial?.ownerId   ?? ownerId,
    status:    initial?.status    ?? "active",
    notes:     initial?.notes     ?? "",
    lastViews: initial?.lastViews,
    lastSnapshotDate: initial?.lastSnapshotDate,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));
  const favicon = faviconFor(form.url);

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Marka" required>
            <Select value={form.brandId} onChange={e => set("brandId", e.target.value)} required
              options={brands.map(b => ({ value: b.id, label: `${b.name} (${b.shortName})` }))} />
          </Field>
          <Field label="Platform" required>
            <Select value={form.platform} onChange={e => set("platform", e.target.value)} required
              options={PLATFORMS.map(p => ({ value: p, label: p }))} />
          </Field>
        </FormGrid>
        <Field label="Sayfa / Hesap" hint="Bu marka için yayında kullanılan handle">
          <Input value={form.handle} onChange={e => set("handle", e.target.value)} placeholder="@brand_handle" />
        </Field>
        <Field label="URL">
          <Input type="url" value={form.url} onChange={e => set("url", e.target.value)}
            placeholder="https://..." className="font-mono text-xs" />
        </Field>
        {favicon && form.url && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={favicon} alt="" loading="lazy" className="w-6 h-6 rounded border border-border bg-white object-contain p-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{urlHostname(form.url)}</p>
              <p className="text-[10px] text-muted-foreground truncate">{form.url}</p>
            </div>
            <a href={form.url} target="_blank" rel="noopener" className="text-blue-600 hover:text-blue-700 shrink-0">
              <ExternalLink size={12} />
            </a>
          </div>
        )}
        <Field label="Not">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Link Ekle"} />
    </form>
  );
}

// ── Snapshot Quick Form ──────────────────────────────────────────────────
function SnapshotForm({
  link,
  defaultSnapshotDate,
  suggestedBaselineViews,
  listMonthLabel,
  onSave,
  onClose,
}: {
  link: BrandLink;
  /** Üstteki liste ayı ile uyumlu varsayılan snapshot tarihi */
  defaultSnapshotDate: string;
  /** O ay için listede görünen izlenme (form başlangıç değeri) */
  suggestedBaselineViews: number | null;
  listMonthLabel: string;
  onSave: (d: Omit<LinkSnapshot, "id">) => void;
  onClose: () => void;
}) {
  const [views, setViews] = useState<number>(suggestedBaselineViews ?? link.lastViews ?? 0);
  const [date, setDate] = useState<string>(defaultSnapshotDate);
  const [notes, setNotes] = useState<string>("");

  return (
    <form onSubmit={e => {
      e.preventDefault();
      onSave({ linkId: link.id, date, views, notes });
      onClose();
    }}>
      <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border mb-4 space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Liste dönemi · {listMonthLabel}</p>
        <p className="text-xs text-muted-foreground">Güncellenen Link</p>
        <p className="text-sm font-medium">{link.platform} · {link.handle || urlHostname(link.url)}</p>
        {(link.lastViews != null || suggestedBaselineViews != null) && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Bu ayda görünen: {(suggestedBaselineViews ?? link.lastViews ?? 0).toLocaleString("tr-TR")} izlenme
            {link.lastSnapshotDate ? ` · son canlı kayıt: ${link.lastSnapshotDate}` : ""}
          </p>
        )}
      </div>
      <div className="grid gap-3">
        <FormGrid>
          <Field label="Tarih" hint="Genelde seçili ay içinde kalır; gerekirse değiştirin" required>
            <DateTimePicker mode="date" value={date} onChange={(v) => setDate(v)} required />
          </Field>
          <Field label="İzlenme Sayısı" required>
            <Input type="number" min={0} value={views} onChange={e => setViews(parseInt(e.target.value) || 0)} required />
          </Field>
        </FormGrid>
        <Field label="Not">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Detay..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} submitLabel="Snapshot Kaydet" />
    </form>
  );
}

// ── Plan görünümü ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<WeeklyPlan["status"], string> = {
  planned:     "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500/40 dark:text-blue-100",
  in_progress: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/45 dark:border-amber-500/40 dark:text-amber-100",
  completed:   "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/45 dark:border-green-500/40 dark:text-green-100",
  cancelled:   "bg-muted border-border text-muted-foreground line-through",
};

function PlanGrid({ weekStart, label, plans, onAdd, onEdit }: {
  weekStart: string;
  label: string;
  plans: WeeklyPlan[];
  onAdd: () => void;
  onEdit: (p: WeeklyPlan) => void;
}) {
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() + i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [weekStart]);

  const dayCell = (iso: string, i: number, compact?: boolean) => {
    const dayPlans = plans
      .filter(p => p.date === iso)
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    const isToday = iso === new Date().toISOString().slice(0, 10);
    return (
      <div
        key={iso}
        className={`border rounded-lg p-2 min-h-[128px] ${
          compact ? "min-w-[9.5rem] max-w-[11rem] w-[9.5rem] flex-none snap-start shrink-0" : "min-w-0 w-full"
        } ${isToday ? "border-blue-300 bg-blue-50/30 dark:border-blue-500/50 dark:bg-blue-950/35" : "border-border"}`}
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {WEEKDAYS_LONG[i].slice(0, 3)} <span className="text-foreground/60">{iso.slice(8, 10)}</span>
        </p>
        {dayPlans.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/40 italic">—</p>
        ) : (
          <div className="space-y-1">
            {dayPlans.map(p => (
              <button key={p.id} type="button" onClick={() => onEdit(p)}
                className={`block w-full text-left px-1.5 py-1 rounded border text-[10px] ${STATUS_COLORS[p.status]}`}>
                {(p.startTime || p.endTime) && (
                  <p className="font-mono text-[9px]">{p.startTime}{p.endTime && `–${p.endTime}`}</p>
                )}
                <p className="font-medium leading-tight">{p.activity}</p>
                {p.brandName && <p className="text-[9px] opacity-70 truncate">{p.brandName}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full min-w-0 overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{label}</CardTitle>
          <CardDescription className="mt-1">
            {formatDateLong(days[0])} – {formatDateLong(days[6])}
          </CardDescription>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5 shrink-0" type="button">
          <Plus size={14} /> Plan Ekle
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Mobil / tablet: yatay kaydırmalı hafta şeridi */}
        <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 snap-x snap-mandatory touch-pan-x -mx-1 px-1">
          {days.map((iso, i) => dayCell(iso, i, true))}
        </div>
        {/* Masaüstü: tam genişlik 7 sütun */}
        <div className="hidden lg:grid lg:grid-cols-7 gap-2 w-full min-w-0">
          {days.map((iso, i) => dayCell(iso, i, false))}
        </div>
      </CardContent>
    </Card>
  );
}

function BrandMonthViewsCard({
  brand,
  month,
  existing,
  linkViewsSum,
  onSave,
  onExport,
}: {
  brand: Brand;
  month: string;
  existing?: BrandViewership;
  /** Seçili ay + marka linklerindeki snapshot / lastViews ile hesaplanan toplam. */
  linkViewsSum: number;
  onSave: (payload: { views: number; url: string; notes: string }) => void;
  onExport?: (kind: "pdf" | "csv") => void;
}) {
  const hasSavedRow = existing != null;
  const savedViews = existing?.views;
  const baselineViews = hasSavedRow ? (savedViews ?? 0) : linkViewsSum;

  const [views, setViews] = useState(baselineViews);
  const [url, setUrl] = useState(existing?.url ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  useEffect(() => {
    const v = hasSavedRow ? (savedViews ?? 0) : linkViewsSum;
    setViews(v);
    setUrl(existing?.url ?? "");
    setNotes(existing?.notes ?? "");
  }, [
    brand.id,
    month,
    existing?.id,
    hasSavedRow,
    savedViews,
    linkViewsSum,
    existing?.url,
    existing?.notes,
  ]);

  const target = brand.monthlyTarget;
  const progressViews = Math.max(views, linkViewsSum);
  const targetPct =
    target != null && target > 0 ? Math.min(100, (progressViews / target) * 100) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <BrandLogo brandId={brand.id} title={brand.name} size={40} className="rounded-lg mt-0.5" />
            <div className="min-w-0">
            <CardTitle className="text-base">{brand.shortName}</CardTitle>
            <CardDescription className="text-xs">{brand.name}</CardDescription>
            </div>
          </div>
          {target != null && target > 0 && (
            <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">
              Hedef {fmtViews(target)}
            </Badge>
          )}
        </div>
        {target != null && target > 0 && targetPct !== null && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Target size={10} /> İlerleme · {targetPct.toFixed(0)}%</span>
              <span className="tabular-nums">{fmtViews(progressViews)} / {fmtViews(target)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${targetPct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${targetPct}%` }} />
            </div>
          </div>
        )}
        {(!target || target <= 0) && (
          <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
            Bu marka için aylık hedef tanımlı değil. Yönetici <strong>Marka İzlenme</strong> sayfasından hedef girebilir.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <Field label={`${monthLabel(month)} toplam izlenme`}>
          <Input
            type="number"
            min={0}
            value={views}
            onChange={(e) => setViews(parseInt(e.target.value, 10) || 0)}
            className="tabular-nums"
          />
        </Field>
        {linkViewsSum > 0 && (
          <p className="text-[11px] text-muted-foreground leading-snug">
            Marka linkleri (bu ay / güncel):{" "}
            <span className="font-semibold tabular-nums text-foreground">{fmtViews(linkViewsSum)}</span>
            {hasSavedRow && views !== linkViewsSum && (
              <span className="text-amber-700 dark:text-amber-300"> · kayıtlı değerden farklı</span>
            )}
          </p>
        )}
        {linkViewsSum > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs h-8"
            onClick={() => setViews(linkViewsSum)}
          >
            Link toplamını alanı yaz
          </Button>
        )}
        <Field label="Örnek içerik linki" hint="Opsiyonel — tek bir ana reel/post">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Not">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs" />
        </Field>
        {onExport && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8 gap-1"
              onClick={() => onExport("pdf")}
            >
              <Download size={12} /> PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8 gap-1"
              onClick={() => onExport("csv")}
            >
              <FileSpreadsheet size={12} /> CSV
            </Button>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => onSave({ views, url: url.trim(), notes: notes.trim() })}
        >
          Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

function AddWeekReelForm({
  employeeId,
  defaultWeekStart,
  thisWeek,
  nextWeek,
  brands,
  myBrandLinks,
  onAdd,
}: {
  employeeId: string;
  defaultWeekStart: string;
  thisWeek: string;
  nextWeek: string;
  brands: Brand[];
  myBrandLinks: BrandLink[];
  onAdd: (r: Omit<WeekBrandReel, "id" | "createdAt">) => void;
}) {
  const [wk, setWk] = useState(defaultWeekStart);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [contentUrl, setContentUrl] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [pickLinkId, setPickLinkId] = useState("");
  const [notes, setNotes] = useState("");

  const linksForBrand = useMemo(
    () => myBrandLinks.filter((l) => l.brandId === brandId && l.url),
    [myBrandLinks, brandId]
  );

  useEffect(() => {
    if (!pickLinkId) return;
    const l = myBrandLinks.find((x) => x.id === pickLinkId);
    if (l?.url) {
      setContentUrl(l.url);
      setPlatform(l.platform);
    }
  }, [pickLinkId, myBrandLinks]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !contentUrl.trim()) return;
    onAdd({
      employeeId,
      weekStart: wk,
      brandId,
      contentUrl: contentUrl.trim(),
      platform,
      brandLinkId: pickLinkId || undefined,
      notes: notes.trim(),
    });
    setContentUrl("");
    setNotes("");
    setPickLinkId("");
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Video size={13} className="text-violet-600" />
        Bu hafta yayınlanan reel / gönderi ekle
      </p>
      <FormGrid>
        <Field label="Hafta">
          <Select
            value={wk}
            onChange={(e) => setWk(e.target.value)}
            options={[
              { value: thisWeek, label: `Bu hafta · ${weekRangeLabel(thisWeek)}` },
              { value: nextWeek, label: `Gelecek · ${weekRangeLabel(nextWeek)}` },
            ]}
          />
        </Field>
        <Field label="Marka">
          <Select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            options={brands.map((b) => ({ value: b.id, label: `${b.shortName} — ${b.name}` }))}
          />
        </Field>
      </FormGrid>
      {linksForBrand.length > 0 && (
        <Field label="Kayıtlı marka linkinden doldur" hint="İstersen şablondan seç; URL otomatik gelir">
          <Select
            value={pickLinkId}
            onChange={(e) => setPickLinkId(e.target.value)}
            options={[
              { value: "", label: "— Elle URL yazacağım —" },
              ...linksForBrand.map((l) => ({
                value: l.id,
                label: `${l.platform} · ${l.handle || urlHostname(l.url)}`,
              })),
            ]}
          />
        </Field>
      )}
      <FormGrid>
        <Field label="Platform">
          <Select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            options={PLATFORMS.map((p) => ({ value: p, label: p }))}
          />
        </Field>
        <Field label="İçerik linki (reel/post)" required>
          <Input
            type="url"
            required
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
            placeholder="https://instagram.com/reel/…"
            className="font-mono text-xs"
          />
        </Field>
      </FormGrid>
      <Field label="Kısa not">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Örn. 2. reels, Stories serisi" />
      </Field>
      <Button type="submit" size="sm" className="w-full sm:w-auto gap-1.5">
        <Plus size={14} /> Listeye ekle
      </Button>
    </form>
  );
}

export type StreamerSection = "maas" | "harcamalar" | "takvim" | "izlenmeler" | "hesaplar" | "marka-linkleri" | "gecmis";

// ── Page ─────────────────────────────────────────────────────────────────
export function StreamerDashboard({ section }: { section: StreamerSection }) {
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const {
    employees, salaryExtras, advances, paymentStatuses,
    contentExpenses, addContentExpense, updateContentExpense, deleteContentExpense,
    weeklyPlans, addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
    weekBrandReels, addWeekBrandReel, deleteWeekBrandReel,
    scheduleSlots, streamerAccounts, brandLinks, brands, linkSnapshots, brandViewership,
    addStreamerAccount, updateStreamerAccount, deleteStreamerAccount,
    addBrandLink, updateBrandLink, deleteBrandLink, addLinkSnapshot,
    addBrandViewership, updateBrandViewership,
    updateEmployee, pushNotification,
  } = useStore();

  const today    = new Date();
  const todayYm  = toYearMonthLocal(today);
  const thisWeek = weekStartOf(today);
  const nextWeek = nextWeekStartOf(today);
  const [month, setMonth] = useState<string>(todayYm);

  const [expenseModal,  setExpenseModal]  = useState<"new" | ContentExpense | null>(null);
  const [planModal,     setPlanModal]     = useState<{ mode: "new" | WeeklyPlan; weekStart: string } | null>(null);
  const [accountModal,  setAccountModal]  = useState<"new" | StreamerAccount | null>(null);
  const [linkModal,     setLinkModal]     = useState<"new" | BrandLink | null>(null);
  const [snapshotModal, setSnapshotModal] = useState<BrandLink | null>(null);
  const [walletEdit,    setWalletEdit]    = useState<string | null>(null); // null = not editing

  // Erişen kullanıcının çalışan kaydı
  const targetEmployeeId = panelViewAs?.employeeId ?? user?.employeeId;
  const me = employees.find((e) => e.id === targetEmployeeId);
  const isAdminView = user?.role === "admin" && !!panelViewAs;

  if (!user) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto mt-20 text-center">
          <Lock className="mx-auto mb-3 text-muted-foreground" size={32} />
          <h2 className="text-lg font-medium">Erişim Yok</h2>
          <p className="text-sm text-muted-foreground mt-1">Oturum gerekli.</p>
        </div>
      </div>
    );
  }

  if (isAdminView && !me) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto mt-20 text-center">
          <h2 className="text-lg font-medium">Çalışan bulunamadı</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {panelViewAs.employeeName} kaydı silinmiş olabilir.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdminView && (user.role !== "streamer" || !me)) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto mt-20 text-center">
          <Lock className="mx-auto mb-3 text-muted-foreground" size={32} />
          <h2 className="text-lg font-medium">Erişim Yok</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Bu sayfa yalnızca yayıncı kullanıcılara açıktır.
          </p>
        </div>
      </div>
    );
  }

  if (!me) return null;

  // ── Maaş hesapları ──
  const active     = isPayrollActive(me, month);
  const baseSalary = me.baseSalary;
  const empExtras  = salaryExtras.filter(e => e.employeeId === me.id && e.month === month);
  const empAdv     = advances.filter(a => a.employeeId === me.id && a.month === month);
  const rent       = empExtras.filter(e => e.type === "rent")     .reduce((s, e) => s + e.amount, 0);
  const bonus      = empExtras.filter(e => e.type === "bonus")    .reduce((s, e) => s + e.amount, 0);
  const exp        = empExtras.filter(e => e.type === "expense")  .reduce((s, e) => s + e.amount, 0);
  const ded        = empExtras.filter(e => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
  const advTaken   = empAdv.reduce((s, a) => s + a.amount, 0);

  const net          = calcNetPayable(me, month, advances, salaryExtras, paymentStatuses);
  const openAdvNow   = calcOpenAdvanceBalance(me, month, salaryExtras);
  const repaidTotal  = calcAdvanceRepaid(me.id, "9999-12", salaryExtras);
  const paid         = paymentStatuses.find(p => p.employeeId === me.id && p.month === month)?.paid ?? false;

  // ── İçerik harcamaları ──
  // Yayıncının kendi tüm gönderileri (geri çekilen/reddedilenler dahil — listede gösterilsin diye).
  const myExpenses   = contentExpenses.filter(e => e.employeeId === me.id);
  // KPI/toplam metrikleri için aktif (geri çekilmemiş, reddedilmemiş) olanlar.
  const myActiveExpenses = myExpenses.filter(isActiveContentExpense);
  const myThisWeek   = myActiveExpenses.filter(e => e.date >= thisWeek && e.date < nextWeek);
  const myThisWeekTotal = myThisWeek.reduce((s, e) => s + e.amountUsd, 0);
  const myMonthTotal = myActiveExpenses.filter(e => e.month === month).reduce((s, e) => s + e.amountUsd, 0);
  const myPending    = myExpenses.filter(e => e.reviewStatus === "pending");
  const myMonthContentAprv = sumApprovedContentExpenses(contentExpenses, me.id, month);
  const myMonthPlanOut     = plannedPayrollPlusApprovedContent(me, month, advances, salaryExtras, paymentStatuses, contentExpenses);
  const myMonthPaidOut     = totalCashOutPaidForMonth(me, month, advances, salaryExtras, paymentStatuses, contentExpenses);

  // ── Plans ──
  const myPlansThisWeek = weeklyPlans.filter(p => p.employeeId === me.id && p.weekStart === thisWeek);
  const myPlansNextWeek = weeklyPlans.filter(p => p.employeeId === me.id && p.weekStart === nextWeek);

  // ── Marka linkleri ──
  const myAccounts   = streamerAccounts.filter(a => a.employeeId === me.id);
  const myBrandLinks = brandLinks.filter(l => l.ownerId === me.id);

  // ── Önceki aylar özeti ──
  const myHistory = useMemo(() => {
    const months = Array.from(new Set([
      ...salaryExtras.filter(e => e.employeeId === me.id).map(e => e.month),
      ...advances.filter(a => a.employeeId === me.id).map(a => a.month),
      ...contentExpenses.filter(e => e.employeeId === me.id).map(e => e.month),
    ])).sort((a, b) => b.localeCompare(a));
    return months.map(m => {
      const rentM = salaryExtras
        .filter(e => e.employeeId === me.id && e.month === m && e.type === "rent")
        .reduce((s, e) => s + e.amount, 0);
      return {
        month:       m,
        baseSalary:  isPayrollActive(me, m) ? me.baseSalary : 0,
        rentMonth:   rentM,
        net:         calcNetPayable(me, m, advances, salaryExtras, paymentStatuses),
        openAdv:     calcOpenAdvanceBalance(me, m, salaryExtras),
        paid:        paymentStatuses.find(p => p.employeeId === me.id && p.month === m)?.paid ?? false,
        contentAprv: sumApprovedContentExpenses(contentExpenses, me.id, m),
        planned:     plannedPayrollPlusApprovedContent(me, m, advances, salaryExtras, paymentStatuses, contentExpenses),
        paidOut:     totalCashOutPaidForMonth(me, m, advances, salaryExtras, paymentStatuses, contentExpenses),
      };
    });
  }, [me, salaryExtras, advances, paymentStatuses, contentExpenses]);

  const expensesByWeek = useMemo(() => {
    const sorted = [...myExpenses].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, ContentExpense[]>();
    for (const e of sorted) {
      const wk = weekStartOf(e.date);
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 16);
  }, [myExpenses]);

  const accountsByPlatform = useMemo(() => {
    const m = new Map<string, StreamerAccount[]>();
    for (const a of myAccounts) {
      if (!m.has(a.platform)) m.set(a.platform, []);
      m.get(a.platform)!.push(a);
    }
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], "tr"));
  }, [myAccounts]);

  const brandLinksByPlatform = useMemo(() => {
    const m = new Map<string, BrandLink[]>();
    for (const l of myBrandLinks) {
      if (!m.has(l.platform)) m.set(l.platform, []);
      m.get(l.platform)!.push(l);
    }
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], "tr"));
  }, [myBrandLinks]);

  /** Seçili ay için marka başına: link snapshot (o ay) veya bu ay ise lastViews toplamı. */
  const linkViewsByBrandForMonth = useMemo(() => {
    const agg = new Map<string, number>();
    for (const l of myBrandLinks) {
      if (!l.brandId) continue;
      const monthSnaps = linkSnapshots
        .filter((s) => s.linkId === l.id && s.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date));
      let v: number;
      if (monthSnaps.length > 0) {
        v = monthSnaps[0].views;
      } else if (month === todayYm) {
        v = l.lastViews ?? 0;
      } else {
        v = 0;
      }
      agg.set(l.brandId, (agg.get(l.brandId) ?? 0) + v);
    }
    return agg;
  }, [myBrandLinks, linkSnapshots, month, todayYm]);

  const myReels = useMemo(
    () => weekBrandReels.filter((r) => r.employeeId === me.id),
    [weekBrandReels, me.id]
  );
  const reelsByWeek = useMemo(() => {
    const m = new Map<string, WeekBrandReel[]>();
    for (const r of myReels) {
      if (!m.has(r.weekStart)) m.set(r.weekStart, []);
      m.get(r.weekStart)!.push(r);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [myReels]);

  const activeBrands = useMemo(
    () => [...brands].filter((b) => b.status === "active").sort((a, b) => a.shortName.localeCompare(b.shortName, "tr")),
    [brands]
  );

  // ── Submit handler — admin'e bildirim gönder ──
  const handleExpenseWithdraw = (expense: ContentExpense) => {
    updateContentExpense(expense.id, {
      reviewStatus: "cancelled",
      reviewedAt: new Date().toISOString(),
      reviewerNote: "Yayıncı tarafından geri çekildi.",
    });
    setExpenseModal(null);
  };

  const handleExpenseSave = (data: Omit<ContentExpense, "id">) => {
    if (data.amountUsd <= 0) return;
    if (expenseModal === "new") {
      addContentExpense(data);
      pushNotification({
        type: "expense_submitted",
        title: `${me.name} yeni harcama gönderdi`,
        message: `${data.brandName} · ${data.category} · $${data.amountUsd} — ${data.description.slice(0, 80)}`,
        forRole: "admin",
        triggeredBy: user.id,
        href: "/icerik-harcamalari",
      });
      pushNotification({
        type: "expense_submitted",
        title: `Yeni yayıncı harcama raporu`,
        message: `${me.name}: ${data.brandName} $${data.amountUsd}`,
        forRole: "auditor",
        triggeredBy: user.id,
        href: "/icerik-harcamalari",
      });
    } else if (expenseModal) {
      updateContentExpense(expenseModal.id, data);
    }
  };

  const handlePlanSave = (data: Omit<WeeklyPlan, "id">) => {
    if (!planModal) return;
    if (planModal.mode === "new") {
      addWeeklyPlan(data);
      pushNotification({
        type: "schedule_updated",
        title: `${me.name} takvimini güncelledi`,
        message: `${formatDateLong(data.date)} · ${data.activity}${data.brandName ? ` (${data.brandName})` : ""}`,
        forRole: "admin",
        triggeredBy: user.id,
        href: "/takvim",
      });
    } else {
      updateWeeklyPlan((planModal.mode as WeeklyPlan).id, data);
    }
  };

  const saveStreamerMonthlyBrandViews = (
    brandId: string,
    payload: { views: number; url: string; notes: string }
  ) => {
    const brand = brands.find((b) => b.id === brandId);
    const existing = brandViewership.find(
      (v) => v.brandId === brandId && v.month === month && v.employeeId === me.id
    );
    if (existing) {
      updateBrandViewership(existing.id, {
        ...payload,
        brandName: brand?.name ?? existing.brandName,
      });
    } else {
      addBrandViewership({
        brandName: brand?.name ?? "",
        brandId,
        month,
        employeeId: me.id,
        ...payload,
      });
    }
  };

  const exportStreamerBrandMonth = (b: Brand, kind: "pdf" | "csv") => {
    const linksForExport = myBrandLinks.filter((l) => l.brandId === b.id);
    const linkRows = linksForExport.map((l) => ({
      platform: l.platform,
      handle: l.handle || "-",
      url: l.url || "-",
      lastViews: l.lastViews != null ? fmtViews(l.lastViews) : "-",
      lastSnapshot: l.lastSnapshotDate ?? "-",
    }));
    const vrow = brandViewership.find(
      (v) => v.brandId === b.id && v.month === month && v.employeeId === me.id
    );
    const linkSum = linkViewsByBrandForMonth.get(b.id) ?? 0;
    const monthlyRows: BrandMonthPdfInput["monthlyRows"] = [];
    if (vrow) {
      monthlyRows.push({
        kaynak: `Yayinci: ${me.name}`,
        izlenme: fmtViews(vrow.views),
        url: vrow.url || "-",
        not: vrow.notes || "-",
      });
    } else if (linkSum > 0) {
      monthlyRows.push({
        kaynak: "Marka linkleri toplami (hesaplanan)",
        izlenme: fmtViews(linkSum),
        url: "-",
        not: "-",
      });
    }
    const reels = myReels
      .filter((r) => r.brandId === b.id && weekOverlapsMonth(r.weekStart, month))
      .map((r) => ({
        hafta: weekRangeLabel(r.weekStart),
        platform: r.platform,
        link: r.contentUrl,
        not: r.notes || "-",
      }));
    const payload: BrandMonthPdfInput = {
      brandFullName: b.name,
      monthYm: month,
      monthTitle: monthLabel(month),
      links: linkRows,
      monthlyRows,
      reels,
    };
    if (kind === "pdf") downloadBrandMonthPdf(payload, b.shortName);
    else downloadBrandMonthCsv(payload, b.shortName);
  };

  // ── Ay navigasyonu ──
  const navMonth = (dir: 1 | -1) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(toYearMonthLocal(d));
  };

  return (
    <div className="w-full min-w-0 max-w-[1400px] mx-auto pb-8 pt-1">
      {/* Header (kompakt) */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center font-bold text-lg">
            {me.avatar || me.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">{me.name}</h1>
            <p className="text-sm text-muted-foreground">{me.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpenseModal("new")} className="gap-1.5">
            <Plus size={14} /> Harcama Gönder
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPlanModal({ mode: "new", weekStart: thisWeek })} className="gap-1.5">
            <Plus size={14} /> Plan Ekle
          </Button>
        </div>
      </div>

      {/* Top KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-blue-50/10 dark:border-blue-500/40 dark:from-blue-950/55 dark:to-blue-950/20 gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-blue-800/80 dark:text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
              <Wallet size={12} /> Bu Ay Net Maaş
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">{active ? fmt(net) : "—"}</p>
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/90 mt-1">
              {active ? (
                <>
                  Temel {fmt(baseSalary)}
                  {rent > 0 && <> · Kira +{fmt(rent)}</>}
                </>
              ) : "—"}
            </p>
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/90 mt-0.5">
              {paid ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 size={10} /> Maaş ödemesi işaretlendi</span>
              ) : active ? "Maaş ödemesi bekliyor" : "Bordro aktif değil"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <TrendingDown size={12} /> Açık Avans
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${openAdvNow > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400"}`}>
              {fmt(openAdvNow)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {repaidTotal > 0 ? `Ödenen: ${fmt(repaidTotal)}` : "Borç yok"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clapperboard size={12} /> Bu Hafta Harcama
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums">{fmt(myThisWeekTotal)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{myThisWeek.length} kalem</p>
          </CardContent>
        </Card>
        <Card className={`gap-2 py-5 ${myPending.length > 0 ? "border-amber-200 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30" : ""}`}>
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle size={12} /> Bekleyen Onay
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${myPending.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400"}`}>
              {myPending.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {myPending.length > 0 ? `${fmt(myPending.reduce((s, e) => s + e.amountUsd, 0))} tutarında` : "Tüm gönderiler onaylı"}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5 border-emerald-200/70 bg-emerald-50/25 dark:border-emerald-500/40 dark:bg-emerald-950/35">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt size={12} /> Bu Ay Ödenen Toplam
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">{fmt(myMonthPaidOut)}</p>
            <p className="text-[11px] text-muted-foreground mt-1" title="Net maaş + onaylı içerik harcaması">
              Plan: {fmt(myMonthPlanOut)}
              {myMonthContentAprv > 0 && <> · İçerik {fmt(myMonthContentAprv)}</>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ay seçici — Maaş / Harcamalar / Geçmiş için (KPI ile uyumlu) */}
      {(section === "maas" || section === "harcamalar" || section === "gecmis" || section === "izlenmeler" || section === "marka-linkleri") && (
        <div className="-mx-3 sm:-mx-6 md:-mx-8 lg:-mx-10 px-3 sm:px-6 md:px-8 lg:px-10 py-2.5 mb-4 flex items-center justify-end gap-2 bg-background/95 border-b border-border/60">
          <Button variant="ghost" size="sm" onClick={() => navMonth(-1)} className="h-8 w-8 p-0" title="Önceki ay" type="button">
            <ChevronLeft size={14} />
          </Button>
          <div className="px-2.5 py-1 rounded-md bg-card border border-border text-xs font-medium min-w-[120px] text-center capitalize">
            {monthLabel(month)}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navMonth(1)} className="h-8 w-8 p-0" title="Sonraki ay" type="button">
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {section === "maas" && (
          <Card>
            <CardHeader>
              <CardTitle>{monthLabel(month)} Maaş Detayı</CardTitle>
              <CardDescription>
                {paid ? (
                  <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                    <CheckCircle2 size={12} /> Bu ay ödendi
                    {paymentStatuses.find(p => p.employeeId === me.id && p.month === month)?.paidDate && (
                      <span> · {paymentStatuses.find(p => p.employeeId === me.id && p.month === month)?.paidDate}</span>
                    )}
                  </span>
                ) : active ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertCircle size={12} /> Ödeme bekliyor · {payrollDueShort(month, me.paymentDay)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Bordro {monthLabel(me.payrollStartMonth)} itibariyle başlar</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Row label="Temel maaş" value={fmt(baseSalary)} positive />
                {rent > 0  && <Row label="Kira Desteği" value={`+ ${fmt(rent)}`} positive sub={`${monthLabel(month)} kira ödemesi`} />}
                {bonus > 0 && <Row label="Prim / Bonus" value={`+ ${fmt(bonus)}`} positive />}
                {exp > 0   && <Row label="Ekstra Ödeme" value={`+ ${fmt(exp)}`} positive />}
                {ded > 0   && <Row label="Avans Kesintisi" value={`− ${fmt(ded)}`} negative sub="Açık avans geri ödemesi" />}
                {advTaken > 0 && <Row label="Bu Ay Alınan Avans" value={`− ${fmt(advTaken)}`} negative />}
                <Separator className="my-2" />
                <Row label="Net ödenecek (maaş)" value={fmt(net)} bold />
                {(myMonthContentAprv > 0 || myMonthPaidOut > net) && (
                  <div className="pt-2 mt-1 border-t border-border/50 space-y-1 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Onaylı içerik (bu ay)</span>
                      <span className="tabular-nums font-medium text-violet-700 dark:text-violet-300">{myMonthContentAprv > 0 ? fmt(myMonthContentAprv) : "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Plan toplamı</span>
                      <span className="tabular-nums font-semibold">{fmt(myMonthPlanOut)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Ödenen toplam</span>
                      <span className="tabular-nums font-bold text-green-700 dark:text-green-400">{fmt(myMonthPaidOut)}</span>
                    </div>
                  </div>
                )}
              </div>

              {(openAdvNow > 0 || repaidTotal > 0) && (
                <div className="mt-5 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/30">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Avans Durumu
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
                    Açılış bakiyesi: <span className="font-semibold tabular-nums">{fmt(me.initialAdvance)}</span> ·
                    {" "}Şimdiye kadar ödenen: <span className="font-semibold tabular-nums">{fmt(repaidTotal)}</span> ·
                    {" "}Kalan: <span className="font-bold tabular-nums">{fmt(openAdvNow)}</span>
                  </p>
                </div>
              )}

              {/* Cüzdan — inline edit */}
              <div className="mt-3 px-4 py-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Hash size={11} /> Maaş için kayıtlı cüzdan adresi
                  </p>
                  {walletEdit === null && (
                    <button onClick={() => setWalletEdit(me.walletAddress ?? "")}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1">
                      <Pencil size={9} /> Düzenle
                    </button>
                  )}
                </div>
                {walletEdit !== null ? (
                  <div className="flex gap-2">
                    <Input value={walletEdit} onChange={e => setWalletEdit(e.target.value)}
                      placeholder="0x... veya TRC20/ERC20"
                      className="font-mono text-xs flex-1" autoFocus />
                    <Button size="sm" onClick={() => {
                      updateEmployee(me.id, { walletAddress: walletEdit });
                      setWalletEdit(null);
                    }} className="gap-1 h-8 px-2">
                      <Check size={12} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setWalletEdit(null)} className="gap-1 h-8 px-2">
                      <CloseIcon size={12} />
                    </Button>
                  </div>
                ) : me.walletAddress ? (
                  <p className="text-xs font-mono break-all text-foreground">{me.walletAddress}</p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300 italic">
                    Henüz cüzdan adresi girilmedi. Maaş ödemesi için ekleyin.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
      )}

      {section === "harcamalar" && (
        <div className="w-full min-w-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Harcama Raporlarım</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Haftalık gruplar halinde · yönetici onayından sonra ödeme
              </p>
            </div>
            <Button size="sm" onClick={() => setExpenseModal("new")} className="gap-1.5 shrink-0 w-full sm:w-auto" type="button">
              <Plus size={14} /> Harcama Gönder
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Sol: özet */}
            <div className="xl:col-span-4 space-y-3 xl:sticky xl:top-[4.5rem] self-start w-full min-w-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Bu hafta</CardTitle>
                  <CardDescription>{weekRangeLabel(thisWeek)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{fmt(myThisWeekTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{myThisWeek.length} kalem</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{monthLabel(month)} içi</CardTitle>
                  <CardDescription>Seçili ay (üst çubuk)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold tabular-nums">{fmt(myMonthTotal)}</p>
                </CardContent>
              </Card>
              <Card className={myPending.length ? "border-amber-200 bg-amber-50/20 dark:border-amber-500/40 dark:bg-amber-950/25" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Onay bekleyen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold tabular-nums text-amber-800 dark:text-amber-200">{myPending.length}</p>
                  <p className="text-xs text-muted-foreground">
                    {myPending.length ? fmt(myPending.reduce((s, e) => s + e.amountUsd, 0)) : "Hepsi onaylı"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sağ: haftalık listeler */}
            <div className="xl:col-span-8 w-full min-w-0 space-y-8">
              {myExpenses.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <Receipt className="mx-auto text-muted-foreground/30 mb-2" size={28} />
                    <p className="text-sm text-muted-foreground">Henüz harcama göndermedin.</p>
                    <Button size="sm" className="mt-4 gap-1.5" onClick={() => setExpenseModal("new")} type="button">
                      <Plus size={14} /> İlk harcamayı ekle
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                expensesByWeek.map(([wk, items]) => {
                  // Geri çekilen / reddedilen kalemler haftalık toplamı bozmasın.
                  const activeItems = items.filter(isActiveContentExpense);
                  const total = activeItems.reduce((s, e) => s + e.amountUsd, 0);
                  return (
                    <div key={wk} className="space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {weekRangeLabel(wk)}
                        </p>
                        <p className="text-sm font-bold tabular-nums">{fmt(total)} · {activeItems.length} aktif kalem</p>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {items.map(e => (
                          <ExpenseRow
                            key={e.id}
                            expense={e}
                            onEdit={() => setExpenseModal(e)}
                            onWithdraw={canStreamerWithdrawExpense(e) ? () => handleExpenseWithdraw(e) : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {section === "takvim" && (
          <div className="space-y-4 w-full min-w-0">
            <PlanGrid
              weekStart={thisWeek}
              label="Bu Hafta"
              plans={myPlansThisWeek}
              onAdd={() => setPlanModal({ mode: "new", weekStart: thisWeek })}
              onEdit={(p) => setPlanModal({ mode: p, weekStart: thisWeek })}
            />
            <PlanGrid
              weekStart={nextWeek}
              label="Gelecek Hafta"
              plans={myPlansNextWeek}
              onAdd={() => setPlanModal({ mode: "new", weekStart: nextWeek })}
              onEdit={(p) => setPlanModal({ mode: p, weekStart: nextWeek })}
            />

            {/* Recurring template — read-only */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock size={14} className="text-muted-foreground" />
                  Sürekli Haftalık Şablon
                </CardTitle>
                <CardDescription>Yöneticinin atadığı tekrarlayan slotlar (değişiklik için iletişime geç)</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduleSlots.filter(s => s.employeeId === me.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Şablon atanmamış.</p>
                ) : (
                  <>
                    <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 snap-x snap-mandatory touch-pan-x -mx-1 px-1">
                      {WEEKDAYS_LONG.map((day, idx) => {
                        const dayIdx = idx + 1;
                        const slots = scheduleSlots
                          .filter(s => s.employeeId === me.id && s.dayOfWeek === dayIdx)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));
                        return (
                          <div key={day} className="min-w-[9rem] max-w-[10rem] flex-none snap-start border border-border rounded-lg p-2 min-h-[88px]">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">{day.slice(0, 3)}</p>
                            {slots.length === 0 ? <p className="text-[10px] text-muted-foreground/40">—</p> :
                              slots.map(s => (
                                <div key={s.id} className="text-[10px] mb-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border">
                                  <p className="font-mono">{s.startTime}–{s.endTime}</p>
                                  <p className="truncate">{s.platform}</p>
                                </div>
                              ))
                            }
                          </div>
                        );
                      })}
                    </div>
                    <div className="hidden lg:grid lg:grid-cols-7 gap-2 w-full min-w-0">
                      {WEEKDAYS_LONG.map((day, idx) => {
                        const dayIdx = idx + 1;
                        const slots = scheduleSlots
                          .filter(s => s.employeeId === me.id && s.dayOfWeek === dayIdx)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));
                        return (
                          <div key={day} className="border border-border rounded-lg p-2 min-h-[80px] min-w-0">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">{day.slice(0, 3)}</p>
                            {slots.length === 0 ? <p className="text-[10px] text-muted-foreground/40">—</p> :
                              slots.map(s => (
                                <div key={s.id} className="text-[10px] mb-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border">
                                  <p className="font-mono">{s.startTime}–{s.endTime}</p>
                                  <p className="truncate">{s.platform}</p>
                                </div>
                              ))
                            }
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
            </CardContent>
          </Card>
          </div>
      )}

      {section === "izlenmeler" && (
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Eye size={18} className="text-violet-600" />
                İzlenmeler & haftalık reel akışı
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Üstteki ay ile <strong>aktif markalar</strong> için toplam izlenmelerini güncelle.
                Aşağıda her hafta hangi marka içeriğini hangi URL&apos;de yayınladığını kaydet; istersen{" "}
                <Link href="/yayinci/marka-linkleri" className="text-primary underline-offset-2 hover:underline">
                  marka linklerinden
                </Link>{" "}
                seçerek doldur.
              </p>
            </div>
            <Link
              href="/yayinci/marka-linkleri"
              className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Marka linklerini yönet
            </Link>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">{monthLabel(month)} · marka toplamları</h3>
            {activeBrands.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktif marka yok.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
                {activeBrands.map((brand) => (
                  <BrandMonthViewsCard
                    key={brand.id}
                    brand={brand}
                    month={month}
                    existing={brandViewership.find(
                      (v) => v.brandId === brand.id && v.month === month && v.employeeId === me.id
                    )}
                    linkViewsSum={linkViewsByBrandForMonth.get(brand.id) ?? 0}
                    onSave={(payload) => saveStreamerMonthlyBrandViews(brand.id, payload)}
                    onExport={(kind) => exportStreamerBrandMonth(brand, kind)}
                  />
                ))}
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video size={15} className="text-violet-600" />
                Haftalık yayınlanan içerikler
              </CardTitle>
              <CardDescription>
                Reel veya post linkini ekle. Yönetici özeti <Link href="/izlenme" className="text-primary underline-offset-2 hover:underline">Marka İzlenme</Link> sayfasında.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeBrands.length > 0 && (
                <AddWeekReelForm
                  employeeId={me.id}
                  defaultWeekStart={thisWeek}
                  thisWeek={thisWeek}
                  nextWeek={nextWeek}
                  brands={activeBrands}
                  myBrandLinks={myBrandLinks}
                  onAdd={(r) => {
                    addWeekBrandReel(r);
                    pushNotification({
                      type: "general",
                      title: `${me.name} haftalık reel kaydı ekledi`,
                      message: `${brands.find((b) => b.id === r.brandId)?.shortName ?? ""} · ${weekRangeLabel(r.weekStart)}`,
                      forRole: "admin",
                      triggeredBy: user.id,
                      href: "/izlenme",
                    });
                  }}
                />
              )}

              {reelsByWeek.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Henüz haftalık reel kaydı yok.</p>
              ) : (
                <div className="space-y-6">
                  {reelsByWeek.map(([wk, items]) => (
                    <div key={wk}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2 mb-3">
                        {weekRangeLabel(wk)} · {items.length} kayıt
                      </p>
                      <div className="space-y-2">
                        {items.map((r) => {
                          const b = brands.find((x) => x.id === r.brandId);
                          return (
                            <div
                              key={r.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{b?.shortName ?? "—"}</p>
                                <p className="text-[11px] text-muted-foreground">{r.platform}</p>
                                <a
                                  href={r.contentUrl}
                                  target="_blank"
                                  rel="noopener"
                                  className="text-[11px] text-blue-600 break-all inline-flex items-center gap-1 mt-1"
                                >
                                  {r.contentUrl} <ExternalLink size={10} />
                                </a>
                                {r.notes ? <p className="text-[11px] text-muted-foreground mt-1">{r.notes}</p> : null}
                              </div>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-lg p-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 shrink-0 self-end sm:self-center"
                                title="Sil"
                                onClick={() => {
                                  if (confirm("Bu kaydı silmek istiyor musun?")) deleteWeekBrandReel(r.id);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {section === "hesaplar" && (
        <div className="w-full min-w-0 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 w-full min-w-0 items-start">
            <div className="xl:col-span-2 min-w-0">
            {/* Yayın Hesapları */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <Link2 size={14} className="text-blue-600 dark:text-blue-400" />
                    Yayın Hesaplarım
                  </CardTitle>
                  <CardDescription>{myAccounts.length} platform hesabı · linkleri güncelle</CardDescription>
                </div>
                <Button size="sm" onClick={() => setAccountModal("new")} className="gap-1.5">
                  <Plus size={13} /> Yeni Hesap
                </Button>
              </CardHeader>
              <CardContent>
                {myAccounts.length === 0 ? (
                  <div className="text-center py-6 px-4 border border-dashed border-border rounded-lg">
                    <Link2 size={20} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Henüz hesap eklenmedi.</p>
                    <Button size="sm" variant="outline" onClick={() => setAccountModal("new")} className="gap-1.5 mt-3">
                      <Plus size={12} /> İlk Hesabını Ekle
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {accountsByPlatform.map(([platform, accs]) => {
                      const HeaderIcon = platformIcon(platform);
                      return (
                        <div key={platform} className="rounded-xl border border-border bg-card overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border-b border-border">
                            <HeaderIcon size={16} className="text-muted-foreground shrink-0" />
                            <span className="text-sm font-semibold">{platform}</span>
                            <Badge variant="secondary" className="text-[10px] ml-auto">{accs.length} hesap</Badge>
                          </div>
                          <div className="p-3 space-y-2">
                            {accs.map(a => {
                              const Icon  = platformIcon(a.platform);
                              const fav   = faviconFor(a.url);
                              return (
                        <div key={a.id}
                          className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                            a.status === "active" ? "border-border hover:border-blue-300 bg-background" : "border-border bg-muted/30 opacity-70"
                          }`}>
                          {fav ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fav} alt="" loading="lazy" className="w-8 h-8 rounded-md border border-border bg-white object-contain p-1 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                              <Icon size={14} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium">{a.handle}</p>
                              {a.status === "inactive" && (
                                <Badge variant="outline" className="text-[9px] text-muted-foreground">pasif</Badge>
                              )}
                            </div>
                            {a.url && (
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate font-mono">{urlHostname(a.url)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {a.url && (
                              <a href={a.url} target="_blank" rel="noopener"
                                title="Linki aç"
                                className="p-1.5 rounded hover:bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                <ExternalLink size={12} />
                              </a>
                            )}
                            <button type="button" onClick={() => setAccountModal(a)}
                              title="Düzenle"
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                              <Pencil size={12} />
                            </button>
                            <button type="button" onClick={() => {
                              if (confirm(`${a.platform} hesabını silmek istiyor musun?`)) deleteStreamerAccount(a.id);
                            }}
                              title="Sil"
                              className="p-1.5 rounded hover:bg-red-500/15 text-red-600 dark:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>


            </div>

            <div className="space-y-3 min-w-0">
              <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-500/40 dark:bg-violet-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Eye size={14} className="text-violet-700 dark:text-violet-300" />
                    İzlenmeler
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Aylık marka toplamları ve haftalık reel linkleri
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href="/yayinci/izlenmeler"
                    className="text-sm font-medium text-violet-800 dark:text-violet-200 hover:underline inline-flex items-center gap-1"
                  >
                    İzlenmeler sayfasına git <ExternalLink size={12} />
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Activity size={14} className="text-purple-600 dark:text-purple-400" />
                    Marka linkleri
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Anlaşmalı marka hesapları — tüm platform linkleri
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href="/yayinci/marka-linkleri"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Marka linklerini yönet <ExternalLink size={12} />
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      )}

      {section === "marka-linkleri" && (
        <div className="w-full min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Marka linkleri</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Üstteki <strong>ay seçici</strong> maaş ve izlenmelerle ortaktır: aynı link için hangi ayın snapshot’ına baktığınızı seçin.
                İzlenmeler sayfasındaki marka toplamları bu aydaki link verileriyle uyumludur.
              </p>
            </div>
            <Button
              size="sm"
              type="button"
              onClick={() => setLinkModal("new")}
              className="gap-1.5 shrink-0"
              disabled={brands.length === 0}
            >
              <Plus size={13} /> Yeni Link
            </Button>
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Activity size={14} className="text-purple-600 dark:text-purple-400" />
                  Platformlara göre linkler
                </CardTitle>
                <CardDescription>
                  {monthLabel(month)} · {myBrandLinks.length} link · gösterilen izlenme bu aydaki son snapshot (yoksa bu ay + güncel değer)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {myBrandLinks.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-border rounded-lg">
                  <Activity size={22} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Henüz marka linki yok.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {brands.length === 0
                      ? "Önce yönetici marka tanımlamalı."
                      : "Yeni link ekleyerek başla."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {brandLinksByPlatform.map(([platform, links]) => {
                    const PlIcon = platformIcon(platform);
                    return (
                      <div key={platform} className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50/80 dark:bg-purple-950/40 border-b border-border">
                          <PlIcon size={16} className="text-purple-700 dark:text-purple-300 shrink-0" />
                          <span className="text-sm font-semibold">{platform}</span>
                          <Badge variant="secondary" className="text-[10px] ml-auto">{links.length} link</Badge>
                        </div>
                        <div className="p-3 space-y-2">
                          {links.map((link) => {
                            const Icon = platformIcon(link.platform);
                            const brand = brands.find((b) => b.id === link.brandId);
                            const fav = faviconFor(link.url);
                            const { displayViews, snapDate, snapsInMonth, delta } = linkMonthViewsMeta(
                              link,
                              month,
                              linkSnapshots,
                              todayYm
                            );
                            return (
                              <div
                                key={link.id}
                                className="group flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-background hover:border-purple-200 dark:hover:border-purple-500/50 transition-colors"
                              >
                                <div className="flex shrink-0 items-start gap-1.5 mt-0.5">
                                  <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-500/45 dark:bg-purple-950/50 dark:text-purple-100"
                                    title={link.platform}
                                  >
                                    <Icon size={18} />
                                  </div>
                                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                                    {fav ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={fav} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-muted/30">
                                        <Globe size={14} className="text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-medium">{brand?.shortName ?? "—"}</p>
                                    {link.status === "inactive" && (
                                      <Badge variant="outline" className="text-[9px] text-muted-foreground">pasif</Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">{link.handle || "(handle yok)"}</p>
                                  {link.url && (
                                    <p className="text-[10px] text-blue-600 truncate font-mono">{urlHostname(link.url)}</p>
                                  )}
                                  {snapDate && (
                                    <p className="text-[9px] text-muted-foreground mt-0.5">
                                      Bu ay kayıt: {snapDate}
                                      {snapsInMonth.length > 1 ? ` · ${snapsInMonth.length} snapshot` : ""}
                                    </p>
                                  )}
                                  {!snapDate && month === todayYm && link.lastSnapshotDate && (
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Canlı: {link.lastSnapshotDate}</p>
                                  )}
                                  {!snapDate && month !== todayYm && (
                                    <p className="text-[9px] text-amber-700/90 dark:text-amber-300/90 mt-0.5">Bu ay için snapshot yok</p>
                                  )}
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                                  <p className="text-sm font-bold tabular-nums leading-tight">
                                    {displayViews != null ? fmtViews(displayViews) : "—"}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground inline-flex items-center gap-0.5">
                                    <Eye size={9} />
                                    {snapsInMonth.length} bu ay
                                  </p>
                                  {delta !== 0 && displayViews != null && (
                                    <p className={`text-[9px] inline-flex items-center gap-0.5 ${delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      <TrendingUp size={8} className={delta < 0 ? "rotate-180" : ""} />
                                      {Math.abs(delta).toLocaleString("tr-TR")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => setSnapshotModal(link)}
                                    title="Snapshot ekle (izlenme güncelle)"
                                    className="p-1.5 rounded hover:bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  {link.url && (
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener"
                                      title="Linki aç"
                                      className="p-1.5 rounded hover:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setLinkModal(link)}
                                    title="Düzenle"
                                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`${brand?.shortName ?? "Link"} silinsin mi?`)) deleteBrandLink(link.id);
                                    }}
                                    title="Sil"
                                    className="p-1.5 rounded hover:bg-red-500/15 text-red-600 dark:text-red-400"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-500/40 dark:bg-blue-950/35">
            <CardContent className="flex items-start gap-3 py-4">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Eye size={15} />
              </div>
              <div className="flex-1 text-xs text-blue-900 dark:text-blue-100 leading-relaxed min-w-0">
                <p className="font-semibold mb-1">İzlenme toplamları</p>
                <p>
                  Her marka için <strong>aylık toplam izlenme</strong> girişini{" "}
                  <Link href="/yayinci/izlenmeler" className="font-medium underline-offset-2 hover:underline">
                    /yayinci/izlenmeler
                  </Link>{" "}
                  üzerinden yap. Bu sayfa çoğalan link detayları ve snapshot için.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {section === "gecmis" && (
          <Card>
            <CardHeader>
              <CardTitle>Geçmiş Aylar Özeti</CardTitle>
              <CardDescription>Tüm aylardaki temel maaş, kira, net, içerik ve ödeme özeti</CardDescription>
            </CardHeader>
            <CardContent>
              {myHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-3">Geçmiş kayıt yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Ay", "Temel", "Kira", "Net maaş", "İçerik (onay)", "Plan", "Ödenen", "Açık avans", "Maaş"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myHistory.map(h => (
                        <tr key={h.month} className="border-b border-border/60 hover:bg-accent/20">
                          <td className="px-3 py-2.5 capitalize">{monthLabel(h.month)}</td>
                          <td className="px-3 py-2.5 tabular-nums">{h.baseSalary > 0 ? fmt(h.baseSalary) : "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums text-blue-700 dark:text-blue-300">{h.rentMonth > 0 ? fmt(h.rentMonth) : "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums font-medium">{fmt(h.net)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-violet-700 dark:text-violet-300">{h.contentAprv > 0 ? fmt(h.contentAprv) : "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums font-medium">{h.planned > 0 ? fmt(h.planned) : "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums font-semibold text-green-700 dark:text-green-400">{h.paidOut > 0 ? fmt(h.paidOut) : "—"}</td>
                          <td className="px-3 py-2.5 tabular-nums text-amber-700 dark:text-amber-300">{h.openAdv > 0 ? fmt(h.openAdv) : "—"}</td>
                          <td className="px-3 py-2.5">
                            {h.paid ? (
                              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40 gap-1 text-[10px]">
                                <CheckCircle2 size={9} /> Ödendi
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40 gap-1 text-[10px]">
                                <History size={9} /> Bekliyor
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
      )}
      <Modal open={expenseModal !== null} onClose={() => setExpenseModal(null)}
        title={expenseModal === "new" ? "Yeni Harcama Gönder" : "Harcamayı Düzenle"} size="lg">
        {expenseModal && (
          <ExpenseSubmitForm
            employeeId={me.id}
            userId={user.id}
            initial={expenseModal === "new" ? undefined : expenseModal}
            onSave={handleExpenseSave}
            onDelete={
              expenseModal !== "new" && canStreamerWithdrawExpense(expenseModal as ContentExpense)
                ? () => handleExpenseWithdraw(expenseModal as ContentExpense)
                : undefined
            }
            onClose={() => setExpenseModal(null)}
          />
        )}
      </Modal>

      <Modal open={planModal !== null} onClose={() => setPlanModal(null)}
        title={planModal?.mode === "new" ? "Yeni Plan Ekle" : "Plan Düzenle"} size="lg">
        {planModal && (
          <WeeklyPlanForm
            employeeId={me.id}
            userId={user.id}
            weekStart={planModal.weekStart}
            initial={planModal.mode === "new" ? undefined : planModal.mode}
            onSave={handlePlanSave}
            onDelete={planModal.mode !== "new"
              ? () => { deleteWeeklyPlan((planModal.mode as WeeklyPlan).id); setPlanModal(null); }
              : undefined}
            onClose={() => setPlanModal(null)}
          />
        )}
      </Modal>

      {/* Streamer account modal */}
      <Modal open={accountModal !== null} onClose={() => setAccountModal(null)}
        title={accountModal === "new" ? "Yeni Yayın Hesabı" : "Hesabı Düzenle"} size="lg">
        {accountModal && (
          <AccountForm
            employeeId={me.id}
            initial={accountModal === "new" ? undefined : accountModal}
            onSave={(d) => {
              if (accountModal === "new") addStreamerAccount(d);
              else updateStreamerAccount(accountModal.id, d);
            }}
            onDelete={accountModal !== "new"
              ? () => { deleteStreamerAccount((accountModal as StreamerAccount).id); setAccountModal(null); }
              : undefined}
            onClose={() => setAccountModal(null)}
          />
        )}
      </Modal>

      {/* Brand link modal */}
      <Modal open={linkModal !== null} onClose={() => setLinkModal(null)}
        title={linkModal === "new" ? "Yeni Marka Linki" : "Linki Düzenle"} size="lg">
        {linkModal && (
          <BrandLinkForm
            ownerId={me.id}
            brands={brands}
            initial={linkModal === "new" ? undefined : linkModal}
            onSave={(d) => {
              if (linkModal === "new") {
                addBrandLink(d);
                pushNotification({
                  type: "general",
                  title: `${me.name} yeni marka linki ekledi`,
                  message: `${brands.find(b => b.id === d.brandId)?.shortName ?? ""} · ${d.platform} · ${d.handle}`,
                  forRole: "admin",
                  triggeredBy: user.id,
                  href: "/izlenme",
                });
              } else {
                updateBrandLink(linkModal.id, d);
              }
            }}
            onDelete={linkModal !== "new"
              ? () => { deleteBrandLink((linkModal as BrandLink).id); setLinkModal(null); }
              : undefined}
            onClose={() => setLinkModal(null)}
          />
        )}
      </Modal>

      {/* Snapshot modal */}
      <Modal open={snapshotModal !== null} onClose={() => setSnapshotModal(null)}
        title="İzlenme Snapshot'ı Ekle" size="md">
        {snapshotModal && (
          <SnapshotForm
            key={`${snapshotModal.id}-${month}`}
            link={snapshotModal}
            listMonthLabel={monthLabel(month)}
            defaultSnapshotDate={defaultSnapshotDateInMonth(month)}
            suggestedBaselineViews={
              linkMonthViewsMeta(snapshotModal, month, linkSnapshots, todayYm).displayViews
            }
            onSave={(d) => {
              addLinkSnapshot(d);
              updateBrandLink(snapshotModal.id, { lastViews: d.views, lastSnapshotDate: d.date });
              pushNotification({
                type: "general",
                title: `${me.name} izlenme güncelledi`,
                message: `${brands.find(b => b.id === snapshotModal.brandId)?.shortName ?? ""} · ${snapshotModal.platform} · ${d.views.toLocaleString("tr-TR")} izlenme`,
                forRole: "admin",
                triggeredBy: user.id,
                href: "/izlenme",
              });
              pushNotification({
                type: "general",
                title: `İzlenme snapshot: ${me.name}`,
                message: `${brands.find(b => b.id === snapshotModal.brandId)?.shortName ?? ""} · ${snapshotModal.platform} · ${d.views.toLocaleString("tr-TR")} (${d.date})`,
                forRole: "auditor",
                triggeredBy: user.id,
                href: "/izlenme",
              });
            }}
            onClose={() => setSnapshotModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Expense Row ──────────────────────────────────────────────────────────
function ExpenseRow({
  expense: e,
  onEdit,
  onWithdraw,
}: {
  expense: ContentExpense;
  onEdit: () => void;
  onWithdraw?: () => void;
}) {
  const status = e.reviewStatus ?? (e.paid ? "approved" : "pending");
  const statusBadge =
    status === "approved" ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40 gap-1 text-[10px]"><CheckCircle2 size={9} /> Onaylı</Badge> :
    status === "rejected" ? <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40 gap-1 text-[10px]"><Trash2 size={9} /> Reddedildi</Badge> :
    status === "cancelled" ? <Badge variant="outline" className="text-muted-foreground border-border bg-muted/50 gap-1 text-[10px]"><CloseIcon size={9} /> Geri çekildi</Badge> :
    status === "needs_info" ? <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 dark:text-orange-300 dark:border-orange-500/45 dark:bg-orange-950/40 gap-1 text-[10px]"><AlertCircle size={9} /> Bilgi İsteniyor</Badge> :
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40 gap-1 text-[10px]"><Clock size={9} /> İncelemede</Badge>;

  return (
    <div className="flex items-start gap-2">
      <button type="button" onClick={onEdit} className="flex-1 text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-accent/20 transition-colors">
      {e.screenshotUrl && /^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(e.screenshotUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.screenshotUrl} alt="" className="w-12 h-12 rounded-md object-cover border border-border" />
      ) : (
        <div className="w-12 h-12 rounded-md bg-muted/40 flex items-center justify-center border border-border shrink-0">
          <Receipt size={16} className="text-muted-foreground/60" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge variant="outline" className="text-[10px]">{e.brandName}</Badge>
          <span className="text-[11px] text-muted-foreground">{e.category} · {e.date}</span>
          {statusBadge}
        </div>
        <p className="text-sm text-foreground line-clamp-2">{e.description}</p>
        {e.reviewerNote && (
          <p className="text-[11px] text-muted-foreground italic mt-0.5">Yönetici notu: {e.reviewerNote}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold tabular-nums">{fmt(e.amountUsd)}</p>
        {e.amountThb && <p className="text-[10px] text-muted-foreground">{e.amountThb.toLocaleString("tr-TR")} ฿</p>}
      </div>
      <Pencil size={11} className="text-muted-foreground/30 shrink-0 mt-1" />
      </button>
      {onWithdraw && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 text-xs h-8 border-red-300 text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:border-red-500/40"
          onClick={(ev) => { ev.stopPropagation(); onWithdraw(); }}
        >
          Geri çek
        </Button>
      )}
    </div>
  );
}

// ── Row helper ───────────────────────────────────────────────────────────
function Row({ label, value, bold, positive, negative, sub }: {
  label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <p className={`text-sm ${bold ? "font-bold text-foreground" : "text-foreground/80"}`}>{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <p className={`text-sm tabular-nums ${
        bold ? "font-bold text-foreground" :
        positive ? "text-foreground/90 font-medium" :
        negative ? "text-red-600 font-medium" :
        "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}
