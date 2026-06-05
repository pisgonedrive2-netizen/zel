"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Sparkles, X } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  Input,
  OptionalNumberInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  fetchMyPoolProfile,
  isPoolNotReadyError,
  upsertMyPoolProfile,
} from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import {
  StreamerPoolCard,
  countryFlagEmoji,
} from "@/components/streamer-pool/streamer-pool-card";
import {
  STREAMER_POOL_STATUS_LABELS,
  STREAMER_POOL_VISIBILITY_LABELS,
  type StreamerPoolStatus,
  type StreamerPoolVisibility,
} from "@/types/streamer-pool";
import type { StreamerPoolProfile } from "@/store/store";

const PRESET_LANGUAGES = ["tr", "en", "de", "ru", "es", "fr"];
const PRESET_COUNTRIES = ["TR", "DE", "AZ", "RU", "NL", "UK", "US"];
const PRESET_CATEGORIES = [
  "Vlog",
  "Gaming",
  "Bahis",
  "Casino",
  "Influencer",
  "Spor",
  "Yetişkin",
  "Yaşam",
];

interface DraftState {
  displayName: string;
  headline: string;
  bio: string;
  categories: string[];
  languages: string[];
  countries: string[];
  rateMinUsd?: number;
  rateMaxUsd?: number;
  status: StreamerPoolStatus;
  visibility: StreamerPoolVisibility;
}

function emptyDraft(name: string): DraftState {
  return {
    displayName: name,
    headline: "",
    bio: "",
    categories: [],
    languages: ["tr"],
    countries: ["TR"],
    rateMinUsd: undefined,
    rateMaxUsd: undefined,
    status: "draft",
    visibility: "public",
  };
}

function profileToDraft(p: StreamerPoolProfile): DraftState {
  return {
    displayName: p.displayName,
    headline: p.headline,
    bio: p.bio,
    categories: [...p.categories],
    languages: p.languages.length ? [...p.languages] : ["tr"],
    countries: p.countries.length ? [...p.countries] : ["TR"],
    rateMinUsd: p.rateMinUsd ?? undefined,
    rateMaxUsd: p.rateMaxUsd ?? undefined,
    status: p.status,
    visibility: p.visibility,
  };
}

