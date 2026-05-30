"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Plus, Loader2, RefreshCcw, Pencil, Trash2, Mail, Phone, ArrowUpRight, Wallet,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import {
  fetchStaff, saveStaff, deleteStaff,
} from "@/lib/brand-personnel-api";
import {
  STAFF_STATUS_LABELS,
  type BrandStaff,
  type StaffCurrency,
  type StaffStatus,
} from "@/types/brand-personnel";

const CUR_SYMBOL: Record<StaffCurrency, string> = { USD: "$", EUR: "€", TRY: "₺" };
const STATUS_CLS: Record<StaffStatus, string> = {
  active: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  passive: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  invited: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
};

const emptyForm = {
  id: "",
  name: "",
  role: "",
  email: "",
  phone: "",
  status: "active" as StaffStatus,
  monthlyCost: 0,
  currency: "USD" as StaffCurrency,
  notes: "",
};

export default function MarkaPersonelPage() {
  const { user, brandId, brand, canViewBrand } = useMarkaPortal();
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      setStaff(await fetchStaff(brandId));
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

  const totals = useMemo(() => {
    const active = staff.filter((s) => s.status === "active");
    const byCur: Record<string, number> = {};
    for (const s of active) byCur[s.currency] = (byCur[s.currency] ?? 0) + s.monthlyCost;
    return { count: staff.length, activeCount: active.length, byCur };
  }, [staff]);

  const openNew = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (s: BrandStaff) => {
    setForm({
      id: s.id,
      name: s.name,
      role: s.role,
      email: s.email ?? "",
      phone: s.phone ?? "",
      status: s.status,
      monthlyCost: s.monthlyCost,
      currency: s.currency,
      notes: s.notes,
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !form.name.trim()) return;
    setBusy(true);
    try {
      await saveStaff({
        id: form.id || undefined,
        brandId,
        name: form.name.trim(),
        role: form.role.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        status: form.status,
        monthlyCost: form.monthlyCost,
        currency: form.currency,
        notes: form.notes,
      });
      setToast(form.id ? "Personel güncellendi" : "Personel eklendi");
      setModalOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: BrandStaff) => {
    if (!confirm(`${s.name} silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      await deleteStaff(s.id);
      setToast("Personel silindi");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Users size={22} /> Personel
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name} ekibini yönetin · {totals.activeCount} aktif / {totals.count} toplam
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus size={14} /> Personel ekle
            </Button>
          </div>
        </div>

        {toast && (
          <div className="rounded-lg border border-emerald-500/45 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">{toast}</div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* Aylık maliyet özeti */}
        {Object.keys(totals.byCur).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(totals.byCur) as [StaffCurrency, number][]).map(([cur, amt]) => (
              <Card key={cur}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aylık maliyet ({cur})</p>
                    <p className="text-lg font-bold tabular-nums">
                      {CUR_SYMBOL[cur]}{amt.toLocaleString("tr-TR")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Ekip listesi</CardTitle>
            <CardDescription>Personel kartına tıklayarak görev, vardiya ve aktiviteleri görün.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading && staff.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 size={22} className="mx-auto animate-spin opacity-50" />
                <p className="mt-2 text-sm">Yükleniyor…</p>
              </div>
            ) : staff.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <Users size={28} className="opacity-30" />
                <p className="text-sm">Henüz personel eklenmemiş.</p>
                <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}>
                  <Plus size={14} /> İlk personeli ekle
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Personel", "İletişim", "Aylık maliyet", "Durum", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id} className="border-b border-border/60 transition-colors hover:bg-accent/15">
                        <td className="px-3 py-3">
                          <Link href={`/marka/personel/${s.id}`} className="group flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {s.avatar || s.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                              <span className="flex items-center gap-1 font-medium text-foreground group-hover:underline">
                                {s.name} <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-60" />
                              </span>
                              {s.role && <span className="block text-xs text-muted-foreground">{s.role}</span>}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            {s.email && <span className="flex items-center gap-1"><Mail size={11} /> {s.email}</span>}
                            {s.phone && <span className="flex items-center gap-1"><Phone size={11} /> {s.phone}</span>}
                            {!s.email && !s.phone && "—"}
                          </div>
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {s.monthlyCost > 0 ? `${CUR_SYMBOL[s.currency]}${s.monthlyCost.toLocaleString("tr-TR")}` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_CLS[s.status]}`}>
                            {STAFF_STATUS_LABELS[s.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="Düzenle">
                              <Pencil size={14} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(s)} aria-label="Sil">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Personeli düzenle" : "Yeni personel"} size="md">
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <Field label="Ad soyad" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </Field>
            <Field label="Rol / unvan">
              <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Ör. Sosyal medya uzmanı" />
            </Field>
            <Field label="E-posta">
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Telefon">
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Aylık maliyet">
              <NumberInput value={form.monthlyCost} onChange={(v) => setForm((f) => ({ ...f, monthlyCost: v }))} min={0} />
            </Field>
            <Field label="Para birimi">
              <Select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as StaffCurrency }))}
                options={[{ value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "TRY", label: "TRY (₺)" }]}
              />
            </Field>
            <Field label="Durum">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StaffStatus }))}
                options={[{ value: "active", label: "Aktif" }, { value: "passive", label: "Pasif" }, { value: "invited", label: "Davetli" }]}
              />
            </Field>
          </FormGrid>
          <Field label="Notlar">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </Field>
          <FormActions onCancel={() => setModalOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
