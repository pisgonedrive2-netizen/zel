"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Loader2, RefreshCcw, Pencil, Trash2, KeyRound, Copy, Check,
  ShieldCheck, Crown, Eye, Power, PowerOff,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useStore } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { fmtDateShort } from "@/lib/fmt-date";
import { cn } from "@/lib/utils";
import {
  fetchTeam, createTeamMember, updateTeamMember, removeTeamMember, type TeamResponse,
} from "@/lib/brand-team-api";
import type { OrgTeamMember } from "@/lib/db/org-team-repo";
import { clientCanManageTeam } from "@/lib/org-capability";
import {
  ASSIGNABLE_ORG_ROLES, ORG_ROLE_LABELS, ORG_ROLE_DESCRIPTIONS, READ_ONLY_ORG_ROLES,
} from "@/lib/org-roles";
import type { OrgRole } from "@/store/store";
import { MarkaStatGrid } from "@/components/marka/marka-stat-grid";
import { computeTeamInsights } from "@/lib/marka-brand-insights";
import { fmtBrandCount } from "@/lib/brand-monthly-stats";

const ROLE_BADGE: Record<string, string> = {
  owner: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  admin: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/45 dark:bg-violet-950/40 dark:text-violet-300",
  finance: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-950/40 dark:text-emerald-300",
  marketing: "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/45 dark:bg-pink-950/40 dark:text-pink-300",
  hr: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  auditor: "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/45 dark:bg-purple-950/40 dark:text-purple-300",
  viewer: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
};

interface CreateForm {
  name: string;
  username: string;
  orgRole: OrgRole;
  title: string;
  scopeAllBrands: boolean;
  brandIds: string[];
}

const emptyCreate: CreateForm = {
  name: "",
  username: "",
  orgRole: "viewer",
  title: "",
  scopeAllBrands: true,
  brandIds: [],
};

