"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, Plus, Loader2, RefreshCcw, Pencil, Trash2, Users, UserCog,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormActions } from "@/components/ui/field";
import { fetchStaff } from "@/lib/brand-personnel-api";
import { fetchDepartments, saveDepartment, deleteDepartment } from "@/lib/brand-payroll-api";
import type { BrandDepartment, BrandStaff } from "@/types/brand-personnel";

const emptyForm = { id: "", name: "", description: "", leadStaffId: "" };

export default function MarkaDepartmanlarPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [departments, setDepartments] = useState<BrandDepartment[]>([]);
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, s] = await Promise.all([
        fetchDepartments(brandId),
        fetchStaff(brandId).catch(() => [] as BrandStaff[]),
      ]);
      setDepartments(d);
      setStaff(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const memberCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of staff) {
      if (!s.departmentId) continue;
      map.set(s.departmentId, (map.get(s.departmentId) ?? 0) + 1);
    }
    return map;
  }, [staff]);

  const unassigned = useMemo(
    () => staff.filter((s) => !s.departmentId).length,
    [staff]
  );

  const staffName = (id?: string) => (id ? staff.find((s) => s.id === id)?.name : undefined);

  const openNew = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (d: BrandDepartment) => {
    setForm({ id: d.id, name: d.name, description: d.description, leadStaffId: d.leadStaffId ?? "" });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !form.name.trim()) return;
    setBusy(true);
    try {
      await saveDepartment({
        id: form.id || undefined,
        brandId,
        name: form.name.trim(),
        description: form.description.trim(),
        leadStaffId: form.leadStaffId || undefined,
      });
      setToast(form.id ? "Departman güncellendi" : "Departman eklendi");
      setModalOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: BrandDepartment) => {
    const count = memberCount.get(d.id) ?? 0;
    const extra = count > 0 ? ` ${count} personel "Atanmadı" durumuna geçecek.` : "";
    if (!confirm(`${d.name} departmanı silinsin mi?${extra}`)) return;
    try {
      await deleteDepartment(d.id);
      setToast("Departman silindi");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1100px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Building2 size={22} /> Departmanlar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name} organizasyon yapısı · {departments.length} departman
              {unassigned > 0 && ` · ${unassigned} atanmamış personel`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={openNew}>
                <Plus size={14} /> Departman ekle
              </Button>
            )}
          </div>
        </div>

        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">{toast}</div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {loading && departments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 size={22} className="mx-auto animate-spin opacity-50" />
              <p className="mt-2 text-sm">Yükleniyor…</p>
            </CardContent>
          </Card>
        ) : departments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Building2 size={28} className="opacity-30" />
              <p className="text-sm">Henüz departman tanımlanmamış.</p>
              {!readOnly && (
                <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}>
                  <Plus size={14} /> İlk departmanı ekle
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => {
              const count = memberCount.get(d.id) ?? 0;
              const lead = staffName(d.leadStaffId);
              return (
                <Card key={d.id} className="group transition-colors hover:border-primary/40">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{d.name}</p>
                          <Badge variant="outline" className="mt-0.5 gap-1 text-[10px] tabular-nums">
                            <Users size={10} /> {count} kişi
                          </Badge>
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex shrink-0 gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(d)} aria-label="Düzenle">
                            <Pencil size={13} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(d)} aria-label="Sil">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {d.description && (
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                      <UserCog size={12} />
                      {lead ? <span>Yönetici: <span className="font-medium text-foreground">{lead}</span></span> : <span>Yönetici atanmadı</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Departmanı düzenle" : "Yeni departman"} size="md">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Departman adı" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus placeholder="Ör. Pazarlama" />
          </Field>
          <Field label="Açıklama">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Departmanın sorumluluk alanı" />
          </Field>
          <Field label="Departman yöneticisi">
            <Select
              value={form.leadStaffId}
              onChange={(e) => setForm((f) => ({ ...f, leadStaffId: e.target.value }))}
              options={[
                { value: "", label: "Atanmadı" },
                ...staff.map((s) => ({ value: s.id, label: s.role ? `${s.name} — ${s.role}` : s.name })),
              ]}
            />
          </Field>
          <FormActions onCancel={() => setModalOpen(false)} submitLabel={busy ? "Kaydediliyor..." : form.id ? "Güncelle" : "Departman ekle"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
