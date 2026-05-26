"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { findDuplicateBrandLink } from "@/lib/brand-link-url";
import { SOCIAL_PLATFORMS, type Brand, type BrandLink, type Employee } from "@/store/store";

export function BrandLinkFormModal({
  open,
  onClose,
  brand,
  employees,
  initial,
  existingLinks,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  brand: Brand;
  employees: Employee[];
  initial?: BrandLink;
  existingLinks: BrandLink[];
  onSave: (d: Omit<BrandLink, "id">) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Omit<BrandLink, "id">>({
    brandId: brand.id,
    platform: "Instagram",
    handle: "",
    url: "",
    ownerId: undefined,
    status: "active",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      brandId: initial?.brandId ?? brand.id,
      platform: initial?.platform ?? "Instagram",
      handle: initial?.handle ?? "",
      url: initial?.url ?? "",
      ownerId: initial?.ownerId,
      status: initial?.status ?? "active",
      notes: initial?.notes ?? "",
      lastViews: initial?.lastViews,
      lastSnapshotDate: initial?.lastSnapshotDate,
      autoTrack: initial?.autoTrack,
      externalRef: initial?.externalRef,
    });
  }, [open, brand.id, initial]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Link düzenle" : "Yeni link ekle"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const dup = findDuplicateBrandLink(existingLinks, form.url, initial?.id, {
            brandId: brand.id,
          });
          if (dup) {
            window.alert(
              `Bu URL zaten bu marka için kayıtlı (${dup.platform}${dup.handle ? ` · ${dup.handle}` : ""}).`
            );
            return;
          }
          onSave(form);
          onClose();
        }}
      >
        <div className="grid gap-4">
          <FormGrid>
            <Field label="Platform" required>
              <Select
                value={form.platform}
                onChange={(e) => set("platform", e.target.value)}
                required
                options={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))}
              />
            </Field>
            <Field label="Yayıncı">
              <Select
                value={form.ownerId ?? ""}
                onChange={(e) => set("ownerId", e.target.value || undefined)}
                options={[
                  { value: "", label: "Atanmamış" },
                  ...employees.map((e) => ({ value: e.id, label: e.name })),
                ]}
              />
            </Field>
          </FormGrid>
          <Field label="Handle">
            <Input
              value={form.handle}
              onChange={(e) => set("handle", e.target.value)}
              placeholder="@hesap"
            />
          </Field>
          <Field label="URL">
            <Input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as BrandLink["status"])}
              options={[
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Pasif" },
              ]}
            />
          </Field>
          <Field label="Not">
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>
        </div>
        <FormActions
          onCancel={onClose}
          onDelete={onDelete}
          submitLabel={initial ? "Güncelle" : "Link ekle"}
        />
      </form>
    </Modal>
  );
}
