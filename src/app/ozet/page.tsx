"use client";

import { useStore, calcNetPayable, calcOpenAdvanceBalance, isPayrollActive, calcKasaBalance, unreadNotificationCount, plannedPayrollPlusApprovedContent, totalCashOutPaidForMonth } from "@/store/store";
import { isActiveContentExpense } from "@/lib/content-expense";
import { fmtDateShort } from "@/lib/fmt-date";
import { useAuth } from "@/store/auth";
import Link from "next/link";
import { fmt, MONTHS, toYearMonthLocal } from "@/lib/data";
import { totalViewsForMonth } from "@/lib/brand-month-metrics";
import { payrollDueCaption, payrollMonthLongTitle, paymentWindowCalendarPhrase } from "@/lib/payroll-dates";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, Users,
  ArrowUpRight, CheckCircle2, AlertCircle, FileText,
  Wallet, Clapperboard, Eye, Receipt,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatisticsCard2 } from "@/components/ui/statistics-card-2";

// ── Custom tooltip ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-popover-foreground">
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function OzetPage() {
  const {
    companies, projects, expenses, employees,
    salaryExtras, advances, paymentStatuses,
    kasaTransactions, contentExpenses, brandLinks, brands, notifications,
    brandViewership, linkSnapshots,
  } = useStore();
  const { user } = useAuth();

  // Bekleyen onaylar
  const bekleyenOnay = contentExpenses.filter(c => c.reviewStatus === "pending");
  const yeniBildirim = user ? unreadNotificationCount(notifications, user.role, user.id) : 0;
  const recentNotifications = user
    ? notifications.filter(n => n.forRole === user.role && (!n.forUserId || n.forUserId === user.id)).slice(0, 6)
    : [];

  const currentMonth = toYearMonthLocal(new Date());

  const aylikDis  = companies.filter(c => c.status === "active").reduce((s, c) => s + c.monthlyAmount, 0);
  const aylikIc   = projects.filter(p => p.status !== "paused").reduce((s, p) => s + p.monthlyRevenue, 0);

  /** Yayın kadrosu (koordinatör hariç kayıtlı yayıncı/moderatör). */
  const yayinEkibi = employees.filter(
    (e) => e.status === "active" && (e.kind === "streamer" || e.kind === "moderator")
  );
  const koordinasyonSayisi = employees.filter((e) => e.kind === "coordinator" && e.status === "active").length;

  const payrollNetForMonth = (ym: string) => {
    const br = employees.filter((e) => e.kind !== "coordinator" && isPayrollActive(e, ym));
    return br.reduce(
      (s, e) => s + calcNetPayable(e, ym, advances, salaryExtras, paymentStatuses),
      0
    );
  };

  const AYLAR_2026 = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
  const aylikMaasByIdx = AYLAR_2026.map((ym) => payrollNetForMonth(ym));
  const yillikMaasToplam = aylikMaasByIdx.reduce((a, b) => a + b, 0);

  // Bordrolu çalışanlar (koordinatör hariç, bu ay aktif — payrollStartMonth dahil)
  const bordrolu = employees.filter(e => e.kind !== "coordinator" && isPayrollActive(e, currentMonth));
  const bordroDisiYayincilar = yayinEkibi.filter((e) => !isPayrollActive(e, currentMonth));

  const aylikMaasNet = payrollNetForMonth(currentMonth);
  const aylikPlanCikis = bordrolu.reduce(
    (s, e) => s + plannedPayrollPlusApprovedContent(e, currentMonth, advances, salaryExtras, paymentStatuses, contentExpenses),
    0
  );
  const aylikOdenenToplam = bordrolu.reduce(
    (s, e) => s + totalCashOutPaidForMonth(e, currentMonth, advances, salaryExtras, paymentStatuses, contentExpenses),
    0
  );

  // Bekleyen ödemeler
  const bekleyenler = bordrolu.filter(e => {
    const status = paymentStatuses.find(p => p.employeeId === e.id && p.month === currentMonth);
    return !status?.paid;
  });
  const bekleyenTutar = bekleyenler.reduce((s, e) => s + calcNetPayable(e, currentMonth, advances, salaryExtras, paymentStatuses), 0);
  const acikAvansToplam = bordrolu.reduce((s, e) => s + calcOpenAdvanceBalance(e, currentMonth, salaryExtras), 0);

  // Kasa bakiyesi
  const kasaBakiye = calcKasaBalance(kasaTransactions);
  // Bu ay içerik harcamaları (geri çekilen / reddedilen kayıtlar hariç)
  const icerikHarcAylik = contentExpenses
    .filter((c) => c.month === currentMonth && isActiveContentExpense(c))
    .reduce((s, c) => s + c.amountUsd, 0);
  const icerikHarcBekleyen = contentExpenses
    .filter(
      (c) =>
        c.month === currentMonth &&
        !c.paid &&
        c.reviewStatus !== "rejected" &&
        c.reviewStatus !== "cancelled" &&
        c.reviewStatus !== "pending" &&
        c.reviewStatus !== "needs_info"
    )
    .reduce((s, c) => s + c.amountUsd, 0);

  // Marka ve link sayıları
  const aktifMarka = brands.filter(b => b.status === "active").length;
  const takipliLink = brandLinks.filter(l => l.url && l.status === "active").length;
  const toplamIzlenme = totalViewsForMonth(
    brandLinks,
    brandViewership,
    currentMonth,
    linkSnapshots,
    currentMonth
  );

  const yillikDis   = aylikDis * 12;
  const yillikIc    = aylikIc * 12;
  const yillikGider = expenses.reduce((s, e) => s + e.amount, 0);
  const yillikMaas  = yillikMaasToplam;

  const toplamGelir = yillikDis + yillikIc;
  const toplamGider = yillikGider + yillikMaas;
  const netKar      = toplamGelir - toplamGider;
  const marj        = toplamGelir > 0 ? ((netKar / toplamGelir) * 100).toFixed(1) : "0";

  const areaData = MONTHS.map((ay, idx) => {
    const maasAy = aylikMaasByIdx[idx];
    const gelir = aylikDis + aylikIc;
    const gider = yillikGider / 12 + maasAy;
    const net = gelir - gider;
    return { ay, gelir, gider, net };
  });

  const pieData = [
    { name: "İç Proje",     value: yillikIc,    color: "#3b82f6" },
    { name: "Dış Firmalar", value: yillikDis,   color: "#8b5cf6" },
    { name: "Maaşlar",      value: yillikMaas,  color: "#ef4444" },
    { name: "Giderler",     value: yillikGider, color: "#f59e0b" },
  ];

  // Sparkline verileri (12 aylık eğri)
  const gelirSparkline = areaData.map((d) => d.gelir);
  const giderSparkline = areaData.map((d) => d.gider);
  const netSparkline   = areaData.map((d) => Math.max(0, d.net));
  const maasSparkline  = aylikMaasByIdx;

  const kpis: Array<import("@/components/ui/statistics-card-2").StatisticsCard2Props & { key: string }> = [
    {
      key: "kasa",
      title: "Kasa Bakiyesi",
      value: fmt(kasaBakiye),
      trend: kasaBakiye > 500 ? "up" : "down",
      trendLabel: kasaBakiye > 500 ? "Normal" : "Düşük",
      description: "Anlık bakiye · son işlemler baz alınmıştır",
      icon: Wallet,
    },
    {
      key: "bekleyen",
      title: "Bu Ay Bekleyen Ödeme",
      value: fmt(bekleyenTutar),
      trend: bekleyenler.length > 0 ? "down" : "up",
      trendLabel: bekleyenler.length > 0 ? `${bekleyenler.length} kişi` : "Tamamlandı",
      description: bekleyenler.length > 0
        ? `${bekleyenler.length} çalışan · bu ay ödeme bekleniyor`
        : "Bu ay bekleyen yok",
      icon: AlertCircle,
      sparkline: maasSparkline,
    },
    {
      key: "avans",
      title: "Açık Avans",
      value: fmt(acikAvansToplam),
      trend: acikAvansToplam > 0 ? "down" : "up",
      trendLabel: acikAvansToplam > 0 ? "Açık" : "Temiz",
      description: "Geri ödenmemiş avans bakiyesi",
      icon: TrendingDown,
    },
    {
      key: "icerik",
      title: "İçerik Harcaması (Bu Ay)",
      value: fmt(icerikHarcAylik),
      trend: "neutral",
      trendLabel: `${currentMonth}`,
      description: icerikHarcBekleyen > 0
        ? `${fmt(icerikHarcBekleyen)} ödenmemiş harcama`
        : "Tüm harcamalar kapalı",
      icon: Clapperboard,
      sparkline: giderSparkline,
    },
    {
      key: "netkar",
      title: "Net Kar (yıllık tahmin)",
      value: fmt(netKar),
      trend: netKar >= 0 ? "up" : "down",
      trendLabel: `%${marj} marj`,
      description: `Yıllık tahmin · 12× aylık ortalama`,
      icon: TrendingUp,
      sparkline: netSparkline,
    },
  ];

  const kpisSecond: Array<import("@/components/ui/statistics-card-2").StatisticsCard2Props & { key: string }> = [
    {
      key: "gelir",
      title: "Toplam Gelir (yıllık)",
      value: fmt(toplamGelir),
      trend: "up",
      trendLabel: "2026",
      description: `Dış ${fmt(yillikDis)} + İç ${fmt(yillikIc)}`,
      icon: DollarSign,
      sparkline: gelirSparkline,
    },
    {
      key: "bordrolu",
      title: "Bordrolu Yayıncı",
      value: String(bordrolu.length),
      trend: bordroDisiYayincilar.length > 0 ? "neutral" : "up",
      trendLabel: bordroDisiYayincilar.length > 0 ? `${bordroDisiYayincilar.length} eksik` : "Tam kadro",
      description: bordroDisiYayincilar.length > 0
        ? `Kayıtlı ${yayinEkibi.length} · ${bordroDisiYayincilar.length} kişi bordro dışı`
        : `Kayıtlı yayın ekibi ${yayinEkibi.length} — hepsi bu ay bordoda.`,
      icon: Users,
    },
    {
      key: "marka",
      title: "Aktif Marka",
      value: `${aktifMarka}`,
      trend: "up",
      trendLabel: `${aktifMarka} aktif`,
      description: `${takipliLink} takip edilen link`,
      icon: Eye,
    },
    {
      key: "izlenme",
      title: "Toplam İzlenme",
      value: toplamIzlenme >= 1000 ? `${(toplamIzlenme / 1000).toFixed(1)}k` : String(toplamIzlenme),
      trend: "up",
      trendLabel: `${takipliLink} link`,
      description: "Tüm aktif linklerin toplamı",
      icon: TrendingUp,
    },
    {
      key: "link",
      title: "Takip Edilen Link",
      value: String(takipliLink),
      trend: "up",
      trendLabel: "Aktif",
      description: "Otomatik izlenen sosyal medya linkleri",
      icon: ArrowUpRight,
    },
  ];

  const activities = [
    bekleyenOnay.length > 0
      ? { icon: AlertCircle, title: `${bekleyenOnay.length} yayıncı harcama gönderimi onay bekliyor`, sub: `Toplam ${fmt(bekleyenOnay.reduce((s, e) => s + e.amountUsd, 0))} · İçerik Harcamaları sayfasında incele`, color: "text-amber-600 dark:text-amber-400", href: "/icerik-harcamalari" as const }
      : { icon: CheckCircle2, title: "Tüm yayıncı gönderimleri onaylanmış", sub: "Bekleyen inceleme yok", color: "text-green-600 dark:text-green-400", href: "/icerik-harcamalari" as const },
    bekleyenler.length > 0
      ? {
          icon: AlertCircle,
          title: `${bekleyenler.length} bekleyen maaş ödemesi`,
          sub: `${payrollMonthLongTitle(currentMonth)} bordrosu · toplam ${fmt(bekleyenTutar)} · örnek ödeme tarihi: ${paymentWindowCalendarPhrase(currentMonth, bekleyenler[0]?.paymentDay ?? "1-5")} (çalışana göre değişir)`,
          color: "text-amber-600 dark:text-amber-400",
          href: "/maaslar" as const,
        }
      : { icon: CheckCircle2, title: "Tüm maaş ödemeleri tamam", sub: "Bu ay için bekleyen yok", color: "text-green-600 dark:text-green-400", href: "/maaslar" as const },
    kasaBakiye < 500
      ? { icon: AlertCircle, title: "Kasa bakiyesi düşük", sub: `${fmt(kasaBakiye)} · acil takviye gerekebilir`, color: "text-red-600 dark:text-red-400", href: "/kasa" as const }
      : { icon: Wallet,      title: "Kasa durumu",         sub: `${fmt(kasaBakiye)} · ${kasaTransactions.length} işlem`,    color: "text-blue-600 dark:text-blue-400", href: "/kasa" as const },
    icerikHarcBekleyen > 0
      ? { icon: Clapperboard, title: `${fmt(icerikHarcBekleyen)} ödenmemiş içerik harcaması`, sub: "İçerik Harcamaları sayfasında detay", color: "text-amber-600 dark:text-amber-400", href: "/icerik-harcamalari" as const }
      : { icon: CheckCircle2, title: "Tüm içerik harcamaları kapalı", sub: "Bekleyen rapor yok", color: "text-green-600 dark:text-green-400", href: "/icerik-harcamalari" as const },
    { icon: Receipt, title: `Bu ay ödenen toplam ${fmt(aylikOdenenToplam)}`, sub: `Plan (maaş + onaylı içerik): ${fmt(aylikPlanCikis)} · detay için ödeme raporu`, color: "text-emerald-700 dark:text-emerald-400", href: "/rapor" as const },
    { icon: Eye, title: `${aktifMarka} aktif marka takipte`, sub: `${takipliLink} link · ${toplamIzlenme.toLocaleString("tr-TR")} izlenme`, color: "text-purple-600 dark:text-purple-400", href: "/izlenme" as const },
    { icon: FileText, title: "Ödeme Raporu hazır", sub: `${currentMonth} için CSV/PDF`, color: "text-purple-600 dark:text-purple-400", href: "/rapor" as const },
    { icon: Users,
      title: `${bordrolu.length} yayıncı bu ay bordoda`,
      sub: (() => {
        if (bordroDisiYayincilar.length === 0) {
          return `${yayinEkibi.length} kayıtlı yayıncı — tamamı bu ay bordoda.`;
        }
        const uniqueStarts = [...new Set(bordroDisiYayincilar.map((e) => e.payrollStartMonth))].sort();
        const startLabels = uniqueStarts.map((ym) => payrollMonthLongTitle(ym)).join(", ");
        return `${yayinEkibi.length} kayıtlı · henüz bordoda değil: ${bordroDisiYayincilar.map((e) => e.name.split(" ")[0]).join(", ")} (bordro başlangıcı: ${startLabels})`;
      })(),
      color:
        bordroDisiYayincilar.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
      href: "/maaslar" as const,
    },
  ];

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1280px]">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-violet-600 via-blue-600 to-teal-600 bg-clip-text text-transparent dark:from-violet-400 dark:via-blue-400 dark:to-teal-400">
              Genel Bakış
            </h1>
            <p className="text-[13px] mt-1.5 leading-relaxed text-muted-foreground">
              <span className="font-semibold text-blue-600 dark:text-blue-400">FOXSTREAM</span>
              <span className="text-muted-foreground/80"> · </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">2026</span>
              <span className="text-muted-foreground/80"> mali özet · </span>
              <span className="text-foreground/90 font-medium">{payrollMonthLongTitle(currentMonth)}</span>
              <span className="text-muted-foreground/80"> bordosunda </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{bordrolu.length}</span>
              <span className="text-muted-foreground/80"> yayıncı</span>
              <span className="text-muted-foreground/80"> · </span>
              <span className="text-muted-foreground">kayıtlı yayın </span>
              <span className="font-medium text-cyan-700 dark:text-cyan-400 tabular-nums">{yayinEkibi.length}</span>
              <span className="text-muted-foreground/80"> · </span>
              <span className="text-muted-foreground">koordinatör </span>
              <span className="tabular-nums text-violet-600 dark:text-violet-400">{koordinasyonSayisi}</span>
              <span className="text-muted-foreground/80"> · tutarlar </span>
              <span className="text-amber-700 dark:text-amber-400 font-medium">USD</span>
            </p>
          </div>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 border ${
              Number(marj) >= 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            Kar marjı %{marj}
          </Badge>
        </div>
      </motion.div>

      {bordroDisiYayincilar.length > 0 && (
        <div
          className="mb-5 rounded-xl border border-amber-300/80 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-950 dark:border-amber-500/45 dark:bg-amber-950/35 dark:text-amber-50"
          role="status"
        >
          <p className="font-medium text-amber-900 dark:text-amber-100">Bu ay maaş bordosunda yok</p>
          <p className="mt-1 text-amber-900/85 dark:text-amber-100/90 leading-snug">
            {bordroDisiYayincilar.map((e) => (
              <span key={e.id} className="mr-2 inline-block">
                <span className="font-semibold">{e.name.split("(")[0].trim()}</span>
                {" → "}
                bordro{" "}
                <span className="tabular-nums underline decoration-amber-600/50 dark:decoration-amber-300/50">
                  {payrollMonthLongTitle(e.payrollStartMonth)}
                </span>
                {" itibarı"}
              </span>
            ))}
            . Özet ve grafiklerde bu ay için maaş tutarı yansımaz; veri tutarlılığı böyle korunur.
          </p>
        </div>
      )}

      {/* KPI row 1 — finansal */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
        {kpis.map(({ key, ...k }, i) => <StatisticsCard2 key={key} {...k} delay={i * 0.05} />)}
      </div>

      {/* KPI row 2 — operasyonel */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        {kpisSecond.map(({ key, ...k }, i) => <StatisticsCard2 key={key} {...k} delay={(kpis.length + i) * 0.05} />)}
      </div>

      {/* Bekleyen Ödemeler — bu ay */}
      {bekleyenler.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
          <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-500/35 dark:bg-amber-950/25">
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertCircle size={15} className="text-amber-600 dark:text-amber-400" />
                  Bu Ay Bekleyen Ödemeler
                </CardTitle>
                <CardDescription className="space-y-1">
                  <span className="block font-medium text-foreground">
                    {payrollMonthLongTitle(currentMonth)} bordrosu — aşağıdaki tutarlar bu aya aittir (bir önceki ayın maaşı değil).
                  </span>
                  <span className="block">
                    {bekleyenler.length} ödeme · toplam {fmt(bekleyenTutar)}
                  </span>
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-500/50">
                {bekleyenler.length} bekliyor
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {bekleyenler.map(e => {
                  const net = calcNetPayable(e, currentMonth, advances, salaryExtras, paymentStatuses);
                  const openAdv = calcOpenAdvanceBalance(e, currentMonth, salaryExtras);
                  return (
                    <div key={e.id} className="px-3 py-2.5 rounded-lg border border-amber-200 bg-card/80 dark:border-amber-500/30 dark:bg-card/60 flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-200 font-semibold text-xs">
                        {e.avatar || e.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {payrollDueCaption(currentMonth, e.paymentDay)}
                          {` · temel ${fmt(e.baseSalary)}`}
                          {openAdv > 0 && ` · ${fmt(openAdv)} açık avans`}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{fmt(net)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Area + Pie row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        >
          <Card className="h-full gap-3 py-5">
            <CardHeader>
              <CardTitle className="text-foreground">Gelir / Gider Analizi</CardTitle>
              <CardDescription>
                <span className="text-blue-600/90 dark:text-blue-400/90 font-medium">2026</span>
                <span className="text-muted-foreground"> aylık tahmini — maaş satırı her ay bordrodaki kişilere göre hesaplanır</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="colorGelir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="ay" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280" }} />
                  <Area type="monotone" dataKey="gelir" name="Gelir" stroke="#3b82f6" strokeWidth={2} fill="url(#colorGelir)" />
                  <Area type="monotone" dataKey="gider" name="Gider" stroke="#ef4444" strokeWidth={2} fill="url(#colorGider)" />
                  <Area type="monotone" dataKey="net"   name="Net"   stroke="#22c55e" strokeWidth={2} fill="url(#colorNet)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
        >
          <Card className="h-full gap-3 py-5">
            <CardHeader>
              <CardTitle className="text-foreground">Mali Dağılım</CardTitle>
              <CardDescription>
                <span className="text-violet-600 dark:text-violet-400 font-medium">Yıllık</span>
                <span className="text-muted-foreground"> tahmin payları · maaş toplamı 12 ay bordro netlerinin gerçek toplamı</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <RechartsPieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs font-medium" style={{ color: d.color }}>{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-foreground">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bar + Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
        >
          <Card className="gap-3 py-5">
            <CardHeader>
              <CardTitle>Aylık Gelir Kırılımı</CardTitle>
              <CardDescription>Dış + İç proje gelirleri</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={areaData} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="ay" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="gelir" name="Gelir" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="gider" name="Gider" fill="#ef4444" radius={[4,4,0,0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}
        >
          <Card className="gap-3 py-5">
            <CardHeader>
              <CardTitle>Son Aktiviteler</CardTitle>
              <CardDescription>Güncel durum bildirimleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.map((a, i) => {
                const Content = (
                  <div className="flex items-start gap-3">
                    <a.icon size={14} className={`shrink-0 mt-0.5 ${a.color}`} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{a.title}</p>
                      <p className={`text-[11px] truncate ${a.color}`}>{a.sub}</p>
                    </div>
                  </div>
                );
                return (
                  <div key={i}>
                    {"href" in a && a.href ? (
                      <Link href={a.href} className="block hover:bg-accent/30 -mx-2 px-2 py-1 rounded transition-colors">{Content}</Link>
                    ) : Content}
                    {i < activities.length - 1 && <Separator className="mt-3" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bildirim feed */}
      {recentNotifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Bildirim Akışı</CardTitle>
                <CardDescription>
                  {yeniBildirim > 0 ? `${yeniBildirim} yeni bildirim` : "Tüm bildirimler okundu"}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px]">
                Toplam {notifications.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {recentNotifications.map(n => (
                  <div key={n.id}
                    className={`px-3 py-2 rounded-lg border ${n.read ? "border-border bg-card" : "border-blue-200 bg-blue-50/30 dark:border-blue-500/40 dark:bg-blue-950/30"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">
                          {fmtDateShort(n.createdAt)}
                        </p>
                        {n.href && (
                          <Link href={n.href} className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                            Görüntüle →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
