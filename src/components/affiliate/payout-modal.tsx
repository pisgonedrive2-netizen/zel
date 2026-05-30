"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import Modal from "@/components/ui/modal";
import {
  Field,
  FormActions,
  FormGrid,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ApiError } from "@/lib/streamer-pool-api";
import {
  createAffiliatePayout,
  deleteAffiliatePayout,
  updateAffiliatePayout,
} from "@/lib/affiliate-api";
import type { AffiliatePartner, AffiliatePayout } from "@/store/store";
import { CURRENCY_OPTIONS, PAYOUT_STATUS_OPTIONS } from "./labels";

interface PayoutFormState {
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: AffiliatePayout["currency"];
  status: AffiliatePayout["status"];
  paidDate: string;
  notes: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialState(
  partners: AffiliatePartner[],
  presetPartnerId?: string,
  payout?: AffiliatePayout | null
): PayoutFormState {
  if (payout) {
    return {
      partnerId: payout.partnerId,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      paidDate: payout.paidDate ?? "",
      notes: payout.notes ?? "",
    };
  }
  const partnerId = presetPartnerId ?? partners[0]?.id ?? "";
  const partner = partners.find((p) => p.id === partnerId);
  return {
    partnerId,
    periodStart: "",
    periodEnd: "",
    amount: 0,
    currency: partner?.currency ?? "USD",
    status: "pending",
    paidDate: "",
    notes: "",
  };
}

export function PayoutModal({
  open,
  onClose,
  partners,
  presetPartnerId,
  payout,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  partners: AffiliatePartner[];
  presetPartnerId?: string;
  payout?: AffiliatePayout | null;
  onSaved: (payout: AffiliatePayout) => void;
  onDeleted?: (id: string) => void;
}) {
  const isEdit = !!payout;
  const [form, setForm] = useState<PayoutFormState>(() =>
    initialState(partners, presetPartnerId, payout)
  );
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(partners, presetPartnerId, payout));
      setError(null);
      setBusy(false);
      setConfirmDelete(false);
    }
  }, [open, partners, presetPartnerId, payout]);

  const partnerOptions = useMemo(
    () => partners.map((p) => ({ value: p.id, label: p.name })),
    [partners]
  );

  const set = <K extends keyof PayoutFormState>(
    key: K,
    value: PayoutFormState[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.partnerId) {
      setError("Partner seçin.");
      return;
    }
    if (!form.periodStart || !form.periodEnd) {
      setError("Dönem başlangıç ve bitiş tarihlerini seçin.");
      return;
    }
    if (form.periodStart > form.periodEnd) {
      setError("Dönem başlangıcı bitişten sonra olamaz.");
      return;
    }
    if (form.status === "paid" && !form.paidDate) {
      setError("Ödendi durumunda ödeme tarihi zorunlu.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: Partial<AffiliatePayout> = {
      partnerId: form.partnerId,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      amount: form.amount,
      currency: form.currency,
      status: form.status,
      paidDate: form.status === "paid" ? form.paidDate : form.paidDate || undefined,
      notes: form.notes,
    };
    try {
      const saved = isEdit
        ? await updateAffiliatePayout(payout!.id, body)
        : await createAffiliatePayout(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ödeme kaydedilemedi.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy || !payout) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAffiliatePayout(payout.id);
      onDeleted?.(payout.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ödeme silinemedi.");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Ödemeyi düzenle" : "Ödeme ekle"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <FormGrid>
          <Field label="Partner" required>
            <Select
              value={form.partnerId}
              onChange={(e) => set("partnerId", e.target.value)}
              disabled={isEdit}
              options={
                partnerOptions.length > 0
                  ? partnerOptions
                  : [{ value: "", label: "Önce partner ekleyin" }]
              }
            />
          </Field>
          <Field label="Tutar">
            <NumberInput value={form.amount} onChange={(n) => set("amount", n)} min={0} />
          </Field>
          <Field label="Dönem başlangıcı" required>
            <DateTimePicker
              mode="date"
              value={form.periodStart}
              onChange={(v) => set("periodStart", v)}
              required
            />
          </Field>
          <Field label="Dönem bitişi" required>
            <DateTimePicker
              mode="date"
              value={form.periodEnd}
              onChange={(v) => set("periodEnd", v)}
              required
              min={form.periodStart || undefined}
            />
          </Field>
          <Field label="Para birimi">
            <Select
              value={form.currency}
              onChange={(e) =>
                set("currency", e.target.value as AffiliatePayout["currency"])
              }
              options={CURRENCY_OPTIONS}
            />
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) =>
                set("status", e.target.value as AffiliatePayout["status"])
              }
              options={PAYOUT_STATUS_OPTIONS}
            />
          </Field>
          {form.status === "paid" && (
            <Field label="Ödeme tarihi" required>
              <DateTimePicker
                mode="date"
                value={form.paidDate}
                onChange={(v) => set("paidDate", v)}
                required
              />
            </Field>
          )}
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

        {isEdit && onDeleted && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <span className="text-[12px] text-muted-foreground">
              {confirmDelete
                ? "Bu ödeme kaydı kalıcı olarak silinecek. Emin misiniz?"
                : "Kaydı kalıcı silmek yerine “İptal” durumuna almayı da tercih edebilirsiniz."}
            </span>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="shrink-0 rounded-md border border-destructive/50 px-3 py-1.5 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {confirmDelete ? "Evet, sil" : "Sil"}
            </button>
          </div>
        )}

        <FormActions
          onCancel={onClose}
          submitLabel={busy ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Ekle"}
        />
      </form>
    </Modal>
  );
}
