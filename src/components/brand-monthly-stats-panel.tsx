"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Wallet,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Save,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { useStore, type BrandMonthlyStats } from "@/store/store";
import {
  deriveBrandMonthlyStats,
  draftBrandMonthlyStats,
  findBrandMonthlyStats,
  fmtBrandCount,
  fmtBrandMoney,
  hasBrandMonthlyStatsData,
} from "@/lib/brand-monthly-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function parseIntField(v: string): number {
  const n = parseInt(v.replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseMoneyField(v: string): number {
  const cleaned = v.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function currencySymbol(c: BrandMonthlyStats["currency"]): string {
  return c === "USD" ? "$" : c === "EUR" ? "€" : "₺";
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "blue" | "amber" | "violet";
}) {
  const accentCls =
    accent === "green"
      ? "text-green-700 dark:text-green-300"
      : accent === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : accent === "violet"
          ? "text-violet-700 dark:text-violet-300"
          : "text-blue-700 dark:text-blue-300";
  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon size={11} className={accentCls} />
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function BrandMonthlyStatsPanel({
  brandId,
  monthYm,
  readOnly,
  className,
}: {
  brandId: string;
  monthYm: string;
  readOnly?: boolean;
  className?: string;
}) {
  const { user, users } = useAuth();
  const { brandMonthlyStats, upsertBrandMonthlyStats } = useStore();
  const saved = useMemo(
    () => findBrandMonthlyStats(brandMonthlyStats, brandId, monthYm),
    [brandMonthlyStats, brandId, monthYm]
  );
  const updatedByLabel = useMemo(() => {
    if (!saved?.updatedBy) return null;
    return users.find((u) => u.id === saved.updatedBy)?.name ?? null;
  }, [saved?.updatedBy, users]);

  const [form, setForm] = useState<BrandMonthlyStats>(() =>
    draftBrandMonthlyStats(brandId, monthYm, saved)
  );
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setForm(draftBrandMonthlyStats(brandId, monthYm, saved));
  }, [brandId, monthYm, saved]);

  const derived = useMemo(() => deriveBrandMonthlyStats(form), [form]);
  const hasData = hasBrandMonthlyStatsData(form);
  const cur = form.currency;

  const handleSave = () => {
    upsertBrandMonthlyStats({
      id: form.id || undefined,
      brandId: form.brandId,
      month: form.month,
      newRegistrations: parseIntField(String(form.newRegistrations)),
      depositingMembers: parseIntField(String(form.depositingMembers)),
      firstTimeDepositors: parseIntField(String(form.firstTimeDepositors)),
      depositCount: parseIntField(String(form.depositCount)),
      depositAmount: parseMoneyField(String(form.depositAmount)),
      withdrawalAmount: parseMoneyField(String(form.withdrawalAmount)),
      currency: form.currency,
      notes: form.notes,
      updatedBy: user?.id,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  if (readOnly && !hasData && !saved) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} />
            Operasyon özeti
          </CardTitle>
          <CardDescription>
            Bu ay için kayıt ve yatırım verileri henüz paylaşılmadı.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("border-violet-200/50 dark:border-violet-500/30", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 size={16} className="text-violet-700 dark:text-violet-300" />
              Operasyon özeti
            </CardTitle>
            <CardDescription>
              Kayıt, yatırım yapan üye ve tutarlar — seçili ay ({monthYm})
            </CardDescription>
          </div>
          {!readOnly && (
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave}>
              <Save size={13} />
              {savedFlash ? "Kaydedildi" : "Kaydet"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {readOnly ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <KpiTile
              icon={UserPlus}
              label="Kayıt olan üye"
              value={fmtBrandCount(form.newRegistrations)}
              accent="blue"
            />
            <KpiTile
              icon={Users}
              label="Yatırım yapan üye"
              value={fmtBrandCount(form.depositingMembers)}
              accent="violet"
            />
            <KpiTile
              icon={TrendingUp}
              label="İlk yatırım (FTD)"
              value={fmtBrandCount(form.firstTimeDepositors)}
              accent="green"
            />
            <KpiTile
              icon={ArrowDownCircle}
              label="Toplam yatırım"
              value={fmtBrandMoney(form.depositAmount, cur)}
              sub={
                form.depositCount > 0
                  ? `${fmtBrandCount(form.depositCount)} işlem`
                  : undefined
              }
              accent="green"
            />
            <KpiTile
              icon={ArrowUpCircle}
              label="Toplam çekim"
              value={fmtBrandMoney(form.withdrawalAmount, cur)}
              accent="amber"
            />
            <KpiTile
              icon={Wallet}
              label="Net yatırım"
              value={fmtBrandMoney(derived.netDeposit, cur)}
              sub={
                derived.avgDepositPerMember != null
                  ? `Ort. ${fmtBrandMoney(derived.avgDepositPerMember, cur)} / üye`
                  : undefined
              }
              accent="violet"
            />
            {derived.registrationToDepositPct != null && (
              <KpiTile
                icon={BarChart3}
                label="Kayıt → yatırım"
                value={`${derived.registrationToDepositPct.toFixed(1)}%`}
                sub={`${fmtBrandCount(form.depositingMembers)} / ${fmtBrandCount(form.newRegistrations)} kayıt`}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Kayıt olan üye</label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 mt-1 text-sm tabular-nums"
                  value={form.newRegistrations || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, newRegistrations: parseIntField(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Yatırım yapan üye</label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 mt-1 text-sm tabular-nums"
                  value={form.depositingMembers || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depositingMembers: parseIntField(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">İlk yatırım (FTD)</label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 mt-1 text-sm tabular-nums"
                  value={form.firstTimeDepositors || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      firstTimeDepositors: parseIntField(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Yatırım işlem adedi</label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 mt-1 text-sm tabular-nums"
                  value={form.depositCount || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depositCount: parseIntField(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Para birimi
                  <span className="ml-1 text-violet-700 dark:text-violet-300">★</span>
                </label>
                <select
                  className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currency: e.target.value as BrandMonthlyStats["currency"],
                    }))
                  }
                >
                  <option value="USD">USD ($) · varsayılan</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="TRY">TRY (₺)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Toplam yatırım ({currencySymbol(form.currency)})
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 mt-1 text-sm tabular-nums"
                  value={form.depositAmount || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depositAmount: parseMoneyField(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Toplam çekim ({currencySymbol(form.currency)})
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 mt-1 text-sm tabular-nums"
                  value={form.withdrawalAmount || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      withdrawalAmount: parseMoneyField(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Not (opsiyonel)</label>
              <Input
                className="h-8 mt-1 text-sm"
                placeholder="Örn. kampanya dönemi, özel açıklama"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {(hasData || saved) && (
              <div className="grid gap-2 sm:grid-cols-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                <p>
                  <span className="text-muted-foreground">Net yatırım: </span>
                  <span className="font-semibold tabular-nums">
                    {fmtBrandMoney(derived.netDeposit, cur)}
                  </span>
                </p>
                {derived.avgDepositPerMember != null && (
                  <p>
                    <span className="text-muted-foreground">Ort. yatırım/üye: </span>
                    <span className="font-semibold tabular-nums">
                      {fmtBrandMoney(derived.avgDepositPerMember, cur)}
                    </span>
                  </p>
                )}
                {derived.registrationToDepositPct != null && (
                  <p>
                    <span className="text-muted-foreground">Kayıt→yatırım: </span>
                    <span className="font-semibold tabular-nums">
                      {derived.registrationToDepositPct.toFixed(1)}%
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {readOnly && form.notes.trim() && (
          <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
            <span className="font-medium text-foreground">Not: </span>
            {form.notes}
          </p>
        )}
        {saved?.updatedAt && (
          <p className="text-[10px] text-muted-foreground/80 border-t border-border/40 pt-2 leading-snug">
            Son güncelleme: {new Date(saved.updatedAt).toLocaleString("tr-TR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {updatedByLabel ? ` · ${updatedByLabel}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
