"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Pencil, ExternalLink, Copy, Check, Link as LinkIcon,
  Twitch, Youtube, Instagram, Send, Globe, MessageCircle,
  ChevronDown, ChevronUp, Filter, CalendarDays, Maximize2,
  ListTree, Users, Trophy, Sparkles, Zap, TrendingUp,
} from "lucide-react";
import { isoToLocalDateOnly } from "@/lib/data";
import { useStore, type Employee, type StreamerAccount, type ScheduleSlot, type WeeklyPlan, WEEKDAYS_LONG, weekStartOf, nextWeekStartOf } from "@/store/store";
import { useAuth } from "@/store/auth";
import { WeeklyPlanForm, WeeklyPlanGrid, weekRangeLabel } from "@/components/weekly-plan-ui";
import { ShiftTemplateCard } from "@/components/streamer/shift-template-card";
import { PostActivityCalendar } from "@/components/streamer-pool/post-activity-calendar";
import { DailyContentCheckin } from "@/components/streamer/daily-content-checkin";
import { StreamerOperationsHub } from "@/components/takvim/streamer-operations-hub";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { createNotificationPersisted } from "@/lib/notification-actions";
import { weekDayIsosFromStart, shiftWeekStartIso, planDateInWeek, weekStartFromDateIso } from "@/lib/data";
import { normalizeWeeklyPlanInput } from "@/lib/weekly-plan-normalize";
import { logAudit } from "@/store/audit-log";
import {
  BASE_TIMEZONE,
  CALENDAR_TIMEZONES,
  convertFromBase,
  formatConverted,
  offsetLabelFromBase,
} from "@/lib/timezones";

// ── Platform icon helper ──────────────────────────────────────────────────
function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("youtube"))   return Youtube;
  if (p.includes("twitch"))    return Twitch;
  if (p.includes("kick"))      return Globe;
  if (p.includes("instagram")) return Instagram;
  if (p.includes("telegram"))  return Send;
  if (p.includes("twitter") || p.includes("x.com")) return MessageCircle;
  return Globe;
}

const PLATFORMS = ["Kick", "YouTube", "Twitch", "Instagram", "Telegram", "X / Twitter", "TikTok", "Discord", "Other"];

// ── Copy-to-clipboard wallet/handle ───────────────────────────────────────
function CopyableText({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`inline-flex items-center gap-1 ${className} hover:text-blue-600 transition-colors`}
    >
      <span className="truncate">{value}</span>
      {copied ? <Check size={11} className="text-green-600 shrink-0" /> : <Copy size={11} className="opacity-40 shrink-0" />}
    </button>
  );
}

