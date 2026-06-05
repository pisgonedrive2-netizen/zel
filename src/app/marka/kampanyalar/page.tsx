"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Zap, PlusCircle, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { useIsReadOnly } from "@/store/auth";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, NumberInput, FormGrid } from "@/components/ui/field";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtDateOnly } from "@/lib/fmt-date";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  type BrandCampaign,
} from "@/types/brand-igaming";

const emptyCreate = {
  name: "",
  campaignType: "bonus" as BrandCampaign["campaignType"],
  status: "draft" as BrandCampaign["status"],
  promoCode: "",
  startDate: "",
  endDate: "",
  budgetUsd: 0,
  notes: "",
};

async function fetchCampaignsApi(brandId: string): Promise<BrandCampaign[]> {
  const res = await fetch(
    `/api/marka/igaming/campaigns?brandId=${encodeURIComponent(brandId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    campaigns?: BrandCampaign[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Kampanyalar yüklenemedi");
  return data.campaigns ?? [];
}

async function saveCampaignApi(body: Partial<BrandCampaign>): Promise<BrandCampaign> {
  const res = await fetch("/api/marka/igaming/campaigns", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    campaign?: BrandCampaign;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
  return data.campaign!;
}

async function deleteCampaignApi(id: string): Promise<void> {
  const res = await fetch(
    `/api/marka/igaming/campaigns?id=${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Silinemedi");
}

export default function MarkaKampanyalarPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand } = portal;
  const readOnly = useIsReadOnly();

  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCreate);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await fetchCampaignsApi(brandId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kampanyalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      active: campaigns.filter((c) => c.status === "active").length,
      draft: campaigns.filter((c) => c.status === "draft").length,
      total: campaigns.length,
    }),
    [campaigns],
  );

  const resetForm = () => {
    setEditId(null);
    setForm(emptyCreate);
  };

  const startEdit = (c: BrandCampaign) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      campaignType: c.campaignType,
      status: c.status,
      promoCode: c.promoCode ?? "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      budgetUsd: c.budgetUsd ?? 0,
      notes: c.notes ?? "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !form.name.trim() || readOnly) return;
    setBusy(true);
    setError(null);
    try {
      await saveCampaignApi({
        id: editId ?? undefined,
        brandId,
        name: form.name.trim(),
        campaignType: form.campaignType,
        status: form.status,
        promoCode: form.promoCode.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        budgetUsd: form.budgetUsd > 0 ? form.budgetUsd : undefined,
        notes: form.notes.trim(),
        rules: {},
      });
      resetForm();
      await load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: BrandCampaign) => {
    if (readOnly || !confirm(`"${c.name}" kampanyası silinsin mi?`)) return;
    setError(null);
    try {
      await deleteCampaignApi(c.id);
      if (editId === c.id) resetForm();
      await load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  const canWrite = !readOnly;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Card className="relative overflow-hidden border-amber-200/60 dark:border-amber-500/30">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-yellow-500/15 dark:from-amber-500/25 dark:via-orange-500/15 dark:to-yellow-500/20"
            />
            <CardHeader className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo brandId={brand.id} title={brand.name} size={44} className="rounded-lg" />
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <span>{brand.name}</span>
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
                    >
                      Kampanyalar
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Bonus, turnuva, landing ve promo kod kampanyaları
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="relative gap-1.5"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCcw size={14} />
                )}
                Yenile
              </Button>
            </CardHeader>
            <CardContent className="relative pt-0">
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Aktif" value={String(stats.active)} />
                <Kpi label="Taslak" value={String(stats.draft)} />
                <Kpi label="Toplam" value={String(stats.total)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap size={16} className="text-amber-600 dark:text-amber-400" />
                Kampanya listesi
              </CardTitle>
              <CardDescription>
                {campaigns.length === 0
                  ? "Henüz kampanya kaydı yok"
                  : `${campaigns.length} kampanya · ${stats.active} aktif`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && campaigns.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Promo kod, landing varyantları ve bonus kampanyalarını buradan yönetin.
                </p>
              ) : (
                <ul className="space-y-2">
                  {campaigns.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                        disabled={!canWrite}
                        onClick={() => canWrite && startEdit(c)}
                      >
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {CAMPAIGN_TYPE_LABELS[c.campaignType]}
                          {c.promoCode ? ` · ${c.promoCode}` : ""}
                          {(c.startDate || c.endDate) &&
                            ` · ${fmtDateOnly(c.startDate)} – ${fmtDateOnly(c.endDate)}`}
                          {c.budgetUsd != null && c.budgetUsd > 0
                            ? ` · ${fmtBrandMoney(c.budgetUsd, "USD")}`
                            : ""}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </Badge>
                        {canWrite && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            onClick={() => void handleDelete(c)}
                            title="Sil"
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canWrite && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PlusCircle size={16} className="text-amber-600 dark:text-amber-400" />
                  {editId ? "Kampanyayı düzenle" : "Yeni kampanya"}
                </CardTitle>
                <CardDescription>
                  Yeni kampanya ekleyin veya listeden bir kayda tıklayarak düzenleyin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field label="Kampanya adı" required>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Örn. Hoş geldin bonusu Q2"
                      required
                    />
                  </Field>
                  <FormGrid>
                    <Field label="Tip">
                      <Select
                        value={form.campaignType}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            campaignType: e.target.value as BrandCampaign["campaignType"],
                          }))
                        }
                        options={Object.entries(CAMPAIGN_TYPE_LABELS).map(([v, l]) => ({
                          value: v,
                          label: l,
                        }))}
                      />
                    </Field>
                    <Field label="Durum">
                      <Select
                        value={form.status}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            status: e.target.value as BrandCampaign["status"],
                          }))
                        }
                        options={Object.entries(CAMPAIGN_STATUS_LABELS).map(([v, l]) => ({
                          value: v,
                          label: l,
                        }))}
                      />
                    </Field>
                    <Field label="Promo kod">
                      <Input
                        value={form.promoCode}
                        onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value }))}
                        placeholder="WELCOME100"
                      />
                    </Field>
                    <Field label="Bütçe (USD)">
                      <NumberInput
                        value={form.budgetUsd}
                        onChange={(v) => setForm((f) => ({ ...f, budgetUsd: v }))}
                        min={0}
                      />
                    </Field>
                    <Field label="Başlangıç">
                      <Input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      />
                    </Field>
                    <Field label="Bitiş">
                      <Input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                      />
                    </Field>
                  </FormGrid>
                  <Field label="Notlar">
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Kurallar, hedef kitle veya operatör notları"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={busy || !form.name.trim()}>
                      {busy ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Kaydediliyor…
                        </>
                      ) : (
                        <>
                          <PlusCircle size={14} /> {editId ? "Güncelle" : "Kampanya oluştur"}
                        </>
                      )}
                    </Button>
                    {editId && (
                      <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                        İptal
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </MarkaPageGuard>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/80 px-3 py-2 backdrop-blur">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
