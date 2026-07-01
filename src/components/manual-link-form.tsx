"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { findDuplicateBrandLink } from "@/lib/brand-link-url";
import { linkSiteLabel } from "@/lib/link-snapshot-delta";
import { needsManualTracking } from "@/lib/link-tracking-mode";
import { SOCIAL_PLATFORMS, type Brand, type BrandLink, type Employee } from "@/store/store";

const MANUAL_PLATFORMS = ["Kick", "Twitter / X", "Twitch", "Telegram", "Discord", "Diğer"] as const;

export function ManualLinkFormModal({
  open,
  onClose,
  brands,
  employees,
  existingLinks,
  defaultBrandId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  employees: Employee[];
  existingLinks: BrandLink[];
  defaultBrandId?: string;
  onSave: (link: Omit<BrandLink, "id"> & { id?: string }) => void;
}) {
  const activeBrands = useMemo(
    () => brands.filter((b) => b.status === "active" || b.status === "paused"),
    [brands]
  );

  const [form, setForm] = useState({
    brandId: defaultBrandId ?? activeBrands[0]?.id ?? "",
    platform: "Kick" as string,
    title: "",
    url: "",
    ownerId: "" as string,
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      brandId: defaultBrandId ?? activeBrands[0]?.id ?? "",
      platform: "Kick",
      title: "",
      url: "",
      ownerId: "",
      notes: "",
    });
  }, [open, defaultBrandId, activeBrands]);

  const sitePreview = linkSiteLabel(form.url);
  const platformOptions = [
    ...MANUAL_PLATFORMS.map((p) => ({ value: p, label: p })),
    ...SOCIAL_PLATFORMS.filter((p) => !MANUAL_PLATFORMS.includes(p as (typeof MANUAL_PLATFORMS)[number])).map(
      (p) => ({ value: p, label: `${p} (manuel)` })
    ),
  ];

  return (
    <Modal open={open} onClose={onClose} title="Yeni manuel video / link">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.brandId) {
            window.alert("Marka seçin.");
            return;
          }
          if (!form.url.trim()) {
            window.alert("Video veya sayfa URL'si girin.");
            return;
          }
          const payload: Omit<BrandLink, "id"> = {
            brandId: form.brandId,
            platform: form.platform,
            handle: form.title.trim() ? form.title.trim() : sitePreview || form.platform,
            url: form.url.trim(),
            ownerId: form.ownerId || undefined,
            status: "active",
            notes: form.notes.trim(),
            autoTrack: false,
          };
          const dup = findDuplicateBrandLink(existingLinks, payload.url, undefined, {
            brandId: payload.brandId,
          });
          if (dup) {
            window.alert(
              `Bu URL zaten kayıtlı (${dup.platform}${dup.handle ? ` · ${dup.handle}` : ""}).`
            );
            return;
          }
          if (needsManualTracking(payload) === false && form.platform !== "Diğer") {
            const ok = window.confirm(
              "Bu platform API ile otomatik takip edilebilir. Yine de manuel olarak mı eklemek istiyorsunuz?"
            );
            if (!ok) return;
          }
          onSave(payload);
          onClose();
        }}
      >
        <p className="text-xs text-muted-foreground mb-4">
          Kick, Twitter, Twitch vb. videolar buradan eklenir. Marka seçimi zorunludur; kayıt sonrası
          hemen snapshot girebilirsiniz — artış izlenme panosuna yansır.
        </p>
        <FormGrid>
          <Field label="Marka" required>
            <Select
              value={form.brandId}
              onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
              required
              options={[
                { value: "", label: "Marka seçin…" },
                ...activeBrands.map((b) => ({
                  value: b.id,
                  label: b.shortName ? `${b.shortName} — ${b.name}` : b.name,
                })),
              ]}
            />
          </Field>
          <Field label="Platform / site" required>
            <Select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              options={platformOptions}
            />
          </Field>
        </FormGrid>
        <Field label="Video / içerik adı" hint="Örn. Gala tanıtım yayını, Ramiz Kick VOD">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Görünen başlık"
          />
        </Field>
        <Field
          label="URL"
          hint={sitePreview ? `Site: ${sitePreview}` : "Tam video veya kanal linki"}
          required
        >
          <Input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://kick.com/..."
            className="font-mono text-xs"
            required
          />
        </Field>
        <FormGrid>
          <Field label="Yayıncı / operatör">
            <Select
              value={form.ownerId}
              onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}
              options={[
                { value: "", label: "Atanmamış" },
                ...employees.map((e) => ({ value: e.id, label: e.name })),
              ]}
            />
          </Field>
          <Field label="Ek not">
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Kampanya, tarih, marka notu…"
            />
          </Field>
        </FormGrid>
        <FormActions onCancel={onClose} submitLabel="Link ekle ve snapshot gir" />
      </form>
    </Modal>
  );
}