// ── Streamer Account Form ─────────────────────────────────────────────────
function AccountForm({
  employees, initial, defaultEmployeeId, onSave, onDelete, onClose,
}: {
  employees: Employee[];
  initial?: StreamerAccount;
  defaultEmployeeId?: string;
  onSave: (d: Omit<StreamerAccount, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<StreamerAccount, "id">>({
    employeeId: initial?.employeeId ?? defaultEmployeeId ?? employees[0]?.id ?? "",
    platform:   initial?.platform   ?? "Kick",
    handle:     initial?.handle     ?? "",
    url:        initial?.url        ?? "",
    notes:      initial?.notes      ?? "",
    status:     initial?.status     ?? "active",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Yayıncı" required>
            <Select value={form.employeeId} onChange={e => set("employeeId", e.target.value)}
              options={employees.map(em => ({ value: em.id, label: em.name }))} required />
          </Field>
          <Field label="Platform" required>
            <Select value={form.platform} onChange={e => set("platform", e.target.value)}
              options={PLATFORMS.map(p => ({ value: p, label: p }))} required />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Kullanıcı Adı / Handle" required>
            <Input value={form.handle} onChange={e => set("handle", e.target.value)} required placeholder="@kullaniciadi" />
          </Field>
          <Field label="Durum">
            <Select value={form.status} onChange={e => set("status", e.target.value as StreamerAccount["status"])}
              options={[{ value: "active", label: "Aktif" }, { value: "inactive", label: "Pasif" }]} />
          </Field>
        </FormGrid>
        <Field label="URL" required>
          <Input value={form.url} onChange={e => set("url", e.target.value)} required placeholder="https://..." type="url" />
        </Field>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Ek bilgi, parola ipucu, hesap önemli notu..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Hesap Ekle"} />
    </form>
  );
}

// ── Schedule Slot Form ────────────────────────────────────────────────────
function SlotForm({
  employees, initial, defaultEmployeeId, defaultDay, onSave, onDelete, onClose,
}: {
  employees: Employee[];
  initial?: ScheduleSlot;
  defaultEmployeeId?: string;
  defaultDay?: number;
  onSave: (d: Omit<ScheduleSlot, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<ScheduleSlot, "id">>({
    employeeId: initial?.employeeId ?? defaultEmployeeId ?? employees[0]?.id ?? "",
    dayOfWeek:  initial?.dayOfWeek  ?? defaultDay ?? 1,
    startTime:  initial?.startTime  ?? "20:00",
    endTime:    initial?.endTime    ?? "23:00",
    platform:   initial?.platform   ?? "Kick",
    notes:      initial?.notes      ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Yayıncı" required>
            <Select value={form.employeeId} onChange={e => set("employeeId", e.target.value)}
              options={employees.map(em => ({ value: em.id, label: em.name }))} required />
          </Field>
          <Field label="Gün" required>
            <Select value={String(form.dayOfWeek)} onChange={e => set("dayOfWeek", parseInt(e.target.value, 10))}
              options={WEEKDAYS_LONG.map((d, i) => ({ value: String(i + 1), label: d }))} required />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Başlangıç" required>
            <Input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} required />
          </Field>
          <Field label="Bitiş" required>
            <Input type="time" value={form.endTime} onChange={e => set("endTime", e.target.value)} required />
          </Field>
        </FormGrid>
        <Field label="Platform">
          <Select value={form.platform} onChange={e => set("platform", e.target.value)}
            options={PLATFORMS.map(p => ({ value: p, label: p }))} />
        </Field>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Özel içerik / sponsor / etkinlik..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Slot Ekle"} />
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function TakvimPage() {
  const { user, users } = useAuth();
  const {
    employees, brands, streamerAccounts, scheduleSlots, weeklyPlans, weekBrandReels,
    addStreamerAccount, updateStreamerAccount, deleteStreamerAccount,
    addScheduleSlot, updateScheduleSlot, deleteScheduleSlot,
    addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
    addWeekBrandReel, updateWeekBrandReel, deleteWeekBrandReel,
  } = useStore();

  const DAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

  /**
   * Yayıncı plan değişikliklerini ilgili yayıncıya bildirir.
   * Sadece yöneticinin başkasının slotunu değiştirdiği durumlarda atış yapar.
   */
  const notifySlotChange = async (
    action: "added" | "updated" | "deleted",
    slot: ScheduleSlot,
  ) => {
    if (!user) return;
    if (user.role !== "admin" && user.role !== "auditor") return;
    if (user.employeeId && slot.employeeId === user.employeeId) return;
    const emp = employees.find((e) => e.id === slot.employeeId);
    const targetUser = users.find((u) => u.employeeId === slot.employeeId && u.role === "streamer");
    if (!targetUser) return;
    const day = DAY_LABELS[slot.dayOfWeek] ?? `Gün ${slot.dayOfWeek}`;
    const slotDesc = `${day} ${slot.startTime}–${slot.endTime} · ${slot.platform || "—"}`;
    const verb =
      action === "added" ? "yeni yayın slotu eklendi"
      : action === "deleted" ? "yayın slotu kaldırıldı"
      : "yayın slotu güncellendi";
    await createNotificationPersisted({
      type: "schedule_updated",
      title: `Yayın planınız güncellendi`,
      message: `${verb}.\n${slotDesc}${emp ? `\nYayıncı: ${emp.name}` : ""}`,
      forRole: "streamer",
      forUserId: targetUser.id,
      triggeredBy: user.id,
      refId: slot.id,
      href: "/yayinci/takvim",
    });
    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "user_updated",
      detail: `Yayın slotu ${action}: ${emp?.name ?? slot.employeeId} · ${slotDesc}`,
    });
  };

  const notifyPlanChange = async (
    action: "added" | "updated" | "deleted",
    plan: WeeklyPlan,
  ) => {
    if (!user) return;
    if (user.role !== "admin" && user.role !== "auditor") return;
    if (user.employeeId && plan.employeeId === user.employeeId) return;
    const emp = employees.find((e) => e.id === plan.employeeId);
    const targetUser = users.find((u) => u.employeeId === plan.employeeId && u.role === "streamer");
    if (!targetUser) return;
    const verb =
      action === "added" ? "yeni plan satırı eklendi"
      : action === "deleted" ? "plan satırı silindi"
      : "plan satırı güncellendi";
    const time = plan.startTime ? ` · ${plan.startTime}${plan.endTime ? "–" + plan.endTime : ""}` : "";
    const detail = `${plan.date}${time}\n${plan.activity}${plan.brandName ? ` · ${plan.brandName}` : ""}${plan.notes ? `\nNot: ${plan.notes}` : ""}`;
    await createNotificationPersisted({
      type: "schedule_updated",
      title: `Haftalık yayın planınız güncellendi`,
      message: `Yönetici planınızda değişiklik yaptı: ${verb}.\n${detail}`,
      forRole: "streamer",
      forUserId: targetUser.id,
      triggeredBy: user.id,
      refId: plan.id,
      href: `/yayinci/takvim?week=${plan.weekStart}`,
    });
    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "user_updated",
      detail: `Haftalık plan ${action}: ${emp?.name ?? plan.employeeId} · ${plan.date} ${plan.activity}`,
    });
  };

  const yayincilar = useMemo(
    () => employees.filter(e => (e.kind === "streamer" || e.kind === "moderator") && e.status === "active"),
    [employees]
  );

  const [platformFilter, setPlatformFilter] = useState<string>("Tümü");
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [accountModal, setAccountModal] = useState<{ mode: "new" | StreamerAccount; employeeId?: string } | null>(null);
  const [slotModal, setSlotModal]       = useState<{ mode: "new" | ScheduleSlot; employeeId?: string; day?: number } | null>(null);
  const [planWeek, setPlanWeek] = useState(() => weekStartOf());
  const [planEmpId, setPlanEmpId] = useState("");
  const [planModal, setPlanModal] = useState<{ mode: "new" | WeeklyPlan; weekStart: string; employeeId: string } | null>(null);
  // Üst grid haftalık planları da göstersin
  const [overlayPlans, setOverlayPlans] = useState(true);
  // Saat saat geniş-ekran görünümü
  const [fullscreen, setFullscreen] = useState(false);
  // Takvim saat dilimi — saatler Türkiye saatinde saklanır, seçilen ülkeye çevrilir.
  const [tz, setTz] = useState(BASE_TIMEZONE);
  const tt = (hhmm: string) => formatConverted(convertFromBase(hhmm, tz));

  // Bildirimden gelen yönlendirme: /takvim?employee=ID&week=YYYY-MM-DD
  const searchParams = useSearchParams();
  useEffect(() => {
    const emp = searchParams.get("employee");
    const week = searchParams.get("week");
    if (emp) setPlanEmpId(emp);
    if (week) setPlanWeek(week);
  }, [searchParams]);

  const planEmployeeId = planEmpId || yayincilar[0]?.id || "";
  const plansForWeek = useMemo(
    () =>
      weeklyPlans.filter(
        (p) => p.employeeId === planEmployeeId && planDateInWeek(p.date, planWeek)
      ),
    [weeklyPlans, planEmployeeId, planWeek]
  );

  // Achievement (paylaşım) takvimi: seçili yayıncının hafta reel/post tarihleri.
  const activityDates = useMemo(() => {
    const dates: string[] = [];
    for (const r of weekBrandReels) {
      if (r.employeeId !== planEmployeeId) continue;
      const d = isoToLocalDateOnly(r.publishedAt ?? r.createdAt ?? r.weekStart);
      if (d) dates.push(d);
    }
    return dates;
  }, [weekBrandReels, planEmployeeId]);

  const planMonthYm = planWeek.slice(0, 7);
  const reelCountForStreamer = useMemo(
    () => weekBrandReels.filter((r) => r.employeeId === planEmployeeId).length,
    [weekBrandReels, planEmployeeId]
  );

  // Yayıncıya tıklayınca plan + achievement detayına götür.
  const selectStreamer = (id: string) => {
    setPlanEmpId(id);
    setTimeout(() => {
      document
        .getElementById("plan-yayinci-hub")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Üst grid'de gösterim için bu haftanın günleri (Pazartesi - Pazar)
  const currentWeekDays = useMemo(() => weekDayIsosFromStart(planWeek), [planWeek]);

  const plansThisWeekByEmpDay = useMemo(() => {
    const map = new Map<string, WeeklyPlan[]>();
    for (const p of weeklyPlans) {
      if (!planDateInWeek(p.date, planWeek)) continue;
      const key = `${p.employeeId}::${p.date}`;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [weeklyPlans, planWeek]);

  // Renk paleti — yayıncı bazlı sabit renk
  const EMP_COLORS = ["bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-100 dark:border-blue-500/40",
                       "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-100 dark:border-purple-500/40",
                       "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/45 dark:text-pink-100 dark:border-pink-500/40",
                       "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-100 dark:border-emerald-500/40",
                       "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/45 dark:text-amber-100 dark:border-amber-500/40"];
  const empColor = (id: string) => EMP_COLORS[yayincilar.findIndex(e => e.id === id) % EMP_COLORS.length];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const TAKVIM_SECTIONS = [
    { id: "takvim-haftalik", label: "Haftalık grid", icon: CalendarDays },
    { id: "yayinci-hesaplar", label: "Hesaplar", icon: LinkIcon },
    { id: "yayinci-plan-detay", label: "Plan & içerik", icon: ListTree },
  ] as const;

  const PLAN_SUBSECTIONS = [
    { id: "plan-yayinci-hub", label: "Operasyon özeti", icon: TrendingUp },
    { id: "plan-achievement", label: "Achievement", icon: Trophy },
    { id: "plan-checkin", label: "Check-in", icon: Check },
    { id: "plan-sablon", label: "7s şablon", icon: Sparkles },
    { id: "plan-haftalik-grid", label: "Haftalık plan", icon: CalendarDays },
  ] as const;

  const openPlanModal = () => {
    if (!planEmployeeId) return;
    setPlanModal({ mode: "new", weekStart: planWeek, employeeId: planEmployeeId });
    scrollToSection("plan-haftalik-grid");
  };

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Haftalık Takvim & Yayıncı Hesapları</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Yayıncıların güncel hesaplarını ve haftalık yayın planını tek ekrandan yönetin. Boş slotlara hesap atayarak haftalık dağılımı görselleştirin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAccountModal({ mode: "new" })} className="gap-1.5">
            <Plus size={14} /> Hesap Ekle
          </Button>
          <Button size="sm" onClick={() => setSlotModal({ mode: "new" })} className="gap-1.5">
            <Plus size={14} /> Yayın Slotu
          </Button>
        </div>
      </div>

      <nav
        aria-label="Sayfa içi hızlı gezinme"
        className="sticky top-0 z-20 -mx-2 mb-4 border-b border-border/80 bg-background/95 px-2 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:-mx-3 sm:px-3 md:-mx-5 md:px-5"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Hızlı yön bulma — kaydırma gerekmez
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {TAKVIM_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <Icon size={13} className="text-muted-foreground" />
              {label}
            </button>
          ))}
        </div>
        {yayincilar.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Users size={11} /> Yayıncı:
            </span>
            {yayincilar.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => selectStreamer(emp.id)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  planEmployeeId === emp.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/50 text-foreground hover:border-primary/40"
                }`}
              >
                {emp.name}
              </button>
            ))}
          </div>
        )}
        {planEmployeeId && (
          <>
            <p className="mt-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Plan bölümü — hızlı atlama
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {PLAN_SUBSECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                >
                  <Icon size={12} className="text-muted-foreground" />
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                <Zap size={11} className="inline mr-0.5" />
                Hızlı başlangıç:
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[11px] gap-1"
                onClick={() => scrollToSection("plan-yayinci-hub")}
              >
                <TrendingUp size={12} /> Operasyon özeti
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[11px] gap-1"
                onClick={openPlanModal}
              >
                <Plus size={12} /> Plan ekle
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1"
                onClick={() => scrollToSection("plan-checkin")}
              >
                <LinkIcon size={12} /> İçerik URL
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1"
                onClick={() => scrollToSection("plan-sablon")}
              >
                <Sparkles size={12} /> 7s şablon
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => setPlanWeek(weekStartOf())}
              >
                Bu hafta
              </Button>
            </div>
          </>
        )}
      </nav>

      {/* ── HAFTALIK TAKVİM ───────────────────────────────────────────── */}
      <Card id="takvim-haftalik" className="mb-4 scroll-mt-28 gap-2 py-5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Haftalık Yayın Planı</CardTitle>
              <CardDescription>
                Rutin yayın slotları + yayıncıların eklediği haftalık planlar. Slot eklemek için boş hücreye tıklayın.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <Globe size={12} className="text-muted-foreground" />
                <span className="hidden sm:inline">Saat dilimi:</span>
                <select
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="h-7 rounded-md border border-border bg-card px-1.5 text-[11px] text-foreground outline-none focus:border-primary/50"
                  aria-label="Takvim saat dilimi"
                >
                  {CALENDAR_TIMEZONES.map((z) => (
                    <option key={z.tz} value={z.tz}>
                      {z.flag} {z.label}
                    </option>
                  ))}
                </select>
                <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {offsetLabelFromBase(tz)}
                </span>
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overlayPlans}
                  onChange={(e) => setOverlayPlans(e.target.checked)}
                  className="rounded"
                />
                <CalendarDays size={11} /> Yayıncı planlarını göster ({weekRangeLabel(planWeek)})
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() => setFullscreen(true)}
                title="Saat saat geniş takvim görünümü"
              >
                <Maximize2 size={12} /> Geniş ekran
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[900px] grid grid-cols-[100px_repeat(7,_minmax(110px,_1fr))] gap-1.5">
              {/* Header */}
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-2 py-2">Yayıncı</div>
              {WEEKDAYS_LONG.map((d, i) => (
                <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center px-2 py-2 bg-muted/60 rounded-md">
                  <p>{d}</p>
                  {overlayPlans && currentWeekDays[i] && (
                    <p className="font-normal text-[9px] text-muted-foreground/70 mt-0.5 tabular-nums">
                      {currentWeekDays[i].slice(5)}
                    </p>
                  )}
                </div>
              ))}

              {/* Yayıncı satırları */}
              {yayincilar.map((emp) => (
                <RowFragment key={emp.id} emp={emp} onSelect={() => selectStreamer(emp.id)}>
                  {WEEKDAYS_LONG.map((_, dayIdx) => {
                    const day = dayIdx + 1;
                    const slots = scheduleSlots.filter(s => s.employeeId === emp.id && s.dayOfWeek === day);
                    const isoDate = currentWeekDays[dayIdx];
                    const dayPlans = overlayPlans
                      ? (plansThisWeekByEmpDay.get(`${emp.id}::${isoDate}`) ?? [])
                      : [];
                    return (
                      <div key={day}
                        className="min-h-[72px] p-1.5 border border-dashed border-border rounded-md hover:border-primary/50 hover:bg-accent/50 dark:hover:bg-accent/30 transition-all cursor-pointer relative group"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("[data-schedule-slot], [data-weekly-plan]")) return;
                          setSlotModal({ mode: "new", employeeId: emp.id, day });
                        }}
                      >
                        <div className="space-y-1">
                          {slots.map((s) => (
                            <button type="button" data-schedule-slot key={s.id}
                              onClick={(ev) => { ev.stopPropagation(); setSlotModal({ mode: s }); }}
                              className={`block w-full text-left text-[10.5px] px-1.5 py-1 rounded border ${empColor(emp.id)} hover:opacity-80 transition-opacity`}
                            >
                              <p className="font-semibold tabular-nums">{tt(s.startTime)}–{tt(s.endTime)}</p>
                              <p className="opacity-70 truncate">{s.platform}{s.notes ? ` · ${s.notes}` : ""}</p>
                            </button>
                          ))}
                          {dayPlans.map((p) => (
                            <button
                              type="button"
                              data-weekly-plan
                              key={`p-${p.id}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setPlanEmpId(emp.id);
                                setPlanModal({ mode: p, weekStart: p.weekStart, employeeId: emp.id });
                              }}
                              className="block w-full text-left text-[10.5px] px-1.5 py-1 rounded border bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-950/40 dark:border-violet-500/40 dark:text-violet-100 hover:opacity-80 transition-opacity"
                              title="Yayıncı planı"
                            >
                              <p className="font-semibold">
                                {p.startTime ? `${tt(p.startTime)}${p.endTime ? "–" + tt(p.endTime) : ""} · ` : ""}
                                {p.activity}
                              </p>
                              {p.brandName && (
                                <p className="opacity-80 truncate">{p.brandName}</p>
                              )}
                            </button>
                          ))}
                          {slots.length === 0 && dayPlans.length === 0 && (
                            <span className="text-[10px] text-muted-foreground/70 inline-flex items-center gap-0.5 pointer-events-none select-none">
                              <Plus size={10} /> ekle
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </RowFragment>
              ))}
              {yayincilar.length === 0 && (
                <div className="col-span-8 px-4 py-6 text-center text-sm text-muted-foreground">
                  Aktif yayıncı bulunamadı. Önce maaşlar sayfasından bir yayıncı ekleyin.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── YAYINCI HESAPLARI ─────────────────────────────────────────── */}
      <div id="yayinci-hesaplar" className="scroll-mt-28 mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Güncel Hesaplar</h2>
          <p className="text-muted-foreground text-sm">Yayıncıların aktif kullandığı tüm hesap, kanal ve linkler</p>
        </div>
        {/* Platform filter chips */}
        {(() => {
          const allPlatforms = [...new Set(streamerAccounts.map(a => a.platform))].sort();
          return allPlatforms.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter size={12} className="text-muted-foreground shrink-0" />
              {["Tümü", ...allPlatforms].map((p) => {
                const Icon = p !== "Tümü" ? platformIcon(p) : null;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatformFilter(p)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all ${
                      platformFilter === p
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {Icon && <Icon size={11} />}
                    {p}
                  </button>
                );
              })}
            </div>
          ) : null;
        })()}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {yayincilar.map((emp) => {
          const allAccounts  = streamerAccounts.filter(a => a.employeeId === emp.id);
          const accounts     = platformFilter === "Tümü" ? allAccounts : allAccounts.filter(a => a.platform === platformFilter);
          const PREVIEW_LIMIT = 3;
          const isExpanded   = expandedAccounts[emp.id] ?? false;
          const visible      = isExpanded ? accounts : accounts.slice(0, PREVIEW_LIMIT);
          const hasMore      = accounts.length > PREVIEW_LIMIT;

          // Platform badge summary for collapsed state
          const platformCounts = allAccounts.reduce<Record<string, number>>((acc, a) => {
            acc[a.platform] = (acc[a.platform] ?? 0) + 1;
            return acc;
          }, {});

          return (
            <Card key={emp.id} className="gap-0 overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-2 py-3 px-4">
                <button
                  type="button"
                  onClick={() => selectStreamer(emp.id)}
                  title={`${emp.name} · plan ve achievement detayını aç`}
                  className="group flex items-center gap-3 text-left min-w-0"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-xs font-bold ${empColor(emp.id)}`}>
                      {emp.avatar || emp.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold group-hover:underline">{emp.name}</CardTitle>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {Object.entries(platformCounts).map(([plat, cnt]) => {
                        const PIcon = platformIcon(plat);
                        return (
                          <span
                            key={plat}
                            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5"
                            title={`${plat}: ${cnt} hesap`}
                          >
                            <PIcon size={10} />
                            {plat}
                            {cnt > 1 && <span className="text-[9px] opacity-60 ml-0.5">×{cnt}</span>}
                          </span>
                        );
                      })}
                      {allAccounts.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">Hesap yok</span>
                      )}
                    </div>
                  </div>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => setAccountModal({ mode: "new", employeeId: emp.id })}
                >
                  <Plus size={12} /> Hesap
                </Button>
              </CardHeader>

              {accounts.length > 0 && (
                <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                  {visible.map(acc => {
                    const Icon = platformIcon(acc.platform);
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/60 bg-muted/20 hover:bg-accent/30 transition-colors"
                      >
                        <Icon size={14} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{acc.platform}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              acc.status === "active"
                                ? "border-emerald-300/70 text-emerald-700 bg-emerald-50/50 dark:border-emerald-500/40 dark:text-emerald-400 dark:bg-emerald-950/30"
                                : "border-border text-muted-foreground"
                            }`}>
                              {acc.status === "active" ? "aktif" : "pasif"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <CopyableText value={acc.handle} className="text-[11px] text-muted-foreground" />
                            {acc.url && (
                              <a
                                href={acc.url}
                                target="_blank"
                                rel="noopener"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink size={10} /> aç
                              </a>
                            )}
                          </div>
                          {acc.notes && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate opacity-70">{acc.notes}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAccountModal({ mode: acc })}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-1 shrink-0"
                          title="Düzenle"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    );
                  })}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setExpandedAccounts(p => ({ ...p, [emp.id]: !isExpanded }))}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-muted/40 transition-colors border border-dashed border-border/60"
                    >
                      {isExpanded ? (
                        <><ChevronUp size={11} /> Daha az göster</>
                      ) : (
                        <><ChevronDown size={11} /> Tümünü gör ({accounts.length - PREVIEW_LIMIT} daha)</>
                      )}
                    </button>
                  )}
                </CardContent>
              )}
              {accounts.length === 0 && (
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-xs text-muted-foreground italic py-2">
                    {platformFilter !== "Tümü" ? `${platformFilter} için hesap yok.` : "Henüz hesap eklenmemiş."}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── YAYINCI HAFTALIK PLANLARI (tarihli) ─────────────────────── */}
      <div id="yayinci-plan-detay" className="mt-10 mb-4 scroll-mt-28">
        <h2 className="text-lg font-semibold text-foreground">Yayıncı Haftalık Planları</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Seçilen yayıncının haftalık planı — markaları ve görevleri gün gün düzenleyin. Tüm değişiklikler Supabase&apos;e kaydedilir; tarihler yerel takvime göre tutulur.
        </p>
        {planEmployeeId && reelCountForStreamer === 0 && (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-2">
            Bu yayıncı için henüz içerik check-in kaydı yok. Üstteki <strong>İçerik URL</strong> ile işaretleyin; achievement takvimi otomatik dolacak.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Select
            value={planEmployeeId}
            onChange={(e) => setPlanEmpId(e.target.value)}
            className="w-48 text-sm h-9"
            options={yayincilar.map((e) => ({ value: e.id, label: e.name }))}
          />
          <div className="flex items-center gap-1 border border-border rounded-lg px-1">
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
              setPlanWeek(shiftWeekStartIso(planWeek, -1));
            }}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-xs font-medium px-2 tabular-nums min-w-[140px] text-center">
              {weekRangeLabel(planWeek)}
            </span>
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setPlanWeek(nextWeekStartOf(planWeek))}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setPlanWeek(weekStartOf())}>
            Bu hafta
          </Button>
        </div>
        {yayincilar.length > 0 && planEmployeeId && (
          <div className="mt-4 space-y-4">
            <StreamerOperationsHub
              employeeId={planEmployeeId}
              employeeName={yayincilar.find((e) => e.id === planEmployeeId)?.name ?? "Yayıncı"}
              planWeek={planWeek}
              planMonthYm={planMonthYm}
            />
            <div id="plan-achievement" className="scroll-mt-28">
              <PostActivityCalendar
                activityDates={activityDates}
                initialMonthYm={planMonthYm}
                title={`${yayincilar.find((e) => e.id === planEmployeeId)?.name ?? "Yayıncı"} · paylaşım achievement'ı`}
                description="Seçili yayıncının reel/post paylaşım günleri (yerel tarih + API) — seri ve toplam içerik takibi"
              />
            </div>
            <div id="plan-checkin" className="scroll-mt-28">
              <DailyContentCheckin
                key={planEmployeeId}
                employeeId={planEmployeeId}
                brands={brands}
                reels={weekBrandReels}
                onAdd={addWeekBrandReel}
                onUpdate={updateWeekBrandReel}
                onDelete={deleteWeekBrandReel}
              />
            </div>
            <div id="plan-sablon" className="scroll-mt-28">
            <ShiftTemplateCard
              weekStart={planWeek}
              weekDays={currentWeekDays}
              employeeId={planEmployeeId}
              userId={user?.id ?? ""}
              existingPlans={plansForWeek}
              employees={yayincilar}
              onSelectEmployee={(id) => setPlanEmpId(id)}
              onApply={(plans) => plans.map((p) => addWeeklyPlan(p))}
              onUndo={(ids) => ids.forEach((id) => deleteWeeklyPlan(id))}
            />
            </div>
            <div id="plan-haftalik-grid" className="scroll-mt-28">
            <WeeklyPlanGrid
              weekStart={planWeek}
              label={yayincilar.find((e) => e.id === planEmployeeId)?.name ?? "Plan"}
              plans={plansForWeek}
              onAdd={() => setPlanModal({ mode: "new", weekStart: planWeek, employeeId: planEmployeeId })}
              onEdit={(p) =>
                setPlanModal({
                  mode: p,
                  weekStart: weekStartFromDateIso(p.date) || planWeek,
                  employeeId: p.employeeId,
                })
              }
            />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={accountModal !== null} onClose={() => setAccountModal(null)}
        title={accountModal?.mode === "new" ? "Yeni Hesap Ekle" : "Hesabı Düzenle"}>
        {accountModal && (
          <AccountForm
            key={accountModal.mode === "new" ? `acc-new-${accountModal.employeeId ?? ""}` : accountModal.mode.id}
            employees={yayincilar}
            defaultEmployeeId={accountModal.employeeId}
            initial={accountModal.mode === "new" ? undefined : accountModal.mode}
            onSave={d => {
              if (accountModal.mode === "new") addStreamerAccount(d);
              else updateStreamerAccount(accountModal.mode.id, d);
            }}
            onDelete={accountModal.mode !== "new" ? () => { deleteStreamerAccount((accountModal.mode as StreamerAccount).id); setAccountModal(null); } : undefined}
            onClose={() => setAccountModal(null)}
          />
        )}
      </Modal>

      <Modal open={slotModal !== null} onClose={() => setSlotModal(null)}
        title={slotModal?.mode === "new" ? "Yayın Slotu Ekle" : "Slotu Düzenle"}>
        {slotModal && (
          <SlotForm
            key={slotModal.mode === "new" ? `slot-new-${slotModal.employeeId}-${slotModal.day}` : slotModal.mode.id}
            employees={yayincilar}
            defaultEmployeeId={slotModal.employeeId}
            defaultDay={slotModal.day}
            initial={slotModal.mode === "new" ? undefined : slotModal.mode}
            onSave={d => {
              if (slotModal.mode === "new") {
                addScheduleSlot(d);
                // Yeni eklenen slotun id'sini Zustand zorunlu kıldığı için bilmiyoruz;
                // bildirim için geçici bir id kullan (sadece refId; UI'da kullanılmıyor).
                void notifySlotChange("added", { ...d, id: "new" });
              } else {
                const next = { ...(slotModal.mode as ScheduleSlot), ...d };
                updateScheduleSlot(slotModal.mode.id, d);
                void notifySlotChange("updated", next);
              }
            }}
            onDelete={slotModal.mode !== "new" ? () => {
              const current = slotModal.mode as ScheduleSlot;
              deleteScheduleSlot(current.id);
              void notifySlotChange("deleted", current);
              setSlotModal(null);
            } : undefined}
            onClose={() => setSlotModal(null)}
          />
        )}
      </Modal>

      <Modal open={planModal !== null} onClose={() => setPlanModal(null)}
        title={planModal?.mode === "new" ? "Haftalık Plan Ekle" : "Planı Düzenle"} size="lg">
        {planModal && user && (
          <WeeklyPlanForm
            key={planModal.mode === "new" ? `plan-new-${planModal.weekStart}` : planModal.mode.id}
            employeeId={planModal.employeeId}
            userId={user.id}
            weekStart={planModal.weekStart}
            employees={yayincilar}
            initial={planModal.mode === "new" ? undefined : planModal.mode}
            onSave={(d) => {
              const normalized = normalizeWeeklyPlanInput(d, {
                employees,
                fallbackEmployeeId: planModal.employeeId,
                streamerAccounts,
              });
              if (!normalized) {
                window.alert("Plan kaydedilemedi — geçerli yayıncı ve tarih seçin.");
                return;
              }
              const payload = { ...normalized, createdBy: user?.id ?? normalized.createdBy };
              if (planModal.mode === "new") {
                const newId = addWeeklyPlan(payload);
                void notifyPlanChange("added", { ...payload, id: newId });
              } else {
                const next = { ...(planModal.mode as WeeklyPlan), ...payload };
                updateWeeklyPlan(planModal.mode.id, payload);
                void notifyPlanChange("updated", next);
              }
              setPlanModal(null);
            }}
            onDelete={planModal.mode !== "new"
              ? () => {
                  const cur = planModal.mode as WeeklyPlan;
                  deleteWeeklyPlan(cur.id);
                  void notifyPlanChange("deleted", cur);
                  setPlanModal(null);
                }
              : undefined}
            onClose={() => setPlanModal(null)}
          />
        )}
      </Modal>

      <AdminWeekFullscreen
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        weekLabel={weekRangeLabel(planWeek)}
        weekDays={currentWeekDays}
        yayincilar={yayincilar}
        scheduleSlots={scheduleSlots}
        plansByEmpDay={plansThisWeekByEmpDay}
        overlayPlans={overlayPlans}
        tt={tt}
        empColor={empColor}
      />
    </div>
  );
}