function OrgRolePicker({
  value,
  onChange,
}: {
  value: OrgRole;
  onChange: (r: OrgRole) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ASSIGNABLE_ORG_ROLES.map((r) => {
        const active = value === r;
        const readonly = READ_ONLY_ORG_ROLES.has(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            aria-pressed={active}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition",
              active
                ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-foreground/25 hover:bg-accent/40"
            )}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {ORG_ROLE_LABELS[r]}
                {readonly && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1 text-[9px] font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                    <Eye size={9} /> salt-okunur
                  </span>
                )}
              </span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                {ORG_ROLE_DESCRIPTIONS[r]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PinResultBox({ username, pin }: { username: string; pin: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/40 px-4 py-3 text-center dark:border-blue-500/45 dark:bg-blue-950/30">
        <p className="text-[11px] text-muted-foreground">Kullanıcı adı</p>
        <p className="mb-2 font-mono text-sm">{username}</p>
        <p className="text-[11px] text-muted-foreground">PIN</p>
        <p className="font-mono text-xl font-bold tracking-wider text-foreground">{pin}</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
        Bu PIN bir daha gösterilmez. Üyeye güvenli şekilde iletin.
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-1.5"
        onClick={async () => {
          await navigator.clipboard.writeText(`Kullanıcı adı: ${username}\nPIN: ${pin}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        {copied ? "Kopyalandı" : "Kullanıcı adı + PIN kopyala"}
      </Button>
    </div>
  );
}

export default function MarkaEkipPage() {
  const { user, brandId, brand, canViewBrand } = useMarkaPortal();
  const allBrands = useStore((s) => s.brands);
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate);
  const [busy, setBusy] = useState(false);
  const [pinResult, setPinResult] = useState<{ username: string; pin: string } | null>(null);

  const [editMember, setEditMember] = useState<OrgTeamMember | null>(null);
  const [editRole, setEditRole] = useState<OrgRole>("viewer");
  const [editTitle, setEditTitle] = useState("");

  const canManage = data?.canManage ?? clientCanManageTeam(user?.orgRole);
  const orgBrandIds = data?.brandIds ?? [];
  const brandName = useCallback(
    (id: string) => allBrands.find((b) => b.id === id)?.shortName ?? allBrands.find((b) => b.id === id)?.name ?? id,
    [allBrands]
  );

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTeam(brandId));
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

  const teamInsights = useMemo(
    () => computeTeamInsights(data?.members ?? []),
    [data?.members]
  );

  const topRoles = useMemo(() => {
    const entries = Object.entries(teamInsights.roleCounts).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 2).map(([r, n]) => `${ORG_ROLE_LABELS[r as OrgRole] ?? r}: ${n}`).join(" · ");
  }, [teamInsights.roleCounts]);

  const members = useMemo(
    () => (data?.members ?? []).slice().sort((a, b) => {
      const order: Record<string, number> = { owner: 0, admin: 1, finance: 2, hr: 3, marketing: 4, auditor: 5, viewer: 6 };
      const d = (order[a.orgRole] ?? 9) - (order[b.orgRole] ?? 9);
      if (d !== 0) return d;
      return (a.user?.name ?? "").localeCompare(b.user?.name ?? "", "tr");
    }),
    [data]
  );

  const openCreate = () => {
    setCreateForm({ ...emptyCreate, brandIds: brandId ? [brandId] : [] });
    setCreateOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createTeamMember({
        name: createForm.name.trim(),
        username: createForm.username.trim() || undefined,
        orgRole: createForm.orgRole,
        title: createForm.title.trim() || undefined,
        scopeAllBrands: createForm.scopeAllBrands,
        brandIds: createForm.scopeAllBrands ? undefined : createForm.brandIds,
      });
      setCreateOpen(false);
      setPinResult({ username: res.username, pin: res.plainPin });
      setToast("Ekip üyesi oluşturuldu");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (m: OrgTeamMember) => {
    setEditMember(m);
    setEditRole(m.orgRole);
    setEditTitle(m.title);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setBusy(true);
    setError(null);
    try {
      await updateTeamMember({
        memberId: editMember.memberId,
        orgRole: editMember.orgRole === "owner" ? undefined : editRole,
        title: editTitle.trim(),
      });
      setEditMember(null);
      setToast("Üye güncellendi");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (m: OrgTeamMember) => {
    try {
      await updateTeamMember({ memberId: m.memberId, active: !(m.user?.active ?? true) });
      setToast(m.user?.active ? "Üye pasifleştirildi" : "Üye aktifleştirildi");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "İşlem başarısız");
    }
  };

  const resetPin = async (m: OrgTeamMember) => {
    try {
      const res = await updateTeamMember({ memberId: m.memberId, resetPin: true });
      if (res.plainPin && m.user) setPinResult({ username: m.user.username, pin: res.plainPin });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "PIN sıfırlanamadı");
    }
  };

  const remove = async (m: OrgTeamMember) => {
    if (!confirm(`${m.user?.name ?? "Üye"} ekipten kaldırılsın mı? Kullanıcı pasifleştirilir.`)) return;
    try {
      await removeTeamMember(m.memberId);
      setToast("Üye kaldırıldı");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaldırılamadı");
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Users size={22} /> Ekip & yetkiler
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name} ekibini yönetin · yönetici, denetçi ve modül rolleri
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {canManage && (
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus size={14} /> Ekip üyesi ekle
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
        {!canManage && (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-100">
            Ekip yönetimi yalnızca marka sahibi ve yöneticilerinde açıktır. Bu listeyi görüntüleyebilirsiniz.
          </div>
        )}

        <MarkaStatGrid
          columns={4}
          items={[
            {
              label: "Üye",
              value: fmtBrandCount(teamInsights.total),
              sub: `${teamInsights.active} aktif`,
              icon: <Users size={18} />,
              tone: "primary",
            },
            {
              label: "Salt okunur",
              value: fmtBrandCount(teamInsights.readOnly),
              sub: "denetçi / görüntüleyici",
              icon: <Eye size={18} />,
              tone: "violet",
            },
            {
              label: "Rol dağılımı",
              value: fmtBrandCount(Object.keys(teamInsights.roleCounts).length),
              sub: topRoles || "—",
              icon: <ShieldCheck size={18} />,
              tone: "blue",
            },
            {
              label: "Marka kapsamı",
              value: fmtBrandCount(orgBrandIds.length),
              sub: `${orgBrandIds.length} marka erişimi`,
              icon: <Crown size={18} />,
              tone: "amber",
            },
          ]}
        />

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2">
              Ekip üyeleri
              <Badge variant="outline" className="text-[10px] tabular-nums">{members.length}</Badge>
            </CardTitle>
            <CardDescription>
              Platform yöneticisi (Foxstream) en üst yetkidir. Marka sahibi kendi ekibini ve denetçilerini buradan yönetir.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading && members.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 size={22} className="mx-auto animate-spin opacity-50" />
                <p className="mt-2 text-sm">Yükleniyor…</p>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <Users size={28} className="opacity-30" />
                <p className="text-sm">Henüz ekip üyesi yok.</p>
                {canManage && (
                  <Button size="sm" className="mt-1 gap-1.5" onClick={openCreate}>
                    <Plus size={14} /> İlk üyeyi ekle
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Üye", "Rol", "Erişim", "Son giriş", "Durum", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const active = m.user?.active ?? true;
                      const isOwner = m.orgRole === "owner";
                      return (
                        <tr key={m.memberId} className="border-b border-border/60 transition-colors hover:bg-accent/15">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {m.user?.avatar || m.user?.name?.slice(0, 1).toUpperCase() || "?"}
                              </span>
                              <span>
                                <span className="flex items-center gap-1.5 font-medium text-foreground">
                                  {m.user?.name ?? "—"}
                                  {isOwner && <Crown size={12} className="text-blue-600 dark:text-blue-400" />}
                                </span>
                                <span className="block font-mono text-xs text-muted-foreground">{m.user?.username}</span>
                                {m.title && <span className="block text-[11px] text-muted-foreground">{m.title}</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[m.orgRole] ?? ""}`}>
                              {READ_ONLY_ORG_ROLES.has(m.orgRole) && <Eye size={9} className="mr-0.5" />}
                              {ORG_ROLE_LABELS[m.orgRole] ?? m.orgRole}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {m.scopeAllBrands
                              ? "Tüm markalar"
                              : m.brandIds.length === 0
                                ? "—"
                                : m.brandIds.map(brandName).join(", ")}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {m.user?.lastLoginAt ? fmtDateShort(m.user.lastLoginAt) : <span className="opacity-50">henüz yok</span>}
                          </td>
                          <td className="px-3 py-3">
                            {active ? (
                              <Badge variant="outline" className="gap-1 text-[10px] text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40">
                                <Power size={9} /> Aktif
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-[10px] text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40">
                                <PowerOff size={9} /> Pasif
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {canManage && (
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void resetPin(m)} aria-label="PIN sıfırla" title="PIN sıfırla">
                                  <KeyRound size={14} />
                                </Button>
                                {!isOwner && (
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void toggleActive(m)} aria-label="Aktif/pasif" title={active ? "Pasifleştir" : "Aktifleştir"}>
                                    {active ? <PowerOff size={14} /> : <Power size={14} />}
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(m)} aria-label="Düzenle" title="Düzenle">
                                  <Pencil size={14} />
                                </Button>
                                {!isOwner && (
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(m)} aria-label="Kaldır" title="Kaldır">
                                    <Trash2 size={14} />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 dark:border-blue-500/40 dark:bg-blue-950/35">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-blue-900 dark:text-blue-100">
            <ShieldCheck size={13} /> Yetki hiyerarşisi
          </p>
          <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200/90">
            <strong>Foxstream platform yöneticisi</strong> en üst yetkidir; tüm markaları görür ve yönetir.
            <strong> Marka sahibi</strong> ve <strong>yönetici</strong> kendi ekibini kurar.
            <strong> Denetçi</strong> tüm marka verisini görür ama değiştiremez (salt-okunur).
            İşlevsel roller (muhasebe, İK, pazarlama) yalnızca kendi modüllerini görür.
          </p>
        </div>
      </div>

      {/* Yeni üye */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni ekip üyesi" size="lg">
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad Soyad" required>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required autoFocus placeholder="Ad Soyad" />
            </Field>
            <Field label="Kullanıcı adı" hint="Boş bırakılırsa otomatik üretilir">
              <Input value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value.toLowerCase().trim() }))} placeholder="otomatik" />
            </Field>
          </div>
          <Field label="Unvan (opsiyonel)">
            <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ör. Finans müdürü" />
          </Field>
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-foreground">Rol & yetki</p>
            <OrgRolePicker value={createForm.orgRole} onChange={(r) => setCreateForm((f) => ({ ...f, orgRole: r }))} />
          </div>
          {orgBrandIds.length > 1 && (
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.scopeAllBrands}
                  onChange={(e) => setCreateForm((f) => ({ ...f, scopeAllBrands: e.target.checked }))}
                />
                Tüm markalara erişim
              </label>
              {!createForm.scopeAllBrands && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {orgBrandIds.map((id) => {
                    const on = createForm.brandIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setCreateForm((f) => ({
                            ...f,
                            brandIds: on ? f.brandIds.filter((x) => x !== id) : [...f.brandIds, id],
                          }))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          on ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                        )}
                      >
                        {brandName(id)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button type="submit" disabled={busy || !createForm.name.trim()}>
              {busy ? "Oluşturuluyor..." : "Üye oluştur"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Düzenle */}
      <Modal open={editMember !== null} onClose={() => setEditMember(null)} title="Üyeyi düzenle" size="lg">
        {editMember && (
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{editMember.user?.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{editMember.user?.username}</span>
            </div>
            <Field label="Unvan">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Ör. Finans müdürü" />
            </Field>
            {editMember.orgRole === "owner" ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/35 dark:text-blue-100">
                Marka sahibinin rolü değiştirilemez.
              </div>
            ) : (
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-foreground">Rol & yetki</p>
                <OrgRolePicker value={editRole} onChange={setEditRole} />
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditMember(null)}>İptal</Button>
              <Button type="submit" disabled={busy}>{busy ? "Kaydediliyor..." : "Kaydet"}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* PIN sonucu */}
      <Modal open={pinResult !== null} onClose={() => setPinResult(null)} title="Giriş bilgileri hazır" size="md">
        {pinResult && <PinResultBox username={pinResult.username} pin={pinResult.pin} />}
      </Modal>
    </MarkaPageGuard>
  );
}
