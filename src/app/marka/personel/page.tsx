"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Plus, Loader2, RefreshCcw, Pencil, Trash2, Mail, Phone, ArrowUpRight, Wallet,
  Search, UserCheck, UserMinus, MailPlus, TrendingUp, X, Building2,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import {
  fetchStaff, saveStaff, deleteStaff,
} from "@/lib/brand-personnel-api";
import { fetchDepartments } from "@/lib/brand-payroll-api";
import {
  STAFF_STATUS_LABELS, STAFF_CURRENCY_SYMBOL,
  type BrandDepartment,
  type BrandStaff,
  type StaffCurrency,
  type StaffStatus,
} from "@/types/brand-personnel";

const STATUS_CLS: Record<StaffStatus, string> = {
  active: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  passive: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  invited: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
};

const fmtMoney = (cur: StaffCurrency, amt: number) =>
  `${STAFF_CURRENCY_SYMBOL[cur]}${Math.round(amt).toLocaleString("tr-TR")}`;

type StatusFilter = "all" | StaffStatus;

const emptyForm = {
  id: "",
  name: "",
  role: "",
  email: "",
  phone: "",
  status: "active" as StaffStatus,
  monthlyCost: 0,
  currency: "USD" as StaffCurrency,
  avatar: "",
  notes: "",
  departmentId: "",
  baseSalary: 0,
  rentSupport: 0,
  mealAllowance: 0,
};

