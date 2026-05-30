"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowLeft, Check, Loader2, Rocket, UserCircle, Tag, DollarSign,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";
import { fetchMyPoolProfile, upsertMyPoolProfile, isPoolNotReadyError } from "@/lib/streamer-pool-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, NumberInput, FormGrid } from "@/components/ui/field";

const STEPS = ["Hoş geldin", "Profil", "Ücret", "Yayınla"] as const;

export default function YayinciOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const employees = useStore((s) => s.employees);
  const me = useMemo(
    () => employees.find((e) => e.id === user?.employeeId),
    [employees, user?.employeeId]
  );

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    headline: "",
    bio: "",
    categories: "",
    rateMinUsd: 0,
    rateMaxUsd: 0,
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const existing = await fetchMyPoolProfile();
        if (!active) return;
        if (existing) {
          setForm({
            displayName: existing.displayName ?? me?.name ?? "",
            headline: existing.headline ?? "",
            bio: existing.bio ?? "",
            categories: (existing.categories ?? []).join(", "),
            rateMinUsd: existing.rateMinUsd ?? 0,
            rateMaxUsd: existing.rateMaxUsd ?? 0,
          });
          // Profili zaten yayınlanmışsa onboarding'e gerek yok.
          if (existing.status === "published") router.replace("/yayinci/maas");
        } else if (me) {
          setForm((f) => ({ ...f, displayName: me.name }));
        }
      } catch (e) {
        if (isPoolNotReadyError(e)) setNotReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [me, router]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const categories = form.categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await upsertMyPoolProfile({
        displayName: form.displayName.trim() || me?.name || "Yayıncı",
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        categories,
        rateMinUsd: form.rateMinUsd || null,
        rateMaxUsd: form.rateMaxUsd || null,
        status: "published",
        visibility: "public",
      });
      router.replace("/yayinci/maas");
    } catch (e) {
      if (isPoolNotReadyError(e)) {
        setNotReady(true);
      } else {
        setError(e instanceof Error ? e.message : "Kaydedilemedi");
      }
      setBusy(false);
    }
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[640px] flex-col justify-center px-2 py-6">
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`h-px w-6 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {notReady && (
        <p className="mb-4 rounded-md border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
          Havuz modülü henüz hazır değil. Profilini daha sonra kaydedebilirsin; şimdilik panele geçebilirsin.
        </p>
      )}

      <Card>
        {step === 0 && (
          <>
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Rocket size={22} />
              </div>
              <CardTitle>Foxstream&apos;e hoş geldin{me?.name ? `, ${me.name}` : ""}</CardTitle>
              <CardDescription>
                Havuz profilini oluştur; markalar seni keşfedip teklif gönderebilsin.
                Bilgileri sonradan Havuz Profilim&apos;den düzenleyebilirsin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><UserCircle size={15} className="text-primary" /> Görünen ad, başlık ve bio</li>
                <li className="flex items-center gap-2"><Tag size={15} className="text-primary" /> İçerik kategorilerin</li>
                <li className="flex items-center gap-2"><DollarSign size={15} className="text-primary" /> Ücret aralığın</li>
              </ul>
              <div className="mt-6 flex justify-between">
                <Button type="button" variant="ghost" onClick={() => router.replace("/yayinci/maas")}>
                  Şimdilik geç
                </Button>
                <Button type="button" onClick={next}>
                  Başla <ArrowRight size={15} className="ml-1" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Profil bilgileri</CardTitle>
              <CardDescription>Markaların göreceği bilgiler.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormGrid>
                <Field label="Görünen ad" required>
                  <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Sahne / kanal adın" />
                </Field>
                <Field label="Başlık (headline)">
                  <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Örn. Türkiye'nin en hızlı vlogcusu" />
                </Field>
              </FormGrid>
              <Field label="Hakkında">
                <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Kendini ve içeriğini kısaca anlat" />
              </Field>
              <NavButtons onPrev={prev} onNext={next} nextDisabled={!form.displayName.trim()} />
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Kategori & ücret</CardTitle>
              <CardDescription>Hangi alanlarda içerik üretiyorsun ve ücret beklentin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Kategoriler (virgülle ayır)" hint="Örn. Vlog, Yayın, Spor">
                <Input value={form.categories} onChange={(e) => set("categories", e.target.value)} placeholder="Vlog, Yayın, Casino" />
              </Field>
              <FormGrid>
                <Field label="Min ücret (USD)">
                  <NumberInput value={form.rateMinUsd} onChange={(n) => set("rateMinUsd", n)} min={0} />
                </Field>
                <Field label="Maks ücret (USD)">
                  <NumberInput value={form.rateMaxUsd} onChange={(n) => set("rateMaxUsd", n)} min={0} />
                </Field>
              </FormGrid>
              <NavButtons onPrev={prev} onNext={next} />
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check size={22} />
              </div>
              <CardTitle>Profilini yayınla</CardTitle>
              <CardDescription>Yayınlandığında markalar seni havuzda görebilir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <SummaryRow label="Ad" value={form.displayName || "—"} />
                <SummaryRow label="Başlık" value={form.headline || "—"} />
                <SummaryRow label="Kategoriler" value={form.categories || "—"} />
                <SummaryRow
                  label="Ücret"
                  value={
                    form.rateMinUsd || form.rateMaxUsd
                      ? `$${form.rateMinUsd || 0} – $${form.rateMaxUsd || 0}`
                      : "—"
                  }
                />
              </div>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={prev} disabled={busy}>
                  <ArrowLeft size={15} className="mr-1" /> Geri
                </Button>
                <Button type="button" onClick={() => void finish()} disabled={busy}>
                  {busy ? <Loader2 size={15} className="mr-1 animate-spin" /> : <Rocket size={15} className="mr-1" />}
                  Yayınla ve panele geç
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function NavButtons({
  onPrev,
  onNext,
  nextDisabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button type="button" variant="outline" onClick={onPrev}>
        <ArrowLeft size={15} className="mr-1" /> Geri
      </Button>
      <Button type="button" onClick={onNext} disabled={nextDisabled}>
        İleri <ArrowRight size={15} className="ml-1" />
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
