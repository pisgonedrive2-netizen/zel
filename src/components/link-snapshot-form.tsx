"use client";

import { useMemo, useState } from "react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Field, Input, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import type { BrandLink, LinkSnapshot } from "@/store/store";
import {
  previousLinkSnapshot,
  snapshotViewsDelta,
  linkDisplayTitle,
  linkSiteLabel,
} from "@/lib/link-snapshot-delta";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

export function LinkSnapshotForm({
  link,
  brandName,
  allSnapshots = [],
  initial,
  defaultDateForNew,
  suggestedViewsForNew,
  onSave,
  onDelete,
  onClose,
}: {
  link: BrandLink;
  brandName?: string;
  allSnapshots?: LinkSnapshot[];
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
    likes: initial?.likes,
    comments: initial?.comments,
    shares: initial?.shares,
  });

  const site = linkSiteLabel(link.url);
  const title = linkDisplayTitle(link);

  const previous = useMemo(
    () => previousLinkSnapshot(link.id, form.date, allSnapshots, initial?.id),
    [link.id, form.date, allSnapshots, initial?.id]
  );

  const delta = snapshotViewsDelta(form.views, previous?.views ?? link.lastViews);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (form.views < (previous?.views ?? link.lastViews ?? 0)) {
          const ok = window.confirm(
            "Yeni değer önceki snapshot'tan düşük. Platform sayacı gerilemiş olabilir — yine de kaydedilsin mi?"
          );
          if (!ok) return;
        }
        onSave(form);
      }}
    >
      <div className="mb-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-xs space-y-1">
        {brandName && (
          <p>
            <span className="text-muted-foreground">Marka:</span>{" "}
            <span className="font-semibold text-foreground">{brandName}</span>
          </p>
        )}
        <p>
          <span className="text-muted-foreground">İçerik:</span>{" "}
          <span className="font-medium">{title}</span>
          {site && (
            <Badge variant="outline" className="ml-1.5 text-[9px]">
              {site}
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground truncate font-mono">{link.url || "—"}</p>
        {(previous?.views != null || link.lastViews != null) && (
          <p>
            <span className="text-muted-foreground">Önceki kayıt:</span>{" "}
            <span className="tabular-nums font-medium">
              {fmtCompactViews(previous?.views ?? link.lastViews ?? 0)}
            </span>
            {previous?.date && (
              <span className="text-muted-foreground"> ({previous.date.slice(0, 10)})</span>
            )}
          </p>
        )}
        {delta > 0 && (
          <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
            <TrendingUp size={12} />
            +{fmtCompactViews(delta)} artış panoya yansıyacak
          </p>
        )}
      </div>

      <FormGrid>
        <Field label="Tarih" hint="Kontrol ettiğiniz gün">
          <DateTimePicker
            mode="date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
            required
          />
        </Field>
        <Field label="Toplam izlenme" hint="Platformdaki güncel kümülatif sayı">
          <Input
            type="number"
            min={0}
            value={form.views}
            onChange={(e) => setForm({ ...form, views: Number(e.target.value) || 0 })}
            required
          />
        </Field>
        <Field label="Beğeni" hint="Opsiyonel">
          <Input
            type="number"
            min={0}
            value={form.likes ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                likes: e.target.value === "" ? undefined : Number(e.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Yorum">
          <Input
            type="number"
            min={0}
            value={form.comments ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                comments: e.target.value === "" ? undefined : Number(e.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Paylaşım">
          <Input
            type="number"
            min={0}
            value={form.shares ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                shares: e.target.value === "" ? undefined : Number(e.target.value) || 0,
              })
            }
          />
        </Field>
      </FormGrid>
      <Field label="Not" hint="Kampanya, yayın adı, ek açıklama">
        <Textarea
          rows={2}
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <FormActions
        onCancel={onClose}
        onDelete={onDelete}
        submitLabel={initial ? "Güncelle" : "Kaydet — artışı yansıt"}
      />
    </form>
  );
}
