"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Twitch, Youtube, Instagram, Send, Globe, MessageCircle,
} from "lucide-react";
import { useStore, type Employee, WEEKDAYS_LONG } from "@/store/store";
import { BrandLogo } from "@/components/brand-logo";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, canViewBrand } = portal;
  const { employees, scheduleSlots } = useStore();

  const yayincilar = useMemo(
    () => employees.filter((e) => e.kind === "streamer" && e.status === "active"),
    [employees]
  );

  const operasyonHref = markaHref("/marka/operasyon", month);
  const izlenmeHref = markaHref("/marka/izlenmeler", month);

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-8">
      <div>
        <div className="flex items-center gap-3">
          <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">{brand.name} · Yayıncı yayın takvimi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Haftalık şablon slotları — salt okunur (değişiklik için yönetici ile iletişim).
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <Link href={operasyonHref} className="text-primary underline">Operasyon özeti</Link>
              {" · "}
              <Link href={izlenmeHref} className="text-primary underline">İzlenmeler</Link>
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Haftalık program</CardTitle>
          <CardDescription>
            {yayincilar.length} aktif yayıncı · {scheduleSlots.length} slot
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
                    <td className="border border-border align-top">
                      <RowFragment emp={emp}>
                        <></>
                      </RowFragment>
                    </td>
                    {WEEKDAYS_LONG.map((_, dayIdx) => {
                      const dayOfWeek = dayIdx + 1;
                      const slots = scheduleSlots.filter(
                        (s) => s.employeeId === emp.id && s.dayOfWeek === dayOfWeek
                      );
                      return (
                        <td key={dayOfWeek} className="border border-border align-top p-1 min-w-[88px]">
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
                                  {s.notes && (
                                    <p className="text-[9px] opacity-60 line-clamp-2">{s.notes}</p>
                                  )}
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
