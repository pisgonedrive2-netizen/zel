"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, ArrowLeft, Check, Loader2, Rocket, Building2, Palette, Target,
  Shield, Plug, TrendingUp, Send,
} from "lucide-react";
import { fetchOnboardingProgress, saveOnboardingStep } from "@/lib/brand-igaming-api";
import { ONBOARDING_STEPS } from "@/types/brand-igaming";
import { useAuth } from "@/store/auth";
import { useStore, type Organization } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, NumberInput, FormGrid } from "@/components/ui/field";

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "TRY", label: "TRY (₺)" },
];

const TIMEZONES = [
  { value: "Europe/Istanbul", label: "İstanbul (GMT+3)" },
  { value: "Europe/London", label: "Londra (GMT+0)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
];

const COLORS = ["#FF6B00", "#22C55E", "#3B82F6", "#EC4899", "#A855F7", "#EF4444", "#14B8A6"];

const STEPS = ["Hoş geldin", "Marka profili", "Tercihler", "Bitir"] as const;

export default function MarkaOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const organizations = useStore((s) => s.organizations);
  const brands = useStore((s) => s.brands);

  const org = useMemo(
    () => organizations.find((o) => o.id === user?.organizationId),
    [organizations, user?.organizationId]
  );
  const brand = useMemo(
    () => brands.find((b) => b.id === user?.brandId) ?? brands[0],
    [brands, user?.brandId]
  );

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [igamingSteps, setIgamingSteps] = useState<Array<{ key: string; label: string; href: string; done: boolean }>>([]);
  const [form, setForm] = useState({
    name: "",
    primaryColor: "#FF6B00",
    defaultCurrency: "USD",
    timezone: "Europe/Istanbul",
    brandCategory: "",
    brandMonthlyTarget: 0,
  });

  useEffect(() => {
    if (org) {
      setForm((f) => ({
        ...f,
        name: org.name ?? f.name,
        primaryColor: org.primaryColor ?? f.primaryColor,
        defaultCurrency: org.defaultCurrency ?? f.defaultCurrency,
        timezone: org.timezone ?? f.timezone,
        brandCategory: brand?.category ?? f.brandCategory,
        brandMonthlyTarget: brand?.monthlyTarget ?? f.brandMonthlyTarget,
      }));
    }
  }, [org, brand]);

  // Onboarding zaten tamamlanmışsa izlenme paneline dön.
  useEffect(() => {
    if (org && org.onboardingCompleted) router.replace("/marka/izlenmeler");
  }, [org, router]);

  useEffect(() => {
    const bid = user?.brandId ?? brand?.id;
    if (!bid) return;
    void fetchOnboardingProgress(bid).then((r) => setIgamingSteps(r.steps)).catch(() => setIgamingSteps(ONBOARDING_STEPS.map((s) => ({ ...s, done: false }))));
  }, [user?.brandId, brand?.id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, complete: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { organization?: Organization; error?: string };
      if (!res.ok || !data.organization) {
        throw new Error(data.error ?? "Kaydedilemedi");
      }
      const saved = data.organization;
      useStore.setState((s) => ({
        organizations: s.organizations.map((o) => (o.id === saved.id ? saved : o)),
        brands: s.brands.map((b) =>
          b.id === (user?.brandId ?? brand?.id)
            ? {
                ...b,
                category: form.brandCategory.trim() || b.category,
                monthlyTarget: form.brandMonthlyTarget || b.monthlyTarget,
              }
            : b
        ),
      }));
      const bid = user?.brandId ?? brand?.id;
      if (bid) {
        await saveOnboardingStep(bid, "license_info", true).catch(() => {});
      }
      router.replace("/marka/izlenmeler");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi");
      setBusy(false);
    }
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[680px] flex-col justify-center px-2 py-6">
      {/* İlerleme */}
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
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        {step === 0 && (
          <>
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Rocket size={22} />
              </div>
              <CardTitle>Foxstream&apos;e hoş geldin{org?.name ? `, ${org.name}` : ""}</CardTitle>
              <CardDescription>
                Birkaç adımda markanı kuralım. Bu bilgileri sonradan Marka profili ve
                Ayarlar üzerinden değiştirebilirsin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Building2 size={15} className="text-primary" /> Marka adı ve kategori</li>
                <li className="flex items-center gap-2"><Palette size={15} className="text-primary" /> Tema rengi, para birimi, saat dilimi</li>
                <li className="flex items-center gap-2"><Target size={15} className="text-primary" /> Aylık hedef</li>
              </ul>
              <div className="mt-6 flex justify-end">
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
              <CardTitle>Marka profili</CardTitle>
              <CardDescription>Markanın temel bilgileri.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormGrid>
                <Field label="Marka / organizasyon adı" required>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Örn. Yeni Bahis A.Ş." />
                </Field>
                <Field label="Kategori">
                  <Input value={form.brandCategory} onChange={(e) => set("brandCategory", e.target.value)} placeholder="Bahis, Casino, Spor…" />
                </Field>
              </FormGrid>
              <Field label="Aylık hedef (izlenme / FTD)">
                <NumberInput value={form.brandMonthlyTarget} onChange={(n) => set("brandMonthlyTarget", n)} min={0} />
              </Field>
              <NavButtons onPrev={prev} onNext={next} nextDisabled={!form.name.trim()} />
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Tercihler</CardTitle>
              <CardDescription>Tema ve bölgesel ayarlar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Tema rengi">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("primaryColor", c)}
                      aria-label={`Renk ${c}`}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        form.primaryColor === c ? "scale-110 border-foreground" : "border-transparent"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </Field>
              <FormGrid>
                <Field label="Para birimi">
                  <Select value={form.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)} options={CURRENCIES} />
                </Field>
                <Field label="Saat dilimi">
                  <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)} options={TIMEZONES} />
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
              <CardTitle>Her şey hazır</CardTitle>
              <CardDescription>Kurulumu tamamla ve panele geç.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <SummaryRow label="Ad" value={form.name || "—"} />
                <SummaryRow label="Kategori" value={form.brandCategory || "—"} />
                <SummaryRow label="Aylık hedef" value={form.brandMonthlyTarget ? form.brandMonthlyTarget.toLocaleString("tr-TR") : "—"} />
                <SummaryRow label="Para birimi" value={form.defaultCurrency} />
                <SummaryRow label="Saat dilimi" value={form.timezone} />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium">iGaming program checklist</p>
                {(igamingSteps.length ? igamingSteps : ONBOARDING_STEPS.map((s) => ({ ...s, done: false }))).map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <Link href={s.href} className="text-primary underline">{s.label}</Link>
                    {s.done ? <Check size={14} className="text-green-600" /> : <span className="text-xs text-muted-foreground">Bekliyor</span>}
                  </div>
                ))}
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
                  Kurulumu tamamla
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