/** Admin haftalık takvim — saat saat geniş-ekran görünümü (saat dilimi çevirili). */
function AdminWeekFullscreen({
  open,
  onClose,
  weekLabel,
  weekDays,
  yayincilar,
  scheduleSlots,
  plansByEmpDay,
  overlayPlans,
  tt,
  empColor,
}: {
  open: boolean;
  onClose: () => void;
  weekLabel: string;
  weekDays: string[];
  yayincilar: Employee[];
  scheduleSlots: ScheduleSlot[];
  plansByEmpDay: Map<string, WeeklyPlan[]>;
  overlayPlans: boolean;
  tt: (hhmm: string) => string;
  empColor: (id: string) => string;
}) {
  interface HourEntry {
    key: string;
    dayIdx: number;
    startHour: number;
    empName: string;
    empId: string;
    time: string;
    title: string;
  }

  // Üstten yayıncı seçimi (varsayılan: tümü). Hafta/yayıncı listesi değişince sıfırla.
  const allEmpIds = useMemo(() => yayincilar.map((e) => e.id), [yayincilar]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(() => new Set(allEmpIds));
  const empKey = allEmpIds.join("|");
  const [lastEmpKey, setLastEmpKey] = useState(empKey);
  if (empKey !== lastEmpKey) {
    setLastEmpKey(empKey);
    setSelectedEmpIds(new Set(allEmpIds));
  }
  const toggleEmp = (id: string) =>
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { entries, hours, hoursByEmp } = useMemo(() => {
    const list: HourEntry[] = [];
    const hourSet = new Set<number>();
    const minutesByEmp = new Map<string, number>();
    for (let h = 8; h <= 23; h++) hourSet.add(h);
    const parseHour = (t?: string) => {
      if (!t) return -1;
      const [h] = t.split(":").map(Number);
      return Number.isFinite(h) ? h : -1;
    };
    const durationMin = (start?: string, end?: string) => {
      if (!start || !end) return 0;
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
      let d = eh * 60 + em - (sh * 60 + sm);
      if (d < 0) d += 24 * 60; // gece aşan vardiya
      return d;
    };
    const addMin = (id: string, m: number) => minutesByEmp.set(id, (minutesByEmp.get(id) ?? 0) + m);
    for (const emp of yayincilar) {
      // Sürekli slotlar
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const day = dayIdx + 1;
        for (const s of scheduleSlots.filter((x) => x.employeeId === emp.id && x.dayOfWeek === day)) {
          const sh = parseHour(s.startTime);
          if (sh >= 0) hourSet.add(sh);
          addMin(emp.id, durationMin(s.startTime, s.endTime));
          list.push({
            key: `s-${s.id}`,
            dayIdx,
            startHour: sh < 0 ? 10 : sh,
            empName: emp.name.split(" ")[0],
            empId: emp.id,
            time: `${tt(s.startTime)}–${tt(s.endTime)}`,
            title: s.platform + (s.notes ? ` · ${s.notes}` : ""),
          });
        }
      }
      // Yayıncı planları (overlay)
      if (overlayPlans) {
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const iso = weekDays[dayIdx];
          if (!iso) continue;
          for (const p of plansByEmpDay.get(`${emp.id}::${iso}`) ?? []) {
            const sh = parseHour(p.startTime);
            if (sh >= 0) hourSet.add(sh);
            addMin(emp.id, durationMin(p.startTime, p.endTime));
            list.push({
              key: `p-${p.id}`,
              dayIdx,
              startHour: sh < 0 ? 10 : sh,
              empName: emp.name.split(" ")[0],
              empId: emp.id,
              time: p.startTime ? `${tt(p.startTime)}${p.endTime ? "–" + tt(p.endTime) : ""}` : "",
              title: p.activity + (p.brandName ? ` · ${p.brandName}` : ""),
            });
          }
        }
      }
    }
    return {
      entries: list,
      hours: [...hourSet].sort((a, b) => a - b),
      hoursByEmp: minutesByEmp,
    };
  }, [yayincilar, scheduleSlots, plansByEmpDay, overlayPlans, weekDays, tt]);

  const visibleEntries = useMemo(
    () => entries.filter((e) => selectedEmpIds.has(e.empId)),
    [entries, selectedEmpIds]
  );
  const fmtHours = (min: number) => {
    const h = Math.round((min / 60) * 10) / 10;
    return Number.isInteger(h) ? `${h}s` : `${h.toFixed(1)}s`;
  };

  return (
    <Modal open={open} onClose={onClose} title="Haftalık takvim · geniş ekran" size="full">
      <div className="space-y-3 -mx-1">
        <p className="text-sm text-muted-foreground">
          {weekLabel} · saat saat yayıncı slotları ve planları
        </p>

        {/* Yayıncı seçimi (üstten) + haftalık saat toplamı */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setSelectedEmpIds(
                selectedEmpIds.size === yayincilar.length ? new Set() : new Set(allEmpIds)
              )
            }
            className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            {selectedEmpIds.size === yayincilar.length ? "Tümünü kaldır" : "Tümünü seç"}
          </button>
          {yayincilar.map((emp) => {
            const on = selectedEmpIds.has(emp.id);
            const mins = hoursByEmp.get(emp.id) ?? 0;
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggleEmp(emp.id)}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
                  on
                    ? `${empColor(emp.id)} border-current/40 font-medium`
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30",
                ].join(" ")}
              >
                <span className={`h-2 w-2 rounded-full ${on ? "bg-current" : "bg-muted-foreground/30"}`} />
                {emp.name.split(" ")[0]}
                {mins > 0 && (
                  <span className="rounded-full bg-background/60 px-1 text-[9px] font-mono tabular-nums">
                    {fmtHours(mins)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto border border-border rounded-xl">
          <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `3.5rem repeat(7, minmax(6rem, 1fr))` }}>
            <div className="border-b border-border bg-muted/30 p-1" />
            {WEEKDAYS_LONG.map((d, i) => (
              <div key={d} className="border-b border-l border-border bg-muted/30 p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{d.slice(0, 3)}</p>
                {weekDays[i] && <p className="text-xs font-medium tabular-nums">{weekDays[i].slice(8, 10)}</p>}
              </div>
            ))}
            {hours.map((hour) => (
              <div key={hour} className="contents">
                <div className="border-b border-border px-1 py-2 text-[10px] text-muted-foreground text-right font-mono bg-muted/20">
                  {tt(`${String(hour).padStart(2, "0")}:00`)}
                </div>
                {WEEKDAYS_LONG.map((_, dayIdx) => {
                  const cell = visibleEntries.filter((e) => e.dayIdx === dayIdx && e.startHour === hour);
                  return (
                    <div key={`${dayIdx}-${hour}`} className="border-b border-l border-border p-0.5 min-h-[48px] align-top">
                      {cell.map((e) => (
                        <div
                          key={e.key}
                          className={`w-full text-left px-1 py-0.5 mb-0.5 rounded border text-[9px] ${empColor(e.empId)}`}
                        >
                          <p className="font-semibold truncate">{e.empName}</p>
                          {e.time && <p className="font-mono text-[8px] opacity-80">{e.time}</p>}
                          <p className="font-medium truncate">{e.title}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {selectedEmpIds.size}/{yayincilar.length} yayıncı seçili · Saatsiz planlar 10:00 satırında
          gösterilir. Saatler seçilen saat dilimine çevrilir.
        </p>
      </div>
    </Modal>
  );
}

/** Grid içinde "Yayıncı adı + 7 gün hücresi"ni tek satır olarak render eden yardımcı. */
function RowFragment({ emp, children, onSelect }: { emp: Employee; children: React.ReactNode; onSelect?: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        title={`${emp.name} · plan ve achievement detayını aç`}
        className="group flex items-center gap-2 px-2 py-1.5 text-left rounded-md hover:bg-accent/50 transition-colors"
      >
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px] font-bold">
            {emp.avatar || emp.name[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium truncate group-hover:underline">{emp.name.split(" ")[0]}</span>
      </button>
      {children}
    </>
  );
}
