"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Check, Eye, Loader2, Save, Target } from "lucide-react";
import { useStore } from "@/store/store";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { BrandLogo } from "@/components/brand-logo";
import { markaHref } from "@/lib/use-marka-view-month";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, FormGrid } from "@/components/ui/field";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-green-50 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-500/45" },
  paused: { label: "Duraklatıldı", cls: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/45" },
  inactive: { label: "Pasif", cls: "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-900/60 dark:text-zinc-400 dark:border-zinc-700" },
};

export default function MarkaProfilPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, month, canViewBrand, isAdminView } = portal;
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const updateBrand = useStore((s) => s.updateBrand);

  const [form, setForm] = useState({ name: "", shortName: "", category: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brand) {
      setForm({
        name: brand.name ?? "",
        shortName: brand.shortName ?? "",
        category: brand.category ?? "",
        notes: brand.notes ?? "",
      });
    }
  }, [brand]);

  const dirty = useMemo(() => {
    if (!brand) return false;
    return (
      form.name.trim() !== (brand.name ?? "") ||
      form.shortName.trim() !== (brand.shortName ?? "") ||
      form.category.trim() !== (brand.category ?? "") ||
      form.notes !== (brand.notes ?? "")
    );
  }, [form, brand]);

  const set = <K extends keyof typeof form>(k: K, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    if (!brandId || !brand) return;
    if (!form.name.trim()) {
      setError("Marka adı boş olamaz");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marka/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          name: form.name.trim(),
          shortName: form.shortName.trim(),
          category: form.category.trim(),
          notes: form.notes,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Kayıt başarısız");
      }
      updateBrand(brandId, {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        category: form.category.trim(),
        notes: form.notes,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setBusy(false);
    }
  };

  const status = brand ? STATUS_LABEL[brand.status] ?? STATUS_LABEL.inactive : STATUS_LABEL.inactive;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      {brand && brandId && (
        <div className="mx-auto max-w-[860px] space-y-6 pb-10">
          {/* Başlık */}
          <div className="flex items-center gap-3">
            <BrandLogo brandId={brand.id} title={brand.name} size={48} className="rounded-xl" />
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Building2 size={18} className="text-muted-foreground" />
                Marka profili
              </h1>
              <p className="text-sm text-muted-foreground">
                Markanızın temel bilgilerini güncelleyin. Değişiklikler tüm panellere yansır.
              </p>
            </div>
          </div>

          {/* Durum & hedef özeti */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Durum</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className={status.cls}>
                  {status.label}
                </Badge>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Durumu yönetici değiştirebilir.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs flex items-center gap-1">
                  <Target size={12} /> Aylık hedef
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {brand.monthlyTarget ? fmtCompactViews(brand.monthlyTarget) : "—"}
                </p>
                <Link
                  href={markaHref("/marka/izlenmeler", month)}
                  className="text-[11px] text-primary underline"
                >
                  İzlenmeler sayfasından düzenle
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs flex items-center gap-1">
                  <Eye size={12} /> Kısa kod
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-foreground">{brand.shortName || "—"}</p>
                <p className="text-[11px] text-muted-foreground">Raporlarda kullanılır.</p>
              </CardContent>
            </Card>
          </div>

          {/* Düzenleme formu */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Temel bilgiler</CardTitle>
              <CardDescription>Ad, kısa kod, kategori ve marka notları.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormGrid>
                <Field label="Marka adı" required>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Örn. Galabet"
                    required
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Kısa kod" hint="Raporlarda/grafiklerde görünen kısaltma.">
                  <Input
                    value={form.shortName}
                    onChange={(e) => set("shortName", e.target.value)}
                    placeholder="Örn. Gala"
                    disabled={readOnly}
                  />
                </Field>
              </FormGrid>
              <Field label="Kategori" hint="Örn. Bahis, Casino, E-ticaret.">
                <Input
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Sektör / kategori"
                  disabled={readOnly}
                />
              </Field>
              <Field label="Notlar" hint="Ekip içi notlar — yalnızca panelde görünür.">
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Markaya dair iç notlar..."
                  rows={4}
                  disabled={readOnly}
                />
              </Field>

              {readOnly && (
                <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Hesabınız salt-okunur — değişiklik kaydedemezsiniz.
                </p>
              )}

              {error && (
                <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </p>
              )}

              {!readOnly && (
                <div className="flex items-center justify-end gap-2">
                  {saved && !dirty && (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <Check size={14} /> Kaydedildi
                    </span>
                  )}
                  <Button type="button" onClick={() => void save()} disabled={busy || !dirty} className="gap-1.5">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Kaydet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </MarkaPageGuard>
  );
}
