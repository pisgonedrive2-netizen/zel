"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Twitch,
  Youtube,
  Instagram,
  Send,
  Globe,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import {
  useStore,
  type Employee,
  type WeeklyPlan,
  WEEKDAYS_LONG,
  weekStartOf,
} from "@/store/store";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import {
  weekRangeLabel,
  formatDateLong,
} from "@/components/weekly-plan-ui";
import {
  filterWeeklyPlansForBrand,
} from "@/lib/weekly-plan-brand-match";
import {
  weekDayIsosFromStart,
  shiftWeekStartIso,
  planDateInWeek,
  todayDateLocal,
} from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<WeeklyPlan["status"], string> = {
  planned:
    "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500/40 dark:text-blue-100",
  in_progress:
    "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/45 dark:border-amber-500/40 dark:text-amber-100",
  completed:
    "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/45 dark:border-green-500/40 dark:text-green-100",
  cancelled: "bg-muted border-border text-muted-foreground line-through",
};

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return Youtube;
  if (p.includes("twitch")) return Twitch;
  if (p.includes("kick")) return Globe;
  if (p.includes("instagram")) return Instagram;
  if (p.includes("telegram")) return Send;
  if (p.includes("twitter") || p.includes("x.com")) return MessageCircle;
  return Globe;
}

