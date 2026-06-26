"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone, Plus, Loader2, RefreshCcw, Pin, PinOff, Trash2, Pencil,
  Info, AlertTriangle, AlertOctagon,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormActions } from "@/components/ui/field";
import { fetchStaff, fetchAnnouncements, saveAnnouncement, deleteAnnouncement } from "@/lib/brand-personnel-api";
import { fetchDepartments } from "@/lib/brand-payroll-api";
import {
  ANNOUNCEMENT_AUDIENCE_LABELS, ANNOUNCEMENT_LEVEL_LABELS,
  type AnnouncementAudience, type AnnouncementLevel,
  type BrandDepartment, type BrandStaff, type BrandStaffAnnouncement,
} from "@/types/brand-personnel";

const LEVEL_CLS: Record<AnnouncementLevel, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  warning: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  urgent: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
};

function LevelIcon({ level, size = 14 }: { level: AnnouncementLevel; size?: number }) {
  if (level === "urgent") return <AlertOctagon size={size} className="text-red-600 dark:text-red-400" />;
  if (level === "warning") return <AlertTriangle size={size} className="text-amber-600 dark:text-amber-400" />;
  return <Info size={size} className="text-blue-600 dark:text-blue-400" />;
}

const emptyForm = {
  id: "",
  title: "",
  body: "",
  audience: "all" as AnnouncementAudience,
  departmentId: "",
  staffId: "",
  level: "info" as AnnouncementLevel,
  pinned: false,
};

export default function MarkaDuyurularPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [items, setItems] = useState<BrandStaffAnnouncement[]>([]);
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [departments, setDepartments] = useState<BrandDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, s, d] = await Promise.all([
        fetchAnnouncements(brandId),
        fetchStaff(brandId).catch(() => [] as BrandStaff[]),
        fetchDepartments(brandId).catch(() => [] as BrandDepartment[]),
      ]);
      setItems(a);
      setStaff(s);
      setDepartments(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffName = useCallback((id?: string) => staff.find((s) => s.id === id)?.name ?? "—", [staff]);
  const deptName = useCallback((id?: string) => departments.find((d) => d.id === id)?.name ?? "—", [departments]);

  const audienceLabel = useCallback((a: BrandStaffAnnouncement) => {
    if (a.audience === "department") return `Departman · ${deptName(a.departmentId)}`;
    if (a.audience === "staff") return `Kişi · ${staffName(a.staffId)}`;
    return "Tüm ekip";
  }, [deptName, staffName]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items]);

  const openNew = () => { setForm(emptyForm); setModalOpen(true); };
  const openEdit = (a: BrandStaffAnnouncement) => {
    setForm({
      id: a.id, title: a.title, body: a.body, audience: a.audience,
      departmentId: a.departmentId ?? "", staffId: a.staffId ?? "",
      level: a.level, pinned: a.pinned,
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !form.title.trim()) return;
    setBusy(true);
    try {
      await saveAnnouncement({
        id: form.id || undefined,
        brandId,
        title: form.title.trim(),
        body: form.body,
        audience: form.audience,
        departmentId: form.audience === "department" ? form.departmentId || undefined : undefined,
        staffId: form.audience === "staff" ? form.staffId || undefined : undefined,
        level: form.level,
        pinned: form.pinned,
      });
      setModalOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (a: BrandStaffAnnouncement) => {
    try {
      await saveAnnouncement({ ...a, pinned: !a.pinned });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };

  const remove = async (a: BrandStaffAnnouncement) => {
    if (!confirm(`"${a.title}" duyurusu silinsin mi?`)) return;
    try {
      await deleteAnnouncement(a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[900px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Megaphone size={22} /> Personel duyuruları
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name} ekibine bilgilendirme, uyarı ve duyuru paylaşın
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={openNew}><Plus size={14} /> Duyuru ekle</Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {loading && items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /><p className="mt-2 text-sm">Yükleniyor…</p></CardContent></Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Megaphone size={28} className="opacity-30" />
              <p className="text-sm">Henüz duyuru yok.</p>
              {!readOnly && (
                <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}><Plus size={14} /> İlk duyuruyu ekle</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sorted.map((a) => (
              <Card key={a.id} className={a.pinned ? "border-primary/40" : undefined}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <LevelIcon level={a.level} size={16} />
                      <div>
                        <p className="flex items-center gap-1.5 font-semibold text-foreground">
                          {a.title}
                          {a.pinned && <Pin size={12} className="text-primary" />}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {audienceLabel(a)} · {a.createdByName || "—"} · {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${LEVEL_CLS[a.level]}`}>{ANNOUNCEMENT_LEVEL_LABELS[a.level]}</Badge>
                      {!readOnly && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void togglePin(a)} aria-label={a.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}>
                            {a.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)} aria-label="Düzenle">
                            <Pencil size={13} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(a)} aria-label="Sil">
                            <Trash2 size={13} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {a.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Duyuruyu düzenle" : "Yeni duyuru"} size="md">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Başlık" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required autoFocus placeholder="Ör. Bu hafta vardiya değişikliği" />
          </Field>
          <Field label="İçerik">
            <Textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={4} placeholder="Duyuru detayları…" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Önem">
              <Select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as AnnouncementLevel }))}
                options={(Object.keys(ANNOUNCEMENT_LEVEL_LABELS) as AnnouncementLevel[]).map((l) => ({ value: l, label: ANNOUNCEMENT_LEVEL_LABELS[l] }))}
              />
            </Field>
            <Field label="Hedef kitle">
              <Select
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as AnnouncementAudience }))}
                options={(Object.keys(ANNOUNCEMENT_AUDIENCE_LABELS) as AnnouncementAudience[]).map((a) => ({ value: a, label: ANNOUNCEMENT_AUDIENCE_LABELS[a] }))}
              />
            </Field>
          </div>
          {form.audience === "department" && (
            <Field label="Departman">
              <Select
                value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                options={[{ value: "", label: "Seçiniz" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              />
            </Field>
          )}
          {form.audience === "staff" && (
            <Field label="Personel">
              <Select
                value={form.staffId}
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                options={[{ value: "", label: "Seçiniz" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </Field>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} className="rounded border-border" />
            Üste sabitle
          </label>
          <FormActions onCancel={() => setModalOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
