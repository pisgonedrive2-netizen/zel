"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield, Plus, Loader2, RefreshCcw, Pencil } from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { fetchComplianceChecks, saveComplianceCheck } from "@/lib/brand-igaming-api";
import {
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_TYPE_LABELS,
  type BrandComplianceCheck,
} from "@/types/brand-igaming";

const emptyForm = {
  id: "", checkType: "kyc" as BrandComplianceCheck["checkType"], status: "pending" as BrandComplianceCheck["status"],
  dueDate: "", evidenceUrl: "", notes: "",
};

const STATUS_CLS: Record<BrandComplianceCheck["status"], string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  passed: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  failed: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
  waived: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
};

export default function MarkaUyumlulukPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [checks, setChecks] = useState<BrandComplianceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      setChecks(await fetchComplianceChecks(brandId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    pending: checks.filter((c) => c.status === "pending").length,
    passed: checks.filter((c) => c.status === "passed").length,
    failed: checks.filter((c) => c.status === "failed").length,
  }), [checks]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) return;
    setBusy(true);
    try {
      await saveComplianceCheck({
        ...form,
        id: form.id || undefined,
        brandId,
        dueDate: form.dueDate || undefined,
        evidenceUrl: form.evidenceUrl.trim() || undefined,
      });
      setOpen(false);
      setForm(emptyForm);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1100px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Shield size={22} /> Uyumluluk merkezi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name ? `${brand.name} · ` : ""}KYC, geo, sorumlu oyun ve lisans kontrolleri
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && <Button size="sm" onClick={() => { setForm(emptyForm); setOpen(true); }}><Plus size={14} /> Kontrol ekle</Button>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="py-3 text-center"><p className="text-xs text-muted-foreground">Bekleyen</p><p className="text-xl font-bold text-amber-600">{stats.pending}</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-xs text-muted-foreground">Geçti</p><p className="text-xl font-bold text-green-600">{stats.passed}</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-xs text-muted-foreground">Başarısız</p><p className="text-xl font-bold text-red-600">{stats.failed}</p></CardContent></Card>
        </div>
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
        {loading && checks.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Loader2 className="mx-auto animate-spin opacity-50" /></CardContent></Card>
        ) : checks.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Henüz uyumluluk kaydı yok.</CardContent></Card>
        ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {checks.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{COMPLIANCE_TYPE_LABELS[c.checkType]}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.dueDate ? `Vade: ${c.dueDate}` : "Vade yok"}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLS[c.status]}`}>
                      {COMPLIANCE_STATUS_LABELS[c.status]}
                    </Badge>
                    {!readOnly && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setForm({
                            id: c.id,
                            checkType: c.checkType,
                            status: c.status,
                            dueDate: c.dueDate ?? "",
                            evidenceUrl: c.evidenceUrl ?? "",
                            notes: c.notes,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Kontrolü düzenle" : "Yeni uyumluluk kontrolü"}
        size="md"
      >
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <Field label="Tip">
              <Select value={form.checkType} onChange={(e) => setForm((f) => ({ ...f, checkType: e.target.value as BrandComplianceCheck["checkType"] }))}
                options={Object.entries(COMPLIANCE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </Field>
            <Field label="Durum">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BrandComplianceCheck["status"] }))}
                options={Object.entries(COMPLIANCE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </Field>
            <Field label="Vade"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
            <Field label="Kanıt URL"><Input value={form.evidenceUrl} onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))} placeholder="https://..." /></Field>
          </FormGrid>
          <Field label="Notlar"><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
          <FormActions onCancel={() => setOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
