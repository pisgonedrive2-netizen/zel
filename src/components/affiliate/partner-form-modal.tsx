"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import Modal from "@/components/ui/modal";
import {
  Field,
  FormActions,
  FormGrid,
  Input,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { ApiError } from "@/lib/streamer-pool-api";
import {
  createAffiliatePartner,
  deleteAffiliatePartner,
  updateAffiliatePartner,
} from "@/lib/affiliate-api";
import type { AffiliatePartner } from "@/store/store";
import {
  COMMISSION_MODEL_OPTIONS,
  CURRENCY_OPTIONS,
  PARTNER_STATUS_OPTIONS,
  PARTNER_TYPE_OPTIONS,
} from "./labels";

interface PartnerFormState {
  name: string;
  externalRef: string;
  partnerType: AffiliatePartner["partnerType"];
  commissionModel: AffiliatePartner["commissionModel"];
  cpaAmount: number;
  revsharePct: number;
  currency: AffiliatePartner["currency"];
  status: AffiliatePartner["status"];
  contact: string;
  notes: string;
}

function initialState(partner?: AffiliatePartner | null): PartnerFormState {
  return {
    name: partner?.name ?? "",
    externalRef: partner?.externalRef ?? "",
    partnerType: partner?.partnerType ?? "streamer",
    commissionModel: partner?.commissionModel ?? "cpa",
    cpaAmount: partner?.cpaAmount ?? 0,
    revsharePct: partner?.revsharePct ?? 0,
    currency: partner?.currency ?? "USD",
    status: partner?.status ?? "active",
    contact: partner?.contact ?? "",
    notes: partner?.notes ?? "",
  };
}

export function PartnerFormModal({
  open,
  onClose,
  brandId,
  partner,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  partner?: AffiliatePartner | null;
  onSaved: (partner: AffiliatePartner) => void;
  onDeleted?: (id: string) => void;
}) {
  const isEdit = !!partner;
  const [form, setForm] = useState<PartnerFormState>(() => initialState(partner));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(partner));
      setError(null);
      setBusy(false);
    }
  }, [open, partner]);

  const set = <K extends keyof PartnerFormState>(key: K, value: PartnerFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.name.trim()) {
      setError("Partner adı gerekli.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: Partial<AffiliatePartner> = {
      brandId,
      name: form.name.trim(),
      externalRef: form.externalRef.trim() || undefined,
      partnerType: form.partnerType,
      commissionModel: form.commissionModel,
      cpaAmount: form.cpaAmount,
      revsharePct: form.revsharePct,
      currency: form.currency,
      status: form.status,
      contact: form.contact.trim() || undefined,
      notes: form.notes,
    };
    try {
      const saved = isEdit
        ? await updateAffiliatePartner(partner!.id, body)
        : await createAffiliatePartner(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Partner kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!partner || busy) return;
    if (!window.confirm(`"${partner.name}" partnerini silmek istediğinize emin misiniz?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAffiliatePartner(partner.id);
      onDeleted?.(partner.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Partner silinemedi.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Partneri düzenle" : "Yeni partner"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <FormGrid>
          <Field label="Partner adı" required>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Örn. Ahmet Yayıncı"
            />
          </Field>
          <Field label="Dış referans (aff_id)" hint="CSV eşleştirme anahtarı">
            <Input
              value={form.externalRef}
              onChange={(e) => set("externalRef", e.target.value)}
              placeholder="AFF123"
            />
          </Field>
          <Field label="Partner tipi">
            <Select
              value={form.partnerType}
              onChange={(e) =>
                set("partnerType", e.target.value as AffiliatePartner["partnerType"])
              }
              options={PARTNER_TYPE_OPTIONS}
            />
          </Field>
          <Field label="Komisyon modeli">
            <Select
              value={form.commissionModel}
              onChange={(e) =>
                set(
                  "commissionModel",
                  e.target.value as AffiliatePartner["commissionModel"]
                )
              }
              options={COMMISSION_MODEL_OPTIONS}
            />
          </Field>
          <Field label="CPA tutarı" hint="FTD başına sabit komisyon">
            <NumberInput
              value={form.cpaAmount}
              onChange={(n) => set("cpaAmount", n)}
              min={0}
            />
          </Field>
          <Field label="RevShare (%)" hint="0-100 arası net gelir payı">
            <NumberInput
              value={form.revsharePct}
              onChange={(n) => set("revsharePct", n)}
              min={0}
              max={100}
            />
          </Field>
          <Field label="Para birimi">
            <Select
              value={form.currency}
              onChange={(e) =>
                set("currency", e.target.value as AffiliatePartner["currency"])
              }
              options={CURRENCY_OPTIONS}
            />
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) =>
                set("status", e.target.value as AffiliatePartner["status"])
              }
              options={PARTNER_STATUS_OPTIONS}
            />
          </Field>
          <Field label="İletişim">
            <Input
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
              placeholder="E-posta / telefon / Telegram"
            />
          </Field>
        </FormGrid>
        <div className="mt-4">
          <Field label="Notlar">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Opsiyonel notlar"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <FormActions
          onCancel={onClose}
          submitLabel={busy ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Ekle"}
          onDelete={isEdit && onDeleted ? handleDelete : undefined}
          deleteLabel="Partneri sil"
        />
      </form>
    </Modal>
  );
}
