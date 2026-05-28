"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormActions,
  FormGrid,
  Input,
  OptionalNumberInput,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
import {
  BRAND_OFFER_TYPE_LABELS,
  OFFER_DELIVERABLE_LABELS,
  OFFER_PLATFORM_LABELS,
  type BrandOfferType,
  type CreateBrandOfferBody,
  type OfferDeliverableType,
  type OfferPlatform,
} from "@/types/streamer-pool";
import type { StreamerPoolProfile } from "@/store/store";

interface DeliverableDraft {
  id: string;
  type: OfferDeliverableType;
  count: number;
  platform: OfferPlatform;
  notes: string;
}

function newDeliverable(): DeliverableDraft {
  return {
    id: `d-${Math.random().toString(36).slice(2, 8)}`,
    type: "reel",
    count: 1,
    platform: "instagram",
    notes: "",
  };
}

/**
 * Marka tarafında "Teklif gönder" modali. Yayıncı havuzu kartından açılır,
 * `POST /api/brand-offers` çağırır.
 */
export function OfferFormModal({
  open,
  onClose,
  profile,
  brandId,
  initiator,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  profile: StreamerPoolProfile | null;
  brandId: string;
  /** "brand" = marka başlatıyor, "streamer" = yayıncı başlatıyor. */
  initiator: "brand" | "streamer";
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [offerType, setOfferType] = useState<BrandOfferType>("campaign");
  const [budgetUsd, setBudgetUsd] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([
    newDeliverable(),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setOfferType("campaign");
    setBudgetUsd(undefined);
    setStartDate("");
    setEndDate("");
    setInitialMessage("");
    setDeliverables([newDeliverable()]);
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim()) {
      setError("Teklif başlığı zorunlu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateBrandOfferBody = {
        brandId,
        employeeId: profile.employeeId,
        initiator,
        title: title.trim(),
        description: description.trim(),
        offerType,
        budgetUsd,
        deliverables: deliverables.map((d) => ({
          type: d.type,
          count: Math.max(1, Math.round(d.count)),
          platform: d.platform,
          notes: d.notes.trim() || undefined,
        })),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const res = await fetch("/api/brand-offers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Teklif gönderilemedi (${res.status})`);
      }
      const created = (await res.json()) as { offer?: { id: string } };
      const offerId = created.offer?.id;
      if (offerId && initialMessage.trim()) {
        // İlk mesajı ayrı endpoint'e gönder (spec'te initialMessage create
        // body'sinde yok; mesaj sohbete eklenir).
        await fetch(`/api/brand-offers/${offerId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: initialMessage.trim() }),
        }).catch(() => {
          /* mesaj başarısız olsa teklif kaldı; ana akışı bozmaz */
        });
      }
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        profile
          ? `Teklif gönder · ${profile.displayName}`
          : "Teklif gönder"
      }
      size="lg"
    >
      {profile && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{profile.displayName}</span>
              {profile.headline && (
                <span className="text-muted-foreground">— {profile.headline}</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profile.categories.slice(0, 5).map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] font-normal">
                  {c}
                </Badge>
              ))}
              {(profile.rateMinUsd != null || profile.rateMaxUsd != null) && (
                <span className="ml-auto text-[11px] font-medium text-foreground">
                  {profile.rateMinUsd != null && profile.rateMaxUsd != null
                    ? `${fmtBrandMoney(profile.rateMinUsd, "USD")} – ${fmtBrandMoney(profile.rateMaxUsd, "USD")}`
                    : profile.rateMaxUsd != null
                      ? `≤ ${fmtBrandMoney(profile.rateMaxUsd, "USD")}`
                      : `≥ ${fmtBrandMoney(profile.rateMinUsd ?? 0, "USD")}`}
                </span>
              )}
            </div>
          </div>

          <FormGrid>
            <Field label="Başlık" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ör. Padişahbet için 3 vlog"
                required
              />
            </Field>
            <Field label="Tip" required>
              <Select
                value={offerType}
                onChange={(e) => setOfferType(e.target.value as BrandOfferType)}
                options={Object.entries(BRAND_OFFER_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Field label="Bütçe (USD)" hint="Boş bırakırsanız müzakereye açık olur.">
              <OptionalNumberInput
                value={budgetUsd}
                onChange={(n) => setBudgetUsd(n)}
                min={0}
                placeholder="—"
              />
            </Field>
            <div />
            <Field label="Başlangıç">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Bitiş">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </FormGrid>

          <Field label="Açıklama" hint="Yayıncıya açıkladığınız iş tanımı.">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ne istiyorsunuz? Hangi mesajı vermesini bekliyorsunuz?"
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-foreground">
                Deliverable (içerikler)
              </label>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  setDeliverables((arr) => [...arr, newDeliverable()])
                }
                className="gap-1"
              >
                <Plus size={11} /> Ekle
              </Button>
            </div>
            <div className="space-y-2">
              {deliverables.map((d, idx) => (
                <DeliverableRow
                  key={d.id}
                  value={d}
                  onChange={(next) =>
                    setDeliverables((arr) =>
                      arr.map((x, i) => (i === idx ? next : x))
                    )
                  }
                  onRemove={
                    deliverables.length > 1
                      ? () =>
                          setDeliverables((arr) =>
                            arr.filter((_, i) => i !== idx)
                          )
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          <Field label="İlk mesaj (opsiyonel)" hint="Teklif ile beraber gönderilir.">
            <Textarea
              rows={2}
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Merhaba, kampanyamız hakkında konuşmak isteriz…"
            />
          </Field>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <FormActions
            onCancel={handleClose}
            submitLabel={submitting ? "Gönderiliyor…" : "Teklifi gönder"}
          />
          {submitting && (
            <p className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 size={11} className="animate-spin" /> Sunucuya gönderiliyor…
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

function DeliverableRow({
  value,
  onChange,
  onRemove,
}: {
  value: DeliverableDraft;
  onChange: (next: DeliverableDraft) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-[1fr_1fr_90px_auto]">
      <Select
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value as OfferDeliverableType })}
        options={Object.entries(OFFER_DELIVERABLE_LABELS).map(([k, l]) => ({
          value: k,
          label: l,
        }))}
      />
      <Select
        value={value.platform}
        onChange={(e) => onChange({ ...value, platform: e.target.value as OfferPlatform })}
        options={Object.entries(OFFER_PLATFORM_LABELS).map(([k, l]) => ({
          value: k,
          label: l,
        }))}
      />
      <NumberInput
        value={value.count}
        onChange={(n) => onChange({ ...value, count: n })}
        min={1}
        max={99}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!onRemove}
        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
        title="Sil"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