export default function MarkaPersonelPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [departments, setDepartments] = useState<BrandDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, d] = await Promise.all([
        fetchStaff(brandId),
        fetchDepartments(brandId).catch(() => [] as BrandDepartment[]),
      ]);
      setStaff(s);
      setDepartments(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  const deptName = useCallback(
    (id?: string) => (id ? departments.find((d) => d.id === id)?.name ?? "Atanmadı" : "Atanmadı"),
    [departments]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const s of staff) if (s.role.trim()) set.add(s.role.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [staff]);

  const kpis = useMemo(() => {
    const counts = { active: 0, passive: 0, invited: 0 } as Record<StaffStatus, number>;
    const costByCur: Record<string, number> = {};
    const countByCur: Record<string, number> = {};
    for (const s of staff) {
      counts[s.status] += 1;
      if (s.status !== "passive" && s.monthlyCost > 0) {
        costByCur[s.currency] = (costByCur[s.currency] ?? 0) + s.monthlyCost;
        countByCur[s.currency] = (countByCur[s.currency] ?? 0) + 1;
      }
    }
    return { counts, costByCur, countByCur, total: staff.length };
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return staff.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (roleFilter !== "all" && (s.role.trim() || "Tanımsız") !== roleFilter) return false;
      if (!q) return true;
      return (
        s.name.toLocaleLowerCase("tr").includes(q) ||
        s.role.toLocaleLowerCase("tr").includes(q) ||
        (s.email ?? "").toLocaleLowerCase("tr").includes(q) ||
        (s.phone ?? "").toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [staff, search, statusFilter, roleFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BrandStaff[]>();
    for (const s of filtered) {
      const key = s.role.trim() || "Tanımsız";
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [filtered]);

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || roleFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRoleFilter("all");
  };

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
      avatar: s.avatar ?? "",
      notes: s.notes,
      departmentId: s.departmentId ?? "",
      baseSalary: s.baseSalary ?? 0,
      rentSupport: s.rentSupport ?? 0,
      mealAllowance: s.mealAllowance ?? 0,
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
        avatar: form.avatar.trim() || undefined,
        notes: form.notes,
        departmentId: form.departmentId || undefined,
        baseSalary: form.baseSalary,
        rentSupport: form.rentSupport,
        mealAllowance: form.mealAllowance,
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
              {brand?.name} ekibini yönetin · {kpis.counts.active} aktif / {kpis.total} toplam
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={openNew}>
                <Plus size={14} /> Personel ekle
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

        {/* Headcount KPI'ları */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<UserCheck size={18} />} tone="green" label="Aktif personel" value={String(kpis.counts.active)} />
          <KpiCard icon={<UserMinus size={18} />} tone="zinc" label="Pasif" value={String(kpis.counts.passive)} />
          <KpiCard icon={<MailPlus size={18} />} tone="amber" label="Davetli" value={String(kpis.counts.invited)} />
          <KpiCard
            icon={<Users size={18} />}
            tone="primary"
            label="Toplam kişi"
            value={String(kpis.total)}
            sub={roles.length > 0 ? `${roles.length} farklı rol` : undefined}
          />
        </div>

        {/* Maliyet özeti (para birimine göre) */}
        {Object.keys(kpis.costByCur).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(kpis.costByCur) as [StaffCurrency, number][]).map(([cur, amt]) => {
              const n = kpis.countByCur[cur] ?? 0;
              const avg = n > 0 ? amt / n : 0;
              return (
                <Card key={cur}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Wallet size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Aylık maliyet ({cur})</p>
                      <p className="text-lg font-bold tabular-nums">{fmtMoney(cur, amt)}</p>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <TrendingUp size={11} /> Ort. {fmtMoney(cur, avg)} · {n} kişi
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Arama + filtre */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim, rol, e-posta veya telefon ara…"
              className="pl-9"
              aria-label="Personel ara"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-auto min-w-[130px]"
            aria-label="Duruma göre filtrele"
            options={[
              { value: "all", label: "Tüm durumlar" },
              { value: "active", label: "Aktif" },
              { value: "passive", label: "Pasif" },
              { value: "invited", label: "Davetli" },
            ]}
          />
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-auto min-w-[140px]"
            aria-label="Role göre filtrele"
            options={[
              { value: "all", label: "Tüm roller" },
              ...roles.map((r) => ({ value: r, label: r })),
            ]}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
              <X size={13} /> Temizle
            </Button>
          )}
        </div>

        {/* Liste — role göre gruplu */}
        {loading && staff.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 size={22} className="mx-auto animate-spin opacity-50" />
              <p className="mt-2 text-sm">Yükleniyor…</p>
            </CardContent>
          </Card>
        ) : staff.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Users size={28} className="opacity-30" />
              <p className="text-sm">Henüz personel eklenmemiş.</p>
              {!readOnly && (
                <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}>
                  <Plus size={14} /> İlk personeli ekle
                </Button>
              )}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Search size={26} className="opacity-30" />
              <p className="text-sm">Filtreyle eşleşen personel yok.</p>
              <Button variant="outline" size="sm" className="mt-1 gap-1" onClick={clearFilters}>
                <X size={13} /> Filtreleri temizle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {grouped.map(([role, members]) => (
              <section key={role}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{role}</h2>
                  <Badge variant="outline" className="text-[10px] tabular-nums">{members.length}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((s) => (
                    <Card key={s.id} className="group relative transition-colors hover:border-primary/40">
                      <CardContent className="space-y-3 py-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                            {s.avatar || s.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/marka/personel/${s.id}`}
                              className="flex items-center gap-1 font-semibold text-foreground hover:underline"
                            >
                              <span className="truncate">{s.name}</span>
                              <ArrowUpRight size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                            </Link>
                            {s.role && <p className="truncate text-xs text-muted-foreground">{s.role}</p>}
                          </div>
                          <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_CLS[s.status]}`}>
                            {STAFF_STATUS_LABELS[s.status]}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          {s.email && (
                            <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                              <Mail size={12} /> <span className="truncate">{s.email}</span>
                            </a>
                          )}
                          {s.phone && (
                            <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                              <Phone size={12} /> {s.phone}
                            </a>
                          )}
                          {!s.email && !s.phone && <span>İletişim bilgisi yok</span>}
                          <span className="flex items-center gap-1.5">
                            <Building2 size={12} /> {deptName(s.departmentId)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                          <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                            <Wallet size={13} className="text-muted-foreground" />
                            {s.monthlyCost > 0 ? `${fmtMoney(s.currency, s.monthlyCost)}/ay` : "—"}
                          </span>
                          {!readOnly && (
                            <div className="flex gap-0.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)} aria-label="Düzenle">
                                <Pencil size={13} />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(s)} aria-label="Sil">
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
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
            <Field label="Departman">
              <Select
                value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                options={[
                  { value: "", label: "Atanmadı" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </Field>
            <Field label="Avatar (baş harfler)" hint="Boş bırakılırsa isimden üretilir.">
              <Input value={form.avatar} onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value.slice(0, 3) }))} placeholder="AB" maxLength={3} />
            </Field>
          </FormGrid>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="mb-2 text-[12px] font-medium text-muted-foreground">Maaş bileşenleri (bordro)</p>
            <FormGrid>
              <Field label="Baz maaş">
                <NumberInput value={form.baseSalary} onChange={(v) => setForm((f) => ({ ...f, baseSalary: v }))} min={0} />
              </Field>
              <Field label="Kira desteği">
                <NumberInput value={form.rentSupport} onChange={(v) => setForm((f) => ({ ...f, rentSupport: v }))} min={0} />
              </Field>
              <Field label="Yemek yardımı">
                <NumberInput value={form.mealAllowance} onChange={(v) => setForm((f) => ({ ...f, mealAllowance: v }))} min={0} />
              </Field>
            </FormGrid>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Bu alanlar aylık bordro hesabında baz olarak kullanılır. Aylık maliyet ({STAFF_CURRENCY_SYMBOL[form.currency]}) ana gösterge olarak kalır.
            </p>
          </div>
          <Field label="Notlar">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </Field>
          <FormActions onCancel={() => setModalOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}

function KpiCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "zinc" | "amber" | "primary";
}) {
  const toneCls: Record<string, string> = {
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
