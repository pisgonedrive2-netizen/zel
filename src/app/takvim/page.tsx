"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, ExternalLink, Copy, Check, Link as LinkIcon,
  Twitch, Youtube, Instagram, Send, Globe, MessageCircle,
} from "lucide-react";
import { useStore, type Employee, type StreamerAccount, type ScheduleSlot, type WeeklyPlan, WEEKDAYS_LONG, weekStartOf, nextWeekStartOf } from "@/store/store";
import { useAuth } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { WeeklyPlanForm, WeeklyPlanGrid, weekRangeLabel } from "@/components/weekly-plan-ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";

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
  const { user } = useAuth();
  const {
    employees, streamerAccounts, scheduleSlots, weeklyPlans,
    addStreamerAccount, updateStreamerAccount, deleteStreamerAccount,
    addScheduleSlot, updateScheduleSlot, deleteScheduleSlot,
    addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
  } = useStore();

  const yayincilar = useMemo(
    () => employees.filter(e => (e.kind === "streamer" || e.kind === "moderator") && e.status === "active"),
    [employees]
  );

  const [accountModal, setAccountModal] = useState<{ mode: "new" | StreamerAccount; employeeId?: string } | null>(null);
  const [slotModal, setSlotModal]       = useState<{ mode: "new" | ScheduleSlot; employeeId?: string; day?: number } | null>(null);
  const [planWeek, setPlanWeek] = useState(() => weekStartOf());
  const [planEmpId, setPlanEmpId] = useState("");
  const [planModal, setPlanModal] = useState<{ mode: "new" | WeeklyPlan; weekStart: string; employeeId: string } | null>(null);

  const planEmployeeId = planEmpId || yayincilar[0]?.id || "";
  const plansForWeek = useMemo(
    () => weeklyPlans.filter((p) => p.employeeId === planEmployeeId && p.weekStart === planWeek),
    [weeklyPlans, planEmployeeId, planWeek]
  );

  // Renk paleti — yayıncı bazlı sabit renk
  const EMP_COLORS = ["bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-100 dark:border-blue-500/40",
                       "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-100 dark:border-purple-500/40",
                       "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/45 dark:text-pink-100 dark:border-pink-500/40",
                       "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-100 dark:border-emerald-500/40",
                       "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/45 dark:text-amber-100 dark:border-amber-500/40"];
  const empColor = (id: string) => EMP_COLORS[yayincilar.findIndex(e => e.id === id) % EMP_COLORS.length];

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Haftalık Takvim & Yayıncı Hesapları</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSupabaseClientMode()
              ? "schedule_slots · weekly_plans · streamer_accounts — Supabase ile senkronize"
              : "Yayıncıların güncel kullandıkları hesaplar ve haftalık yayın planı"}
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
      <Card className="mb-8 gap-2 py-5">
        <CardHeader>
          <CardTitle>Haftalık Yayın Planı</CardTitle>
          <CardDescription>Yayıncı bazlı haftalık takvim · slot eklemek için hücreye tıklayın</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[900px] grid grid-cols-[100px_repeat(7,_minmax(110px,_1fr))] gap-1.5">
              {/* Header */}
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-2 py-2">Yayıncı</div>
              {WEEKDAYS_LONG.map((d) => (
                <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center px-2 py-2 bg-muted/60 rounded-md">
                  {d}
                </div>
              ))}

              {/* Yayıncı satırları */}
              {yayincilar.map((emp) => (
                <RowFragment key={emp.id} emp={emp}>
                  {WEEKDAYS_LONG.map((_, dayIdx) => {
                    const day = dayIdx + 1;
                    const slots = scheduleSlots.filter(s => s.employeeId === emp.id && s.dayOfWeek === day);
                    return (
                      <div key={day}
                        className="min-h-[72px] p-1.5 border border-dashed border-border rounded-md hover:border-primary/50 hover:bg-accent/50 dark:hover:bg-accent/30 transition-all cursor-pointer relative group"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("[data-schedule-slot]")) return;
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
                          {slots.length === 0 && (
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
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-foreground">Güncel Hesaplar</h2>
        <p className="text-muted-foreground text-sm">Yayıncıların aktif kullandığı tüm hesap, kanal ve linkler</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {yayincilar.map((emp) => {
          const accounts = streamerAccounts.filter(a => a.employeeId === emp.id);
          return (
            <Card key={emp.id} className="gap-2 py-5">
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-xs font-bold ${empColor(emp.id)}`}>
                      {emp.avatar || emp.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <CardDescription>{emp.role} · {accounts.length} hesap</CardDescription>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAccountModal({ mode: "new", employeeId: emp.id })}>
                  <Plus size={12} /> Hesap
                </Button>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {accounts.length === 0 && (
                  <p className="text-xs text-muted-foreground italic px-2 py-3">Henüz hesap eklenmemiş.</p>
                )}
                {accounts.map(acc => {
                  const Icon = platformIcon(acc.platform);
                  return (
                    <div key={acc.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors group">
                      <Icon size={14} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{acc.platform}</span>
                          <Badge variant="outline" className={`text-[10px] ${acc.status === "active" ? "border-green-200 text-green-700 dark:border-green-500/40 dark:text-green-400" : "text-muted-foreground"}`}>
                            {acc.status === "active" ? "Aktif" : "Pasif"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <CopyableText value={acc.handle} className="text-muted-foreground" />
                          {acc.url && (
                            <a href={acc.url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700">
                              <LinkIcon size={10} /> Aç <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                        {acc.notes && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{acc.notes}</p>}
                      </div>
                      <button onClick={() => setAccountModal({ mode: acc })} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-1">
                        <Pencil size={12} />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── YAYINCI HAFTALIK PLANLARI (tarihli) ─────────────────────── */}
      <div className="mt-10 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Yayıncı Haftalık Planları</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Yayıncının bu/geçmiş hafta planı — geçmişe dönük düzenleme yapabilirsiniz (Supabase&apos;e kaydedilir).
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
              const d = new Date(planWeek + "T00:00:00");
              d.setDate(d.getDate() - 7);
              setPlanWeek(weekStartOf(d));
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
            onEdit={(p) => setPlanModal({ mode: p, weekStart: p.weekStart, employeeId: p.employeeId })}
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
              if (slotModal.mode === "new") addScheduleSlot(d);
              else updateScheduleSlot(slotModal.mode.id, d);
            }}
            onDelete={slotModal.mode !== "new" ? () => { deleteScheduleSlot((slotModal.mode as ScheduleSlot).id); setSlotModal(null); } : undefined}
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
              if (planModal.mode === "new") addWeeklyPlan(d);
              else updateWeeklyPlan(planModal.mode.id, d);
            }}
            onDelete={planModal.mode !== "new"
              ? () => { deleteWeeklyPlan((planModal.mode as WeeklyPlan).id); setPlanModal(null); }
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
