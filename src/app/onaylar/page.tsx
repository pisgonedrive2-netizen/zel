"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clapperboard,
  Receipt,
  Users,
} from "lucide-react";
import { useAuth, landingFor, useIsReadOnly } from "@/store/auth";
import { useStore } from "@/store/store";
import { PageShell, PageHeader } from "@/components/page-shell";
import { fmt } from "@/lib/data";
import { monthLabelTr } from "@/lib/month-label";
import { fmtDateShort } from "@/lib/fmt-date";
import {
  useAdminDashboardMetrics,
  useAdminOverdueTasks,
} from "@/lib/admin-dashboard-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK_PRIORITIES } from "@/types/internal-task";

export default function OnaylarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = user?.role === "admin";
  const readOnly = useIsReadOnly("write.content_review");
  const employees = useStore((s) => s.employees);
  const metrics = useAdminDashboardMetrics();
  const { overdueTasks, overdueTaskCount, loading: tasksLoading } = useAdminOverdueTasks(allowed);

  useEffect(() => {
    if (user && !allowed) {
      router.replace(landingFor(user.role, user));
    }
  }, [user, allowed, router]);

  const pendingExpenses = metrics.pendingContentExpenses;

  if (!user || !allowed) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground py-8 text-center">Yükleniyor…</p>
      </PageShell>
    );
  }

  return (
    <PageShell size="lg">
      <PageHeader
        title="Onay Merkezi"
        description={`${monthLabelTr(metrics.currentMonth)} · bekleyen harcama, bordro ve görev aksiyonları`}
        icon={
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
        }
        actions={
          readOnly ? (
            <Badge variant="outline" className="text-muted-foreground">
              Salt okunur
            </Badge>
          ) : undefined
        }
      />

      <Tabs defaultValue="icerik" className="gap-4">
        <TabsList>
          <TabsTrigger value="icerik">
            İçerik Harcamaları
            {pendingExpenses.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {pendingExpenses.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bordro">
            Bordro Ödemeleri
            {metrics.unpaidPayrollCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {metrics.unpaidPayrollCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="gorevler">
            Görevler
            {overdueTaskCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {overdueTaskCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="icerik">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clapperboard size={15} />
                  Bekleyen İçerik Harcamaları
                </CardTitle>
                <CardDescription>
                  Yayıncıların gönderdiği ve henüz onaylanmamış harcamalar
                </CardDescription>
              </div>
              <Link
                href="/icerik-harcamalari"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Tümünü aç
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {pendingExpenses.length === 0 ? (
                <EmptyState message="Tüm içerik harcamaları incelendi." />
              ) : (
                <div className="space-y-2">
                  {pendingExpenses.slice(0, 12).map((e) => {
                    const emp = employees.find((em) => em.id === e.employeeId);
                    return (
                      <div
                        key={e.id}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30"
                      >
                        {e.screenshotUrl &&
                        /^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(e.screenshotUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.screenshotUrl}
                            alt=""
                            className="w-10 h-10 rounded object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center border border-border shrink-0">
                            <Receipt size={14} className="text-muted-foreground/60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {e.brandName}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {emp?.name} · {e.date}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-1">{e.description}</p>
                        </div>
                        <p className="font-bold tabular-nums shrink-0">{fmt(e.amountUsd)}</p>
                      </div>
                    );
                  })}
                  {pendingExpenses.length > 12 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{pendingExpenses.length - 12} kayıt daha —{" "}
                      <Link href="/icerik-harcamalari" className="underline hover:text-foreground">
                        İçerik Harcamaları
                      </Link>{" "}
                      sayfasında
                    </p>
                  )}
                </div>
              )}
              {!readOnly && pendingExpenses.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <Link href="/icerik-harcamalari" className={cn(buttonVariants())}>
                    Onayla / incele
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bordro">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users size={15} />
                  Ödenmemiş Bordro — {monthLabelTr(metrics.currentMonth)}
                </CardTitle>
                <CardDescription>
                  Bu ay tam ödenmemiş veya kısmi ödemeli çalışanlar
                  {metrics.unpaidPayrollCount > 0 &&
                    ` · toplam ${fmt(metrics.unpaidPayrollTotal)}`}
                </CardDescription>
              </div>
              <Link
                href="/maaslar"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Bordroya git
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {metrics.unpaidEmployees.length === 0 ? (
                <EmptyState message="Bu ay için bekleyen bordro ödemesi yok." />
              ) : (
                <div className="space-y-2">
                  {metrics.unpaidEmployees.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-card"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Ödeme günü: {e.paymentDay ?? "1-5"}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-amber-700 border-amber-300 shrink-0">
                        Bekliyor
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && metrics.unpaidEmployees.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <Link href="/maaslar" className={cn(buttonVariants())}>
                    Ödemeleri işle
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gorevler">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList size={15} />
                  Geciken Görevler
                </CardTitle>
                <CardDescription>
                  Son tarihi geçmiş ve tamamlanmamış iç görevler
                </CardDescription>
              </div>
              <Link
                href="/gorevler"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Görev panosu
                {overdueTaskCount > 0 && ` (${overdueTaskCount})`}
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Görevler yükleniyor…</p>
              ) : overdueTasks.length === 0 ? (
                <EmptyState message="Geciken görev yok." />
              ) : (
                <div className="space-y-2">
                  {overdueTasks.slice(0, 12).map((t) => {
                    const priority =
                      TASK_PRIORITIES.find((p) => p.value === t.priority)?.label ??
                      t.priority;
                    return (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50/30 dark:border-red-500/40 dark:bg-red-950/20"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-clamp-1">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {t.assigneeName || "Atanmamış"} · {priority}
                            {t.dueDate && ` · son: ${t.dueDate}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-red-700 border-red-300 shrink-0">
                          Gecikti
                        </Badge>
                      </div>
                    );
                  })}
                  {overdueTasks.length > 12 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{overdueTasks.length - 12} görev daha —{" "}
                      <Link href="/gorevler" className="underline hover:text-foreground">
                        Görevler
                      </Link>{" "}
                      sayfasında
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground italic py-6 text-center flex items-center justify-center gap-1.5">
      <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
      {message}
    </p>
  );
}
