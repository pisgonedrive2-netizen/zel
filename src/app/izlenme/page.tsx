"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, ExternalLink, Eye, TrendingUp, TrendingDown, RefreshCw,
  Instagram, Youtube, Globe, MessageCircle, Send, Twitch, Music2,
  ChevronDown, ChevronRight, Target, History, ChevronLeft, Link2,
  LogIn,
} from "lucide-react";
import {
  useStore, SOCIAL_PLATFORMS,
  type Brand, type BrandLink, type LinkSnapshot, type Employee,
} from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { findBrandMonthlyStats, fmtBrandMoney, fmtBrandCount } from "@/lib/brand-monthly-stats";
import { shiftCalendarMonthYm, toYearMonthLocal, defaultSnapshotDateInMonth } from "@/lib/data";
import {
  brandContentExpensesForMonth,
  linkViewsForMonth,
  totalContentExpensesForMonth,
  totalLinkViewsForMonth,
} from "@/lib/brand-month-metrics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { BrandLinksPanel } from "@/components/brand-links-panel";
import { AutoRefreshStatusPanel } from "@/components/auto-refresh-status-panel";
import { BrandMonthlyStatsPanel } from "@/components/brand-monthly-stats-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

// ── helpers ───────────────────────────────────────────────────────────────
const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};
function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("youtube"))   return Youtube;
  if (p.includes("twitch"))    return Twitch;
  if (p.includes("instagram")) return Instagram;
  if (p.includes("tiktok"))    return Music2;
  if (p.includes("telegram"))  return Send;
  if (p.includes("kick"))      return Globe;
  if (p.includes("twitter") || p.includes("x"))   return MessageCircle;
  return Globe;
}
function faviconFor(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return null;
  }
}
function daysAgo(iso?: string) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const d  = Math.floor(ms / 86_400_000);
  if (d === 0) return "bugün";
  if (d === 1) return "dün";
  if (d < 30)  return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function monthTitleYm(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

// ── Brand Form ────────────────────────────────────────────────────────────
function BrandForm({ initial, onSave, onDelete, onClose }: {
  initial?: Brand;
  onSave: (d: Omit<Brand, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Brand, "id">>({
    name:          initial?.name          ?? "",
    shortName:     initial?.shortName     ?? "",
    category:      initial?.category      ?? "Bahis",
    status:        initial?.status        ?? "active",
    notes:         initial?.notes         ?? "",
    monthlyTarget: initial?.monthlyTarget,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Marka Adı (Tam)" required>
            <Input value={form.name} onChange={e => set("name", e.target.value)} required placeholder="Galabet" />
          </Field>
          <Field label="Kısa Ad / Etiket" required>
            <Input value={form.shortName} onChange={e => set("shortName", e.target.value)} required placeholder="Gala" />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Kategori">
            <Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Bahis, Casino..." />
          </Field>
          <Field label="Durum">
            <Select value={form.status} onChange={e => set("status", e.target.value as Brand["status"])}
              options={[{ value: "active", label: "Aktif" }, { value: "paused", label: "Duraklatıldı" }, { value: "inactive", label: "Pasif" }]} />
          </Field>
        </FormGrid>
        <Field label="Aylık İzlenme Hedefi (toplam)" hint="Tüm linklerin aylık toplam izlenme hedefi (opsiyonel)">
          <Input type="number" value={form.monthlyTarget ?? ""} onChange={e => set("monthlyTarget", e.target.value ? parseInt(e.target.value, 10) : undefined)} placeholder="500000" min={0} />
        </Field>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Anlaşma, dipnot..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Marka Ekle"} />
    </form>
  );
}

// ── Brand Link Form ──────────────────────────────────────────────────────
function LinkForm({ brands, employees, initial, defaultBrandId, onSave, onDelete, onClose }: {
  brands: Brand[];
  employees: Employee[];
  initial?: BrandLink;
  defaultBrandId?: string;
  onSave: (d: Omit<BrandLink, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<BrandLink, "id">>({
    brandId:    initial?.brandId    ?? defaultBrandId ?? brands[0]?.id ?? "",
    platform:   initial?.platform   ?? "Instagram",
    handle:     initial?.handle     ?? "",
    url:        initial?.url        ?? "",
    ownerId:    initial?.ownerId,
    status:     initial?.status     ?? "active",
    notes:      initial?.notes      ?? "",
    autoTrack:  initial?.autoTrack  ?? true,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));
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
              options={SOCIAL_PLATFORMS.map(p => ({ value: p, label: p }))} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Kullanıcı Adı / Handle">
            <Input value={form.handle} onChange={e => set("handle", e.target.value)} placeholder="@hesap" />
          </Field>
          <Field label="Yayıncı (sahip)">
            <Select value={form.ownerId ?? ""} onChange={e => set("ownerId", e.target.value || undefined)}
              options={[{ value: "", label: "— Yok —" }, ...employees.map(em => ({ value: em.id, label: em.name }))]} />
          </Field>
        </FormGrid>
        <Field label="URL" required>
          <Input value={form.url} onChange={e => set("url", e.target.value)} required type="url" placeholder="https://..." />
        </Field>
        <FormGrid>
          <Field label="Durum">
            <Select value={form.status} onChange={e => set("status", e.target.value as BrandLink["status"])}
              options={[{ value: "active", label: "Aktif" }, { value: "inactive", label: "Pasif" }]} />
          </Field>
          <Field label="Otomatik Takip" hint="Düzenli izlenme snapshot'ı alınacak">
            <Select value={form.autoTrack ? "yes" : "no"} onChange={e => set("autoTrack", e.target.value === "yes")}
              options={[{ value: "yes", label: "Açık" }, { value: "no", label: "Kapalı" }]} />
          </Field>
        </FormGrid>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="" />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Link Ekle"} />
    </form>
  );
}

// ── Snapshot Form ─────────────────────────────────────────────────────────
function SnapshotForm({ link, initial, defaultDateForNew, suggestedViewsForNew, onSave, onDelete, onClose }: {
  link: BrandLink;
  initial?: LinkSnapshot;
  /** Yeni snapshot: liste ayına uygun önerilen tarih */
  defaultDateForNew?: string;
  /** Yeni snapshot: formda başlangıç izlenmesi (seçili aydaki değer) */
  suggestedViewsForNew?: number;
  onSave: (d: Omit<LinkSnapshot, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<LinkSnapshot, "id">>({
    linkId: link.id,
    date:   initial?.date  ?? defaultDateForNew ?? new Date().toISOString().slice(0, 10),
    views:  initial?.views ?? suggestedViewsForNew ?? link.lastViews ?? 0,
    notes:  initial?.notes ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">Link</p>
          <p className="text-sm font-medium">{link.platform} · {link.handle || "(handle yok)"}</p>
          {link.url && <a href={link.url} target="_blank" rel="noopener" className="text-[11px] text-blue-600 break-all">{link.url}</a>}
        </div>
        <FormGrid>
          <Field label="Tarih" hint={!initial ? "Varsayılan: incelemekte olduğunuz ay (değiştirebilirsiniz)" : undefined} required>
            <DateTimePicker mode="date" value={form.date} onChange={(v) => set("date", v)} required />
          </Field>
          <Field label="İzlenme Sayısı" required>
            <Input type="number" value={form.views} onChange={e => set("views", parseInt(e.target.value, 10) || 0)} required min={0} />
          </Field>
        </FormGrid>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Hangi içerikten, hangi videodan..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Snapshot Kaydet"} />
    </form>
  );
}

// ── Snapshot history modal content ────────────────────────────────────────
function SnapshotHistory({ link, snapshots, onEdit, readOnly }: {
  link: BrandLink;
  snapshots: LinkSnapshot[];
  onEdit: (s: LinkSnapshot) => void;
  readOnly?: boolean;
}) {
  const data = useMemo(
    () => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  );
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">Henüz snapshot yok.</p>;
  }
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="snap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={fmtViews} />
          <RTooltip formatter={(v: number) => fmtViews(v)} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} fill="url(#snap)" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {data.slice().reverse().map(s =>
          readOnly ? (
            <div
              key={s.id}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/20 text-left"
            >
              <div>
                <p className="text-sm font-medium tabular-nums text-foreground">{fmtViews(s.views)}</p>
                {s.notes && <p className="text-[11px] text-muted-foreground">{s.notes}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{s.date}</span>
            </div>
          ) : (
            <button key={s.id} type="button" onClick={() => onEdit(s)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-accent/30 transition-colors text-left">
              <div>
                <p className="text-sm font-medium tabular-nums text-foreground">{fmtViews(s.views)}</p>
                {s.notes && <p className="text-[11px] text-muted-foreground">{s.notes}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{s.date}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Brand × yayıncı attribution kartı ─────────────────────────────────────
import type { BrandViewership, BrandMonthlyStats, ContentExpense } from "@/store/store";

function BrandAttributionCard({
  brands,
  brandViewership,
  brandMonthlyStats,
  contentExpenses,
  viewMonth,
  employees,
}: {
  brands: Brand[];
  brandViewership: BrandViewership[];
  brandMonthlyStats: BrandMonthlyStats[];
  contentExpenses: ContentExpense[];
  viewMonth: string;
  employees: Employee[];
}) {
  const rows = useMemo(() => {
    return brands
      .filter((b) => b.status !== "inactive")
      .map((b) => {
        const stats = findBrandMonthlyStats(brandMonthlyStats, b.id, viewMonth);
        const totalViews = brandViewership
          .filter((v) => v.brandId === b.id)
          .reduce((s, v) => s + v.views, 0);
        const expenseUsd = contentExpenses
          .filter(
            (e) =>
              e.month === viewMonth &&
              (e.brandId === b.id ||
                (!e.brandId && e.brandName === b.shortName)) &&
              e.reviewStatus !== "rejected" &&
              e.reviewStatus !== "cancelled"
          )
          .reduce((s, e) => s + e.amountUsd, 0);
        const employeesForBrand = new Set(
          brandViewership.filter((v) => v.brandId === b.id && v.employeeId).map((v) => v.employeeId!)
        );
        const cpr =
          stats && stats.newRegistrations > 0
            ? expenseUsd / stats.newRegistrations
            : null;
        return {
          brand: b,
          totalViews,
          expenseUsd,
          stats,
          attribEmployees: Array.from(employeesForBrand),
          cpr,
        };
      })
      .filter(
        (r) =>
          r.totalViews > 0 ||
          r.expenseUsd > 0 ||
          (r.stats &&
            (r.stats.newRegistrations > 0 || r.stats.depositAmount > 0))
      );
  }, [brands, brandViewership, brandMonthlyStats, contentExpenses, viewMonth]);

  if (rows.length === 0) return null;

  return (
    <Card className="mb-6 border-emerald-200/60 dark:border-emerald-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp size={15} className="text-emerald-700 dark:text-emerald-300" />
          Marka × yayıncı attribution
        </CardTitle>
        <CardDescription className="text-xs">
          Yayıncı izlenmeleri, içerik harcaması ve operasyon metrikleri yan yana — seçili ay:{" "}
          {monthTitleYm(viewMonth)}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Marka</th>
              <th className="pb-2 pr-3 font-medium">Yayıncılar</th>
              <th className="pb-2 pr-3 font-medium text-right">İzlenme (yayıncı)</th>
              <th className="pb-2 pr-3 font-medium text-right">Kayıt</th>
              <th className="pb-2 pr-3 font-medium text-right">FTD</th>
              <th className="pb-2 pr-3 font-medium text-right">Net yatırım</th>
              <th className="pb-2 pr-3 font-medium text-right">İçerik harc. (USD)</th>
              <th className="pb-2 pr-3 font-medium text-right" title="Cost per registration: kayıt başına içerik maliyeti">
                CPR
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cur = r.stats?.currency ?? "TRY";
              const net = r.stats
                ? Number(r.stats.depositAmount) - Number(r.stats.withdrawalAmount)
                : 0;
              return (
                <tr key={r.brand.id} className="border-b border-border/50 hover:bg-accent/20">
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {r.brand.shortName}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {r.attribEmployees.length > 0
                      ? r.attribEmployees
                          .slice(0, 3)
                          .map((eid) => employees.find((e) => e.id === eid)?.name ?? "?")
                          .join(", ") +
                        (r.attribEmployees.length > 3
                          ? ` +${r.attribEmployees.length - 3}`
                          : "")
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.totalViews > 0 ? fmtViews(r.totalViews) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.stats ? fmtBrandCount(r.stats.newRegistrations) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.stats ? fmtBrandCount(r.stats.firstTimeDepositors) : "—"}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums font-semibold ${
                      net > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : net < 0
                          ? "text-red-700 dark:text-red-300"
                          : ""
                    }`}
                  >
                    {r.stats ? fmtBrandMoney(net, cur) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                    {r.expenseUsd > 0 ? `$${r.expenseUsd.toLocaleString("tr-TR")}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.cpr != null && Number.isFinite(r.cpr)
                      ? `$${r.cpr.toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Brand card ────────────────────────────────────────────────────────────
function BrandCard({
  brand,
  viewMonth,
  todayYm,
  readOnly,
  employees,
  onEditBrand,
  onOpenLinks,
  onEnterBrandPanel,
}: {
  brand: Brand;
  viewMonth: string;
  todayYm: string;
  readOnly: boolean;
  employees: Employee[];
  onEditBrand: () => void;
  onOpenLinks: () => void;
  onEnterBrandPanel?: () => void;
}) {
  const { brandLinks, linkSnapshots, contentExpenses, updateBrand } = useStore();
  const [goalDraft, setGoalDraft] = useState("");

  const links = brandLinks.filter(l => l.brandId === brand.id);
  const totalCurrent = links.reduce(
    (s, l) => s + linkViewsForMonth(l, viewMonth, linkSnapshots, todayYm).lastViews,
    0
  );
  const monthExpenses = brandContentExpensesForMonth(contentExpenses, brand, viewMonth);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amountUsd, 0);

  const cpm = totalCurrent > 0 ? (totalExpenses / (totalCurrent / 1000)) : 0;
  const hasTarget = brand.monthlyTarget != null && brand.monthlyTarget > 0;
  const targetPct = hasTarget ? Math.min(100, (totalCurrent / brand.monthlyTarget!) * 100) : null;

  useEffect(() => {
    setGoalDraft(brand.monthlyTarget != null ? String(brand.monthlyTarget) : "");
  }, [brand.id, brand.monthlyTarget]);

  const ownerCount = new Set(links.map((l) => l.ownerId).filter(Boolean)).size;
  const previewLinks = links.slice(0, 3);
  const empName = (id?: string) =>
    id ? employees.find((e) => e.id === id)?.name ?? "—" : "Genel";

  return (
    <Card className="gap-2 py-5">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <BrandLogo brandId={brand.id} title={brand.name} size={36} className="rounded-lg" />
              {brand.name}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{brand.shortName}</Badge>
              <Badge variant="outline" className={`text-[10px] ${
                brand.status === "active" ? "text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40" :
                brand.status === "paused" ? "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40" :
                                            "text-muted-foreground border-border bg-muted/40"
              }`}>
                {brand.status === "active" ? "Aktif" : brand.status === "paused" ? "Duraklatıldı" : "Pasif"}
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-3 flex-wrap mt-0.5">
              <span className="inline-flex items-center gap-1">
                <Eye size={11} /> {fmtViews(totalCurrent)} <span className="text-muted-foreground font-normal">({monthTitleYm(viewMonth)})</span>
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span>{links.length} link{ownerCount > 0 ? ` · ${ownerCount} yayıncı` : ""}</span>
              {totalExpenses > 0 && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" title={`${monthTitleYm(viewMonth)} içerik harcamaları`}>
                    ${totalExpenses.toLocaleString("tr-TR")} harcama ({monthTitleYm(viewMonth)})
                  </span>
                </>
              )}
              {cpm > 0 && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-blue-600">CPM ${cpm.toFixed(2)}</span>
                </>
              )}
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {onEnterBrandPanel && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/45 dark:text-amber-300 dark:hover:bg-amber-950/40"
              onClick={onEnterBrandPanel}
              title="Bu markanın paneline geçici olarak gir"
            >
              <LogIn size={12} /> Marka paneli
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onOpenLinks}>
            <Link2 size={12} /> Linkleri yönet ({links.length})
          </Button>
          {!readOnly && (
            <button type="button" onClick={onEditBrand} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1.5">
              <Pencil size={13} />
            </button>
          )}
        </div>
      </CardHeader>

      {/* Aylık izlenme hedefi — düzenleme yetkisi: karttan giriş; salt okunur: yalnız çubuk */}
      {(readOnly ? hasTarget : true) && (
        <div className="px-6 -mt-1 space-y-2">
          {!readOnly && (
            <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Target size={11} className="shrink-0" /> Aylık izlenme hedefi (tüm linkler toplamı)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs tabular-nums max-w-[160px]"
                  placeholder="Örn. 500000"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const t = goalDraft.trim();
                    const n = t === "" ? undefined : Math.max(0, parseInt(t, 10) || 0);
                    updateBrand(brand.id, { monthlyTarget: n });
                  }}
                >
                  Kaydet
                </Button>
                {hasTarget && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => {
                      setGoalDraft("");
                      updateBrand(brand.id, { monthlyTarget: undefined });
                    }}
                  >
                    Kaldır
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                Seçili ay ({monthTitleYm(viewMonth)}) toplam izlenme: <span className="tabular-nums font-medium text-foreground">{fmtViews(totalCurrent)}</span>
              </p>
            </div>
          )}
          {hasTarget && targetPct !== null && (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span className="inline-flex items-center gap-1"><Target size={10} /> Hedefe göre ilerleme · {fmtViews(brand.monthlyTarget!)}</span>
                <span className="tabular-nums">{targetPct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${targetPct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${targetPct}%` }} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="px-6 pb-3">
        <BrandMonthlyStatsPanel
          brandId={brand.id}
          monthYm={viewMonth}
          readOnly={readOnly}
          className="shadow-none"
        />
      </div>

      <CardContent className="relative space-y-2 pt-0">
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-2 py-2">
              Link eklenmemiş. &quot;Linkleri yönet&quot; ile ekleyin veya yayıncı panelinden paylaşın.
            </p>
          ) : (
            <>
              {previewLinks.map((link) => {
                const Icon = platformIcon(link.platform);
                const { lastViews } = linkViewsForMonth(
                  link, viewMonth, linkSnapshots, todayYm
                );
                return (
                  <div key={link.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <Icon size={14} className="shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{link.platform}</span>
                    {link.ownerId && (
                      <span className="text-muted-foreground truncate">· {empName(link.ownerId)}</span>
                    )}
                    <span className="ml-auto tabular-nums font-semibold shrink-0">
                      {lastViews > 0 ? fmtViews(lastViews) : "—"}
                    </span>
                  </div>
                );
              })}
              {links.length > previewLinks.length && (
                <button
                  type="button"
                  onClick={onOpenLinks}
                  className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline py-1"
                >
                  +{links.length - previewLinks.length} link daha — tümünü gör
                </button>
              )}
            </>
          )}
          {monthExpenses.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2">
                {monthTitleYm(viewMonth)} içerik harcamaları
              </p>
              {monthExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                  <span className="text-muted-foreground truncate">{e.description || e.category}</span>
                  <span className="text-amber-700 dark:text-amber-300 tabular-nums font-medium shrink-0">
                    ${e.amountUsd.toLocaleString("tr-TR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>

    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function IzlenmePage() {
  const readOnly = useIsReadOnly();
  const router = useRouter();
  const { user } = useAuth();
  const enterBrandPanel = usePanelView((s) => s.enterBrandPanel);
  const todayYm = toYearMonthLocal(new Date());
  const [viewMonth, setViewMonth] = useState(() => todayYm);

  const {
    employees, brands, brandLinks, linkSnapshots, brandViewership, brandMonthlyStats, contentExpenses,
    addBrand, updateBrand, deleteBrand,
    addBrandLink, updateBrandLink, deleteBrandLink,
    addLinkSnapshot, updateLinkSnapshot, deleteLinkSnapshot,
  } = useStore();

  const [brandModal,    setBrandModal]    = useState<"new" | Brand | null>(null);
  const [linksPanelBrand, setLinksPanelBrand] = useState<Brand | null>(null);
  const [linkModal,     setLinkModal]     = useState<{ mode: "new" | BrandLink; brandId?: string } | null>(null);
  const [snapshotModal, setSnapshotModal] = useState<{ link: BrandLink; snapshot?: LinkSnapshot } | null>(null);
  const [historyModal,  setHistoryModal]  = useState<BrandLink | null>(null);

  const linkEmployees = useMemo(
    () => employees.filter((e) => e.status === "active" && e.kind !== "coordinator"),
    [employees]
  );

  const totalViewsMonth = useMemo(
    () => totalLinkViewsForMonth(brandLinks, viewMonth, linkSnapshots, todayYm),
    [brandLinks, linkSnapshots, viewMonth, todayYm]
  );

  const totalExpensesMonth = useMemo(
    () => totalContentExpensesForMonth(contentExpenses, viewMonth),
    [contentExpenses, viewMonth]
  );

  const monthlyViewership = useMemo(
    () =>
      brandViewership
        .filter((v) => v.month === viewMonth)
        .sort((a, b) => b.views - a.views),
    [brandViewership, viewMonth]
  );

  const monthlyViewershipTotal = monthlyViewership.reduce((s, v) => s + v.views, 0);

  const empName = (id?: string) =>
    id ? employees.find((e) => e.id === id)?.name ?? "—" : "Genel";

  const totalViewsLive = brandLinks.reduce((s, l) => s + (l.lastViews ?? 0), 0);
  const activeLinks  = brandLinks.filter(l => l.status === "active").length;
  const linksWithUrl = brandLinks.filter(l => l.url && l.status === "active").length;
  const totalBrands  = brands.filter(b => b.status === "active").length;

  const today = new Date();
  const ago30 = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const recent = linkSnapshots.filter(s => s.date >= ago30).reduce((sum, s) => sum + s.views, 0);

  const refreshLinkAggregate = (linkId: string) => {
    const snaps = useStore.getState().linkSnapshots.filter(s => s.linkId === linkId);
    if (snaps.length === 0) return;
    const last = snaps.sort((a, b) => b.date.localeCompare(a.date))[0];
    useStore.getState().updateBrandLink(linkId, { lastViews: last.views, lastSnapshotDate: last.date });
  };

  const navVm = (delta: number) => setViewMonth(shiftCalendarMonthYm(viewMonth, delta));

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1400px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marka İzlenme Takibi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {readOnly
              ? "Denetim görünümü — salt okunur. Seçtiğiniz aya göre link snapshot özetleri yenilenir."
              : "Markalarınızın platform linklerini ve her dönemin izlenme görüntülerini takip edin. Ay seçerek aynı linkin farklı dönemlerdeki performansını karşılaştırabilirsiniz."}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBrandModal("new")} className="gap-1.5">
              <Plus size={14} /> Marka Ekle
            </Button>
            <Button size="sm" onClick={() => setLinkModal({ mode: "new" })} className="gap-1.5">
              <Plus size={14} /> Link Ekle
            </Button>
          </div>
        )}
      </div>

      <div className="sticky top-0 z-20 -mx-2 px-2 py-2.5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 bg-background/95 backdrop-blur-md border border-border/60 rounded-xl">
        <p className="text-[11px] text-muted-foreground sm:absolute sm:left-3">İnceleme dönemi</p>
        <div className="flex items-center justify-center gap-2 flex-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button" title="Önceki ay" onClick={() => navVm(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[160px] rounded-md border border-border bg-card px-3 py-1.5 text-center text-sm font-medium capitalize">
            {monthTitleYm(viewMonth)}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button" title="Sonraki ay" onClick={() => navVm(1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Aktif Marka",      value: String(totalBrands),                       cls: "text-foreground" },
          { label: "Takip Edilen Link",value: `${linksWithUrl} / ${activeLinks}`,        cls: "text-blue-600" },
          { label: "Seçili Ay İzlenme", value: fmtViews(totalViewsMonth),               cls: "text-foreground font-bold",
            sub: `Canlı (tüm aylar): ${fmtViews(totalViewsLive)}` },
          { label: "Seçili Ay Harcama", value: totalExpensesMonth > 0 ? `$${totalExpensesMonth.toLocaleString("tr-TR")}` : "—",
            cls: totalExpensesMonth > 0 ? "text-amber-700 dark:text-amber-300 font-bold" : "text-muted-foreground",
            sub: "İçerik harcamaları (iptal/red hariç)" },
          { label: "Son 30 Gün (snapshot)", value: fmtViews(recent),                   cls: recent > 0 ? "text-green-600" : "text-muted-foreground",
            icon: recent > 0 ? TrendingUp : TrendingDown,
            sub: "Ay seçiciden bağımsız · son 30 gün" },
        ].map(k => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1.5">
              {k.icon && <k.icon size={11} />}
              {k.label}
            </p>
            <p className={`text-xl tabular-nums ${k.cls}`}>{k.value}</p>
            {"sub" in k && k.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Otomatik link yenileme — RapidAPI Basic plan bütçesine göre */}
      {!readOnly && (
        <div className="mb-6">
          <AutoRefreshStatusPanel />
        </div>
      )}

      {/* Yayıncı aylık izlenme raporları (brand_viewership) */}
      {monthlyViewership.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye size={15} /> Yayıncı Aylık İzlenme Raporları
            </CardTitle>
            <CardDescription className="text-xs">
              Yayıncı panelinden girilen marka bazlı toplamlar · seçili ay: {monthTitleYm(viewMonth)} · toplam{" "}
              <span className="font-semibold tabular-nums text-foreground">{fmtViews(monthlyViewershipTotal)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Marka</th>
                  <th className="pb-2 pr-3 font-medium">Yayıncı</th>
                  <th className="pb-2 pr-3 font-medium text-right">İzlenme</th>
                  <th className="pb-2 font-medium">Not</th>
                </tr>
              </thead>
              <tbody>
                {monthlyViewership.map((v) => (
                  <tr key={v.id} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="py-2 pr-3 font-medium text-foreground">
                      {brands.find((b) => b.id === v.brandId)?.shortName ?? v.brandName}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{empName(v.employeeId)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">{fmtViews(v.views)}</td>
                    <td className="py-2 text-xs text-muted-foreground truncate max-w-[200px]">{v.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Marka × yayıncı attribution + operasyon — admin */}
      {!readOnly && brands.length > 0 && (
        <BrandAttributionCard
          brands={brands}
          brandViewership={monthlyViewership}
          brandMonthlyStats={brandMonthlyStats}
          contentExpenses={contentExpenses}
          viewMonth={viewMonth}
          employees={linkEmployees}
        />
      )}

      {/* Help banner */}
      {!readOnly && (
        <div className="mb-6 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/40 dark:border-blue-500/40 dark:bg-blue-950/35">
          <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">Otomatik takip nasıl çalışır?</p>
          <p className="text-xs text-blue-800 dark:text-blue-200/90 leading-relaxed">
            1) Her markaya Instagram / Kick / TikTok / YouTube linki ekleyin (handle + URL) ·
            2) <RefreshCw size={11} className="inline" /> ile seçtiğiniz aya uygun tarihle snapshot girin ·
            3) Geçmiş ay seçerek aynı linkin dönemsel performansını karşılaştırın ·
            4) Yayıncı panelindeki marka linkleri listesi de aynı ay seçiciyle uyumludur.
          </p>
        </div>
      )}

      {/* Brand cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {brands.map(b => (
          <BrandCard
            key={b.id}
            brand={b}
            viewMonth={viewMonth}
            todayYm={todayYm}
            readOnly={readOnly}
            employees={linkEmployees}
            onEditBrand={() => setBrandModal(b)}
            onOpenLinks={() => setLinksPanelBrand(b)}
            onEnterBrandPanel={
              user?.role === "admin"
                ? () => {
                    enterBrandPanel(b.id, b.name);
                    router.push("/marka/izlenmeler");
                  }
                : undefined
            }
          />
        ))}
        {brands.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            {readOnly ? "Henüz marka kaydı yok." : "Henüz marka eklenmemiş. \"Marka Ekle\" ile başlayın."}
          </div>
        )}
      </div>

      <BrandLinksPanel
        brand={linksPanelBrand}
        open={linksPanelBrand !== null}
        onClose={() => setLinksPanelBrand(null)}
        viewMonth={viewMonth}
        todayYm={todayYm}
        readOnly={readOnly}
        employees={linkEmployees}
        onAddLink={(brandId) => {
          setLinksPanelBrand(null);
          setLinkModal({ mode: "new", brandId });
        }}
        onEditLink={(l) => {
          setLinksPanelBrand(null);
          setLinkModal({ mode: l });
        }}
        onAddSnapshot={(l) => {
          setLinksPanelBrand(null);
          setSnapshotModal({ link: l });
        }}
        onViewHistory={(l) => {
          setLinksPanelBrand(null);
          setHistoryModal(l);
        }}
      />

      {/* Modals */}
      <Modal open={brandModal !== null} onClose={() => setBrandModal(null)}
        title={brandModal === "new" ? "Yeni Marka" : "Markayı Düzenle"}>
        {brandModal && (
          <BrandForm
            initial={brandModal === "new" ? undefined : brandModal}
            onSave={d => { if (brandModal === "new") addBrand(d); else updateBrand(brandModal.id, d); }}
            onDelete={brandModal !== "new" ? () => { deleteBrand(brandModal.id); setBrandModal(null); } : undefined}
            onClose={() => setBrandModal(null)}
          />
        )}
      </Modal>

      <Modal open={linkModal !== null} onClose={() => setLinkModal(null)}
        title={linkModal?.mode === "new" ? "Yeni Link" : "Linki Düzenle"}>
        {linkModal && (
          <LinkForm
            brands={brands}
            employees={linkEmployees}
            defaultBrandId={linkModal.brandId}
            initial={linkModal.mode === "new" ? undefined : linkModal.mode}
            onSave={d => {
              if (linkModal.mode === "new") addBrandLink(d);
              else updateBrandLink(linkModal.mode.id, d);
            }}
            onDelete={linkModal.mode !== "new"
              ? () => { deleteBrandLink((linkModal.mode as BrandLink).id); setLinkModal(null); }
              : undefined}
            onClose={() => setLinkModal(null)}
          />
        )}
      </Modal>

      <Modal open={snapshotModal !== null} onClose={() => setSnapshotModal(null)}
        title={snapshotModal?.snapshot ? "Snapshot'ı Düzenle" : "Yeni İzlenme Snapshot'ı"}>
        {snapshotModal && readOnly && (
          <p className="text-sm text-muted-foreground py-2">
            Denetçi görünümünde snapshot eklenemez veya düzenlenemez. Geçmiş kayıtları kartlardan salt okunur inceleyebilirsiniz.
          </p>
        )}
        {snapshotModal && !readOnly && (
          <SnapshotForm
            key={snapshotModal.snapshot?.id ?? `new-${snapshotModal.link.id}-${viewMonth}`}
            link={snapshotModal.link}
            initial={snapshotModal.snapshot}
            defaultDateForNew={defaultSnapshotDateInMonth(viewMonth)}
            suggestedViewsForNew={
              snapshotModal.snapshot
                ? undefined
                : linkViewsForMonth(snapshotModal.link, viewMonth, linkSnapshots, todayYm).lastViews
            }
            onSave={d => {
              if (snapshotModal.snapshot) updateLinkSnapshot(snapshotModal.snapshot.id, d);
              else addLinkSnapshot(d);
              setTimeout(() => refreshLinkAggregate(snapshotModal.link.id), 0);
            }}
            onDelete={snapshotModal.snapshot ? () => {
              deleteLinkSnapshot(snapshotModal.snapshot!.id);
              setTimeout(() => refreshLinkAggregate(snapshotModal.link.id), 0);
              setSnapshotModal(null);
            } : undefined}
            onClose={() => setSnapshotModal(null)}
          />
        )}
      </Modal>

      <Modal open={historyModal !== null} onClose={() => setHistoryModal(null)}
        title={historyModal ? `${historyModal.platform} · ${historyModal.handle || "Geçmiş"}` : "Geçmiş"}
        size="lg">
        {historyModal && (
          <SnapshotHistory
            link={historyModal}
            snapshots={linkSnapshots.filter(s => s.linkId === historyModal.id)}
            readOnly={readOnly}
            onEdit={(s) => { setHistoryModal(null); setSnapshotModal({ link: historyModal, snapshot: s }); }}
          />
        )}
      </Modal>
    </div>
  );
}
