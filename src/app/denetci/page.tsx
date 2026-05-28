"use client";

import Link from "next/link";
import {
  Wallet, Receipt, Users as UsersIcon, ShieldCheck, AlertCircle, CheckCircle2,
  Clock, ArrowRight, FileSpreadsheet, Eye, Target,
} from "lucide-react";
import { useMemo } from "react";
import {
  useStore,
  calcKasaBalance,
  calcOpenAdvanceBalance,
  isPayrollActive,
  unreadNotificationCount,
  DEFAULT_KASA_ID,
  type KasaTransaction,
} from "@/store/store";
import { isActiveContentExpense } from "@/lib/content-expense";
import { fmtDateShort } from "@/lib/fmt-date";
import { useAuth } from "@/store/auth";
import { fmt, toYearMonthLocal } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DenetciPage() {
  const { user } = useAuth();
  const {
    kasas,
    kasaTransactions,
    contentExpenses,
    employees,
    salaryExtras,
    paymentStatuses,
    notifications,
  } = useStore();

  const currentMonth = toYearMonthLocal(new Date());
  const kasaOzeti = useMemo(() => {
    const balanceFor = (rows: KasaTransaction[]) =>
      rows.reduce(
        (b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd),
        0
      );
    const genelKasa =
      kasas.find((k) => k.id === DEFAULT_KASA_ID) ??
      kasas.find((k) => k.isDefault && !k.tronAddress);
    const tronKasa = kasas.find((k) => Boolean(k.tronAddress) && !k.archived);
    const genelRows = genelKasa
      ? kasaTransactions.filter((t) => t.kasaId === genelKasa.id)
      : [];
    const tronRows = tronKasa
      ? kasaTransactions.filter((t) => t.kasaId === tronKasa.id)
      : [];
    return {
      genel: balanceFor(genelRows),
      tronToplam: balanceFor(tronRows),
      tronOps: balanceFor(tronRows.filter((t) => t.autoImported)),
      tronLokal: balanceFor(tronRows.filter((t) => !t.autoImported)),
      tum: calcKasaBalance(kasaTransactions),
    };
  }, [kasas, kasaTransactions]);
  const activeExpenses = contentExpenses.filter(isActiveContentExpense);
  const pending      = contentExpenses.filter(e => e.reviewStatus === "pending");
  const approved     = contentExpenses.filter(e => e.reviewStatus === "approved");
  const audited      = activeExpenses.filter(e => e.audited);
  const totalExpenses = activeExpenses.reduce((s, e) => s + e.amountUsd, 0);

  const bordrolu = employees.filter(e => e.kind !== "coordinator" && isPayrollActive(e, currentMonth));
  const acikAvansToplam = bordrolu.reduce((s, e) => s + calcOpenAdvanceBalance(e, currentMonth, salaryExtras), 0);

  const myNotifications = notifications
    .filter(n => n.forRole === "auditor")
    .slice(0, 10);
  const unread = unreadNotificationCount(notifications, "auditor", user?.id);

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1240px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Denetim Paneli</h1>
            <p className="text-sm text-muted-foreground">
              Read-only erişim · kasa kontrolü, yayıncı harcama incelemesi ve maaş raporları
            </p>
          </div>
        </div>
        {unread > 0 && (
          <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50 gap-1">
            <AlertCircle size={12} /> {unread} yeni bildirim
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Wallet size={11} /> Genel Kasa
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums">{fmt(kasaOzeti.genel)}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              TRON iş {fmt(kasaOzeti.tronOps)} · lokal {fmt(kasaOzeti.tronLokal)}
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">
              Tüm kasalar: {fmt(kasaOzeti.tum)}
            </p>
          </CardContent>
        </Card>
        <Card className={`gap-2 py-5 ${pending.length > 0 ? "border-amber-300 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30" : ""}`}>
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock size={11} /> Bekleyen İnceleme
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${pending.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400"}`}>
              {pending.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{fmt(pending.reduce((s, e) => s + e.amountUsd, 0))} toplam</p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Receipt size={11} /> Toplam Harcama
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums">{fmt(totalExpenses)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{activeExpenses.length} kalem · {audited.length} denetlendi</p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <UsersIcon size={11} /> Açık Avans
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${acikAvansToplam > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400"}`}>
              {fmt(acikAvansToplam)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{bordrolu.length} aktif yayıncı</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <QuickLink href="/kasa"                label="Kasa İncele"           desc={`${kasaTransactions.length} işlem · PDF/CSV indir`} icon={Wallet} />
        <QuickLink href="/icerik-harcamalari"  label="İçerik Harcamaları"    desc={`${pending.length} bekleyen · aylık indir`} icon={Receipt} accent={pending.length > 0} />
        <QuickLink href="/izlenme"             label="Marka link & izlenme"  desc="Ay bazlı snapshot / geçmiş" icon={Target} />
        <QuickLink href="/maaslar"             label="Maaş Bordrosu"         desc={`${bordrolu.length} yayıncı · aylık bordro indir`} icon={UsersIcon} />
        <QuickLink href="/rapor"               label="Aylık Ödeme Raporu"    desc="CSV / PDF · tek tıkla ay seç" icon={FileSpreadsheet} />
      </div>

      {/* Pending review feed */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="text-amber-600 dark:text-amber-400" size={15} />
            Bekleyen Onaylar (Admin Aksiyonu Gerekli)
          </CardTitle>
          <CardDescription>Yayıncıların gönderdiği ve henüz onaylanmamış harcamalar</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              <CheckCircle2 className="inline mr-1.5 text-green-600 dark:text-green-400" size={14} />
              Tüm gönderiler onaylanmış.
            </p>
          ) : (
            <div className="space-y-2">
              {pending.slice(0, 8).map(e => {
                const emp = employees.find(em => em.id === e.employeeId);
                return (
                  <div key={e.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30">
                    {e.screenshotUrl && /^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(e.screenshotUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.screenshotUrl} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center border border-border shrink-0">
                        <Receipt size={14} className="text-muted-foreground/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{e.brandName}</Badge>
                        <span className="text-[11px] text-muted-foreground">{emp?.name} · {e.date}</span>
                      </div>
                      <p className="text-sm line-clamp-1">{e.description}</p>
                    </div>
                    <p className="font-bold tabular-nums shrink-0">{fmt(e.amountUsd)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye size={14} />
            Son Bildirimler
          </CardTitle>
          <CardDescription>Yayıncı + admin aktivitesi</CardDescription>
        </CardHeader>
        <CardContent>
          {myNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">Henüz bildirim yok.</p>
          ) : (
            <div className="space-y-1.5">
              {myNotifications.map(n => (
                <div key={n.id} className={`px-3 py-2 rounded-lg border ${n.read ? "border-border bg-card" : "border-blue-200 bg-blue-50/30 dark:border-blue-500/40 dark:bg-blue-950/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {fmtDateShort(n.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Quick link card ──────────────────────────────────────────────────────
function QuickLink({ href, label, desc, icon: Icon, accent }: {
  href: string; label: string; desc: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={`hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm transition-all cursor-pointer ${accent ? "border-amber-300 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30" : ""}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{desc}</p>
          </div>
          <ArrowRight size={14} className="text-muted-foreground/40 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