function empColor(id: string) {
  const colors = [
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-100",
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100",
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100",
    "border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-500/40 dark:bg-purple-950/40 dark:text-purple-100",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % colors.length;
  return colors[h];
}

export default function MarkaTakvimPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, canViewBrand, navMonth, monthTitle } = portal;
  const { employees, scheduleSlots, weeklyPlans, streamerAccounts } = useStore();

  const thisWeek = weekStartOf(todayDateLocal());
  const [weekView, setWeekView] = useState(thisWeek);

  useEffect(() => {
    setWeekView(weekStartOf(`${month}-15`));
  }, [month]);

  const yayincilar = useMemo(
    () => employees.filter((e) => e.kind === "streamer" && e.status === "active"),
    [employees]
  );

  const plansForBrand = useMemo(() => {
    if (!brand) return [];
    return filterWeeklyPlansForBrand(weeklyPlans, brand);
  }, [weeklyPlans, brand]);

  const plansInMonth = useMemo(
    () => plansForBrand.filter((p) => p.date.startsWith(month)),
    [plansForBrand, month]
  );

  const weekPlans = useMemo(
    () =>
      plansForBrand
        .filter((p) => planDateInWeek(p.date, weekView))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            (a.startTime ?? "").localeCompare(b.startTime ?? "")
        ),
    [plansForBrand, weekView]
  );

  const weekDays = useMemo(() => weekDayIsosFromStart(weekView), [weekView]);

  const empById = useMemo(() => new Map(yayincilar.map((e) => [e.id, e])), [yayincilar]);

  const accountLabel = (accountId?: string) => {
    if (!accountId) return "";
    const a = streamerAccounts.find((x) => x.id === accountId);
    return a ? `${a.platform}${a.handle ? ` · ${a.handle}` : ""}` : "";
  };

  const operasyonHref = markaHref("/marka/operasyon", month);
  const izlenmeHref = markaHref("/marka/izlenmeler", month);

  const navWeek = (dir: -1 | 1) => setWeekView((w) => shiftWeekStartIso(w, dir));

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {brand.name} · Yayıncı yayın takvimi
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Yayıncıların girdiği haftalık planlar — marka etiketiniz (
                  <strong>{brand.shortName}</strong>) ile eşleşenler.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link href={operasyonHref} className="text-primary underline">
                    Operasyon özeti
                  </Link>
                  {" · "}
                  <Link href={izlenmeHref} className="text-primary underline">
                    İzlenmeler
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0" onClick={() => navMonth(-1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs font-medium min-w-[100px] text-center capitalize">{monthTitle}</span>
              <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0" onClick={() => navMonth(1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>

          {/* Haftalık yayıncı planları */}
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays size={16} /> Yayıncı planları
                </CardTitle>
                <CardDescription>
                  {monthTitle} içinde {plansInMonth.length} etkinlik · bu hafta {weekPlans.length}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0" onClick={() => navWeek(-1)}>
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-medium min-w-[140px] text-center">
                  {weekRangeLabel(weekView)}
                </span>
                {weekView !== thisWeek && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setWeekView(thisWeek)}
                  >
                    Bu hafta
                  </Button>
                )}
                <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0" onClick={() => navWeek(1)}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {weekPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Bu hafta için <strong>{brand.shortName}</strong> etiketli plan yok. Yayıncı plan
                  eklerken marka alanına &quot;{brand.shortName}&quot; yazmalıdır.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                  {weekDays.map((iso, i) => {
                    const dayPlans = weekPlans.filter((p) => p.date === iso);
                    const isToday = iso === todayDateLocal();
                    return (
                      <div
                        key={iso}
                        className={cn(
                          "border rounded-lg p-2 min-h-[100px]",
                          isToday
                            ? "border-primary/40 bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                          {WEEKDAYS_LONG[i].slice(0, 3)}{" "}
                          <span className="text-foreground/70">{iso.slice(8, 10)}</span>
                        </p>
                        {dayPlans.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        ) : (
                          <div className="space-y-1">
                            {dayPlans.map((p) => {
                              const emp = empById.get(p.employeeId);
                              return (
                                <div
                                  key={p.id}
                                  className={cn(
                                    "rounded border px-1.5 py-1 text-[10px]",
                                    STATUS_COLORS[p.status]
                                  )}
                                >
                                  <p className="font-semibold truncate">
                                    {emp?.name.split(" ")[0] ?? "Yayıncı"}
                                  </p>
                                  {(p.startTime || p.endTime) && (
                                    <p className="font-mono text-[9px] opacity-80">
                                      {p.startTime}
                                      {p.endTime ? `–${p.endTime}` : ""}
                                    </p>
                                  )}
                                  <p className="font-medium leading-tight">{p.activity}</p>
                                  {p.brandName && (
                                    <Badge variant="outline" className="mt-0.5 h-4 text-[8px] px-1">
                                      {p.brandName}
                                    </Badge>
                                  )}
                                  {p.streamerAccountId && (
                                    <p className="text-[8px] opacity-60 truncate">
                                      {accountLabel(p.streamerAccountId)}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ay özeti listesi */}
          {plansInMonth.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{monthTitle} — tüm etkinlikler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {plansInMonth.map((p) => {
                  const emp = empById.get(p.employeeId);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center gap-2 text-xs border border-border rounded-lg px-3 py-2"
                    >
                      <span className="font-medium">{formatDateLong(p.date)}</span>
                      <span className="text-muted-foreground">{emp?.name ?? "—"}</span>
                      <span>{p.activity}</span>
                      {p.brandName && (
                        <Badge variant="secondary" className="text-[9px] h-4">
                          {p.brandName}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn("text-[9px] h-4", STATUS_COLORS[p.status])}>
                        {p.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Sürekli şablon (admin) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sürekli haftalık şablon</CardTitle>
              <CardDescription>
                Yöneticinin atadığı tekrarlayan slotlar · {yayincilar.length} yayıncı
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="w-24 border border-border bg-muted/40 p-2 text-left font-medium text-muted-foreground">
                        Yayıncı
                      </th>
                      {WEEKDAYS_LONG.map((d) => (
                        <th
                          key={d}
                          className="border border-border bg-muted/40 p-2 text-center font-medium text-muted-foreground"
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yayincilar.map((emp) => (
                      <tr key={emp.id}>
                        <td className="border border-border align-top p-1.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-bold">
                                {emp.avatar || emp.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium truncate">
                              {emp.name.split(" ")[0]}
                            </span>
                          </div>
                        </td>
                        {WEEKDAYS_LONG.map((_, dayIdx) => {
                          const dayOfWeek = dayIdx + 1;
                          const slots = scheduleSlots.filter(
                            (s) => s.employeeId === emp.id && s.dayOfWeek === dayOfWeek
                          );
                          return (
                            <td
                              key={dayOfWeek}
                              className="border border-border align-top p-1 min-w-[88px]"
                            >
                              {slots.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground/50 px-1">—</span>
                              ) : (
                                slots.map((s) => {
                                  const Icon = platformIcon(s.platform);
                                  return (
                                    <div
                                      key={s.id}
                                      className={`mb-1 rounded border px-1.5 py-1 ${empColor(emp.id)}`}
                                    >
                                      <div className="flex items-center gap-1 font-medium">
                                        <Icon size={10} className="shrink-0 opacity-70" />
                                        <span className="truncate">{s.platform}</span>
                                      </div>
                                      <p className="text-[10px] opacity-80 truncate">
                                        {s.startTime}–{s.endTime}
                                      </p>
                                    </div>
                                  );
                                })
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MarkaPageGuard>
  );
}