export default function YayinciProfilPage() {
  const { user } = useAuth();
  const employees = useStore((s) => s.employees);

  const employee = employees.find((e) => e.id === user?.employeeId);
  const fallbackName = employee?.name ?? user?.name ?? "Yayıncı";

  const [profile, setProfile] = useState<StreamerPoolProfile | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft(fallbackName));
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [newCategory, setNewCategory] = useState("");

  const load = useCallback(async () => {
    if (!user?.employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const p = await fetchMyPoolProfile();
      setProfile(p);
      setDraft(p ? profileToDraft(p) : emptyDraft(fallbackName));
    } catch (err) {
      if (isPoolNotReadyError(err)) {
        setNotReady(true);
        setDraft(emptyDraft(fallbackName));
      } else {
        setError(err instanceof Error ? err.message : "Yükleme hatası");
      }
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId, fallbackName]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(status: StreamerPoolStatus = draft.status) {
    if (!draft.displayName.trim()) {
      setError("Görünen ad zorunlu.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await upsertMyPoolProfile({
        displayName: draft.displayName.trim(),
        headline: draft.headline.trim(),
        bio: draft.bio.trim(),
        categories: draft.categories,
        languages: draft.languages,
        countries: draft.countries,
        rateMinUsd: draft.rateMinUsd ?? null,
        rateMaxUsd: draft.rateMaxUsd ?? null,
        status,
        visibility: draft.visibility,
      });
      setProfile(next);
      setDraft(profileToDraft(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  function toggleArrayValue(key: "languages" | "countries", value: string) {
    setDraft((d) => {
      const exists = d[key].includes(value);
      const next = exists ? d[key].filter((v) => v !== value) : [...d[key], value];
      return { ...d, [key]: next };
    });
  }

  function addCategory(c: string) {
    const trimmed = c.trim();
    if (!trimmed) return;
    setDraft((d) =>
      d.categories.includes(trimmed)
        ? d
        : { ...d, categories: [...d.categories, trimmed] }
    );
    setNewCategory("");
  }

  function removeCategory(c: string) {
    setDraft((d) => ({ ...d, categories: d.categories.filter((x) => x !== c) }));
  }

  if (!user || user.role !== "streamer") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Bu sayfa yalnızca yayıncı hesapları içindir.
        </p>
      </div>
    );
  }

  const previewProfile: StreamerPoolProfile = {
    id: profile?.id ?? "preview",
    employeeId: user.employeeId ?? "",
    displayName: draft.displayName,
    headline: draft.headline,
    bio: draft.bio,
    categories: draft.categories,
    languages: draft.languages,
    countries: draft.countries,
    rateMinUsd: draft.rateMinUsd,
    rateMaxUsd: draft.rateMaxUsd,
    rateCurrency: "USD",
    followersTotal: profile?.followersTotal ?? 0,
    avgViews: profile?.avgViews ?? 0,
    avatarUrl: profile?.avatarUrl,
    coverUrl: profile?.coverUrl,
    status: draft.status,
    visibility: draft.visibility,
    igamingTags: profile?.igamingTags ?? [],
    restrictedMarkets: profile?.restrictedMarkets ?? [],
    createdAt: profile?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#FF6B00]/15 via-[#EC4899]/10 to-[#22C55E]/12 dark:from-[#FF6B00]/25 dark:via-[#EC4899]/15 dark:to-[#22C55E]/20"
        />
        <CardHeader className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Havuz profili
              </CardTitle>
              <CardDescription>
                Markalar sizi havuzdan bulup teklif gönderebilir. Profilinizi
                doldurun ve "Yayınla" ile aktif edin.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "h-fit border",
                draft.status === "published"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300"
              )}
            >
              {STREAMER_POOL_STATUS_LABELS[draft.status]}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {notReady && <PoolServerBanner />}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Profil yükleniyor…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profil bilgileri</CardTitle>
              <CardDescription>
                Görünen ad, açıklama, kategoriler ve ücret aralığı.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Görünen ad" required>
                <Input
                  value={draft.displayName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, displayName: e.target.value }))
                  }
                  placeholder="ör. Ramiz Vlog"
                />
              </Field>
              <Field
                label="Başlık (headline)"
                hint="Tek satır vurucu açıklama. ör. Türkiye'nin en hızlı vlogcusu."
              >
                <Input
                  value={draft.headline}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, headline: e.target.value }))
                  }
                  placeholder="—"
                />
              </Field>
              <Field label="Hakkımda">
                <Textarea
                  rows={4}
                  value={draft.bio}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, bio: e.target.value }))
                  }
                  placeholder="Kendinizi anlatın; hangi platformlarda yayındasınız, kitleniz nasıl, ne tür markalarla çalışmak istersiniz?"
                />
              </Field>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-foreground">
                    Kategoriler
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.categories.map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      className="gap-1 border-[#FF6B00]/40 text-foreground"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCategory(c)}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X size={10} />
                      </button>
                    </Badge>
                  ))}
                  {draft.categories.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Henüz kategori seçmediniz.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CATEGORIES.filter(
                    (c) => !draft.categories.includes(c)
                  ).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => addCategory(c)}
                      className="rounded-full border border-dashed border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-[#FF6B00] hover:text-[#FF6B00]"
                    >
                      + {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Özel kategori ekle…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCategory(newCategory);
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => addCategory(newCategory)}
                    className="gap-1"
                  >
                    <Plus size={12} /> Ekle
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground">
                    Diller
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_LANGUAGES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleArrayValue("languages", l)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase",
                          draft.languages.includes(l)
                            ? "border-[#FF6B00] bg-[#FF6B00]/15 text-[#FF6B00]"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground">
                    Ülkeler
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COUNTRIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleArrayValue("countries", c)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          draft.countries.includes(c)
                            ? "border-[#22C55E] bg-[#22C55E]/15 text-[#22C55E]"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span>{countryFlagEmoji(c)}</span>
                        <span className="uppercase">{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Min ücret (USD)" hint="Tek post / kampanya tabanı.">
                  <OptionalNumberInput
                    value={draft.rateMinUsd}
                    onChange={(n) => setDraft((d) => ({ ...d, rateMinUsd: n }))}
                    min={0}
                    placeholder="—"
                  />
                </Field>
                <Field label="Max ücret (USD)">
                  <OptionalNumberInput
                    value={draft.rateMaxUsd}
                    onChange={(n) => setDraft((d) => ({ ...d, rateMaxUsd: n }))}
                    min={0}
                    placeholder="—"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Görünürlük">
                  <Select
                    value={draft.visibility}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        visibility: e.target.value as StreamerPoolVisibility,
                      }))
                    }
                    options={Object.entries(STREAMER_POOL_VISIBILITY_LABELS).map(
                      ([value, label]) => ({ value, label })
                    )}
                  />
                </Field>
                <Field label="Durum">
                  <Select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as StreamerPoolStatus,
                      }))
                    }
                    options={Object.entries(STREAMER_POOL_STATUS_LABELS).map(
                      ([value, label]) => ({ value, label })
                    )}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview((v) => !v)}
                  className="gap-1.5 text-muted-foreground"
                >
                  <Sparkles size={12} />
                  {showPreview ? "Önizlemeyi gizle" : "Önizlemeyi göster"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => save("draft")}
                    className="gap-1.5"
                  >
                    <Save size={12} />
                    {saving ? "Kaydediliyor…" : "Taslak kaydet"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => save("published")}
                    className="gap-1.5 bg-[#22C55E] text-white hover:bg-[#22C55E]/90"
                  >
                    <Sparkles size={12} />
                    {saving
                      ? "Yayınlanıyor…"
                      : draft.status === "published"
                        ? "Güncelle"
                        : "Yayınla"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {showPreview && (
            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Önizleme</CardTitle>
                  <CardDescription>
                    Marka, havuzda kartınızı böyle görür.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StreamerPoolCard profile={previewProfile} ctaLabel="Teklif gönder" />
                </CardContent>
              </Card>
              {profile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">İstatistikler</CardTitle>
                    <CardDescription>
                      Otomatik hesaplanan (snapshot) sayılar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Takipçi" value={profile.followersTotal.toLocaleString("tr-TR")} />
                    <Stat label="Ort. izlenme" value={profile.avgViews.toLocaleString("tr-TR")} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
