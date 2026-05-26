"use client";

import { useState } from "react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Field, Input, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import type { BrandLink, LinkSnapshot } from "@/store/store";

export function LinkSnapshotForm({
  link,
  initial,
  defaultDateForNew,
  suggestedViewsForNew,
  onSave,
  onDelete,
  onClose,
}: {
  link: BrandLink;
  initial?: LinkSnapshot;
  defaultDateForNew: string;
  suggestedViewsForNew?: number;
  onSave: (d: Omit<LinkSnapshot, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<LinkSnapshot, "id">>({
    linkId: link.id,
    date: initial?.date ?? defaultDateForNew,
    views: initial?.views ?? suggestedViewsForNew ?? 0,
    notes: initial?.notes ?? "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <FormGrid>
        <Field label="Tarih">
          <DateTimePicker
            mode="date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
            required
          />
        </Field>
        <Field label="Toplam izlenme">
          <Input
            type="number"
            min={0}
            value={form.views}
            onChange={(e) => setForm({ ...form, views: Number(e.target.value) || 0 })}
            required
          />
        </Field>
      </FormGrid>
      <Field label="Not" hint="Opsiyonel açıklama">
        <Textarea
          rows={2}
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <FormActions
        onCancel={onClose}
        onDelete={onDelete}
        submitLabel={initial ? "Güncelle" : "Snapshot kaydet"}
      />
    </form>
  );
}
