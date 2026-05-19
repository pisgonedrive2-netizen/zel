"use client";

import { useMemo } from "react";
import {
  Twitch, Youtube, Instagram, Send, Globe, MessageCircle,
} from "lucide-react";
import { useStore, type Employee, WEEKDAYS_LONG } from "@/store/store";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lock } from "lucide-react";

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

function RowFragment({ emp, children }: { emp: Employee; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-bold">
            {emp.avatar || emp.name[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium truncate">{emp.name.split(" ")[0]}</span>
      </div>
      {children}
    </>
  );
}

export default function MarkaTakvimPage() {
  const { user } = useAuth();
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const { employees, scheduleSlots } = useStore();

  const yayincilar = useMemo(
    () => employees.filter((e) => e.kind === "streamer" && e.status === "active"),
    [employees]
  );

  const isAllowed =
    user?.role === "brand" || (user?.role === "admin" && !!brandViewAs);
  if (!user || !isAllowed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <Lock className="text-muted-foreground" size={28} />
        <p className="text-sm text-muted-foreground">Bu sayfa yalnızca marka hesapları içindir.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Yayıncı yayın takvimi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Haftalık şablon slotları — salt okunur (değişiklik için yönetici ile iletişim).
        </p>
      </div>

      <Card className="gap-2 py-5">
        <CardHeader>
          <CardTitle>Haftalık plan (şablon)</CardTitle>
          <CardDescription>Pazartesi–Pazar tekrarlayan yayın slotları</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[900px] grid grid-cols-[100px_repeat(7,_minmax(110px,_1fr))] gap-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-2 py-2">
                Yayıncı
              </div>
              {WEEKDAYS_LONG.map((d) => (
                <div
                  key={d}
                  className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center px-2 py-2 bg-muted/60 rounded-md"
                >
                  {d}
                </div>
              ))}
              {yayincilar.map((emp) => (
                <RowFragment key={emp.id} emp={emp}>
                  {WEEKDAYS_LONG.map((_, dayIdx) => {
                    const day = dayIdx + 1;
                    const slots = scheduleSlots
                      .filter((s) => s.employeeId === emp.id && s.dayOfWeek === day)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    return (
                      <div
                        key={day}
                        className="min-h-[72px] p-1.5 border border-dashed border-border rounded-md bg-muted/20"
                      >
                        <div className="space-y-1">
                          {slots.map((s) => {
                            const Icon = platformIcon(s.platform);
                            return (
                              <div
                                key={s.id}
                                className={`flex items-start gap-1 w-full text-left text-[10.5px] px-1.5 py-1 rounded border ${empColor(emp.id)}`}
                              >
                                <Icon size={12} className="shrink-0 mt-0.5 opacity-70" />
                                <div className="min-w-0">
                                  <p className="font-semibold tabular-nums">
                                    {s.startTime}–{s.endTime}
                                  </p>
                                  <p className="opacity-80 truncate">
                                    {s.platform}
                                    {s.notes ? ` · ${s.notes}` : ""}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          {slots.length === 0 && (
                            <span className="text-[10px] text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </RowFragment>
              ))}
              {yayincilar.length === 0 && (
                <div className="col-span-8 px-4 py-6 text-center text-sm text-muted-foreground">
                  Yayıncı kaydı yok.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
