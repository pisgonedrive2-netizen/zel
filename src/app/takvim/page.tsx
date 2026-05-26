"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Pencil, ExternalLink, Copy, Check, Link as LinkIcon,
  Twitch, Youtube, Instagram, Send, Globe, MessageCircle,
  ChevronDown, ChevronUp, Filter, CalendarDays,
} from "lucide-react";
import { useStore, type Employee, type StreamerAccount, type ScheduleSlot, type WeeklyPlan, WEEKDAYS_LONG, weekStartOf, nextWeekStartOf } from "@/store/store";
import { useAuth } from "@/store/auth";
import { WeeklyPlanForm, WeeklyPlanGrid, weekRangeLabel } from "@/components/weekly-plan-ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { createNotificationPersisted } from "@/lib/notification-actions";
import { weekDayIsosFromStart, shiftWeekStartIso } from "@/lib/data";
import { normalizeWeeklyPlanInput } from "@/lib/weekly-plan-normalize";
import { logAudit } from "@/store/audit-log";

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
    employees, streamerAccounts, scheduleSlots, weeklyPlans,
    addStreamerAccount, updateStreamerAccount, deleteStreamerAccount,
    addScheduleSlot, updateScheduleSlot, deleteScheduleSlot,
    addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
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
    () => weeklyPlans.filter((p) => p.employeeId === planEmployeeId && p.weekStart === planWeek),
    [weeklyPlans, planEmployeeId, planWeek]
  );

  // Üst grid'de gösterim için bu haftanın günleri (Pazartesi - Pazar)
  const currentWeekDays = useMemo(() => weekDayIsosFromStart(planWeek), [planWeek]);

  const plansThisWeekByEmpDay = useMemo(() => {
    const map = new Map<string, WeeklyPlan[]>();
    for (const p of weeklyPlans) {
      if (p.weekStart !== planWeek) continue;
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

      {/* ── HAFTALIK TAKVİM ───────────────────────────────────────────── */}
      <Card className="mb-4 gap-2 py-5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Haftalık Yayın Planı</CardTitle>
              <CardDescription>
                Rutin yayın slotları + yayıncıların eklediği haftalık planlar. Slot eklemek için boş hücreye tıklayın.
              </CardDescription>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overlayPlans}
                onChange={(e) => setOverlayPlans(e.target.checked)}
                className="rounded"
              />
              <CalendarDays size={11} /> Yayıncı planlarını göster ({weekRangeLabel(planWeek)})
            </label>
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
                <RowFragment key={emp.id} emp={emp}>
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
                              <p className="font-semibold tabular-nums">{s.startTime}–{s.endTime}</p>
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
                                {p.startTime ? `${p.startTime}${p.endTime ? "–" + p.endTime : ""} · ` : ""}
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
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
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-xs font-bold ${empColor(emp.id)}`}>
                      {emp.avatar || emp.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold">{emp.name}</CardTitle>
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
                </div>
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
      <div className="mt-10 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Yayıncı Haftalık Planları</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Seçilen yayıncının haftalık planı — markaları ve görevleri gün gün düzenleyin. Geçmiş haftalara dönük güncellemeler de kalıcı olarak saklanır.
        </p>
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
          <WeeklyPlanGrid
            weekStart={planWeek}
            label={yayincilar.find((e) => e.id === planEmployeeId)?.name ?? "Plan"}
            plans={plansForWeek}
            onAdd={() => setPlanModal({ mode: "new", weekStart: planWeek, employeeId: planEmployeeId })}
            onEdit={(p) =>
              setPlanModal({
                mode: p,
                weekStart: p.weekStart,
                employeeId: p.employeeId,
              })
            }
          />
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
    </div>
  );
}

/** Grid içinde "Yayıncı adı + 7 gün hücresi"ni tek satır olarak render eden yardımcı. */
function RowFragment({ emp, children }: { emp: Employee; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px] font-bold">
            {emp.avatar || emp.name[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium truncate">{emp.name.split(" ")[0]}</span>
      </div>
      {children}
    </>
  );
}
