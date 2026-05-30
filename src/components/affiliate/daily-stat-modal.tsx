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
} from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ApiError } from "@/lib/streamer-pool-api";
import { bulkUpsertAffiliateStats } from "@/lib/affiliate-api";
import type { AffiliateDailyStat, AffiliatePartner } from "@/store/store";

interface DailyStatFormState {
  partnerId: string;
  statDate: string;
  clicks: number;
  registrations: number;
  ftdCount: number;
  ftdAmount: number;
  depositAmount: number;
  withdrawalAmount: number;
  commissionDue: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyState(presetPartnerId?: string): DailyStatFormState {
  return {
    partnerId: presetPartnerId ?? "",
    statDate: todayIso(),
    clicks: 0,
    registrations: 0,
    ftdCount: 0,
    ftdAmount: 0,
    depositAmount: 0,
    withdrawalAmount: 0,
    commissionDue: 0,
  };
}

export function DailyStatModal({
  open,
  onClose,
  partners,
  presetPartnerId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  partners: AffiliatePartner[];
  presetPartnerId?: string;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<DailyStatFormState>(() =>
    emptyState(presetPartnerId)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyState(presetPartnerId ?? partners[0]?.id));
      setError(null);
      setBusy(false);
    }
  }, [open, presetPartnerId, partners]);

  const partnerOptions = useMemo(
    () =>
      partners.map((p) => ({
        value: p.id,
        label: p.externalRef ? `${p.name} · ${p.externalRef}` : p.name,
      })),
    [partners]
  );

  const set = <K extends keyof DailyStatFormState>(
    key: K,
    value: DailyStatFormState[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.partnerId) {
      setError("Partner seçin.");
      return;
    }
    if (!form.statDate) {
      setError("Tarih seçin.");
      return;
    }
    if (form.ftdCount > form.registrations) {
      setError("FTD sayısı kayıt sayısından büyük olamaz.");
      return;
    }
    const partner = partners.find((p) => p.id === form.partnerId);
    setBusy(true);
    setError(null);
    const row: Partial<AffiliateDailyStat> = {
      partnerId: form.partnerId,
      statDate: form.statDate,
      clicks: form.clicks,
      registrations: form.registrations,
      ftdCount: form.ftdCount,
      ftdAmount: form.ftdAmount,
      depositAmount: form.depositAmount,
      withdrawalAmount: form.withdrawalAmount,
      netRevenue: form.depositAmount - form.withdrawalAmount,
      commissionDue: form.commissionDue,
      currency: partner?.currency ?? "USD",
      source: "manual",
    };
    try {
      const res = await bulkUpsertAffiliateStats([row]);
      if (res.errors.length > 0) {
        setError(res.errors.map((er) => er.reason).join(", "));
        setBusy(false);
        return;
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İstatistik kaydedilemedi.");
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Günlük istatistik ekle" size="lg">
      <form onSubmit={handleSubmit}>
        <FormGrid>
          <Field label="Partner" required>
            <Select
              value={form.partnerId}
              onChange={(e) => set("partnerId", e.target.value)}
              options={
                partnerOptions.length > 0
                  ? partnerOptions
                  : [{ value: "", label: "Önce partner ekleyin" }]
              }
            />
          </Field>
          <Field label="Tarih" required>
            <DateTimePicker
              mode="date"
              value={form.statDate}
              onChange={(v) => set("statDate", v)}
              required
              max={todayIso()}
            />
          </Field>
          <Field label="Tıklama">
            <NumberInput value={form.clicks} onChange={(n) => set("clicks", n)} min={0} />
          </Field>
          <Field label="Kayıt">
            <NumberInput
              value={form.registrations}
              onChange={(n) => set("registrations", n)}
              min={0}
            />
          </Field>
          <Field label="FTD sayısı" hint="Kayıt sayısını aşamaz">
            <NumberInput
              value={form.ftdCount}
              onChange={(n) => set("ftdCount", n)}
              min={0}
            />
          </Field>
          <Field label="FTD tutarı">
            <NumberInput
              value={form.ftdAmount}
              onChange={(n) => set("ftdAmount", n)}
              min={0}
            />
          </Field>
          <Field label="Yatırım">
            <NumberInput
              value={form.depositAmount}
              onChange={(n) => set("depositAmount", n)}
              min={0}
            />
          </Field>
          <Field label="Çekim">
            <NumberInput
              value={form.withdrawalAmount}
              onChange={(n) => set("withdrawalAmount", n)}
              min={0}
            />
          </Field>
          <Field label="Komisyon (hak ediş)">
            <NumberInput
              value={form.commissionDue}
              onChange={(n) => set("commissionDue", n)}
              min={0}
            />
          </Field>
        </FormGrid>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <FormActions
          onCancel={onClose}
          submitLabel={busy ? "Kaydediliyor…" : "Kaydet"}
        />
      </form>
    </Modal>
  );
}
