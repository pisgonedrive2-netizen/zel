"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Users,
  Eye,
  Globe2,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { useStore } from "@/store/store";
import { MarkaStatGrid } from "@/components/marka/marka-stat-grid";
import { MarkaPoolCard } from "@/components/marka/marka-pool-card";
import { fmtBrandCount } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  Input,
  OptionalNumberInput,
  Select,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { fetchStreamerPool, isPoolNotReadyError } from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import { OfferFormModal } from "@/components/streamer-pool/offer-form-modal";
import type { StreamerPoolProfile } from "@/store/store";
import type { StreamerPoolFilters } from "@/types/streamer-pool";

const LANGUAGES = ["tr", "en", "de", "ru", "es"] as const;
const COUNTRIES = ["TR", "DE", "AZ", "RU", "NL", "UK", "US"] as const;

export default function MarkaHavuzPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand, month } = portal;
  const {
    weekBrandReels,
    brandPosts,
    brandLinks,
    brandDeals,
    brandOffers,
  } = useStore();

  const [profiles, setProfiles] = useState<StreamerPoolProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StreamerPoolFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<StreamerPoolProfile | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const data = await fetchStreamerPool({ ...filters, status: "published" });
      setProfiles(data);
    } catch (err) {
      if (isPoolNotReadyError(err)) {
        setNotReady(true);
        setProfiles([]);
      } else {
        setError(err instanceof Error ? err.message : "Yükleme hatası");
      }
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) for (const c of p.categories) set.add(c);
    return Array.from(set).sort();
  }, [profiles]);

  function applySearch() {
    setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
  }

  function toggleCategory(category: string) {
    setFilters((f) => ({
      ...f,
      category: f.category === category ? undefined : category,
    }));
  }

  function clearFilters() {
    setFilters({});
    setSearchInput("");
  }

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(
      (v) => v !== undefined && v !== null && v !== ""
    );
  }, [filters]);

  const poolSummary = useMemo(() => {
    const followers = profiles.reduce((s, p) => s + (p.followersTotal ?? 0), 0);
    const avgViews = profiles.length
      ? profiles.reduce((s, p) => s + (p.avgViews ?? 0), 0) / profiles.length
      : 0;
    const cats = new Set(profiles.flatMap((p) => p.categories));
    return { count: profiles.length, followers, avgViews, categories: cats.size };
  }, [profiles]);

  const storeSlice = useMemo(
    () => ({
      weekBrandReels,
      brandPosts,
      brandLinks,
      brandDeals,
      brandOffers,
    }),
    [weekBrandReels, brandPosts, brandLinks, brandDeals, brandOffers]
  );

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          {/* Hero (pembe-turuncu glow) */}
          <Card className="relative overflow-hidden border-pink-200/60 dark:border-pink-500/30">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EC4899]/15 via-[#FF6B00]/12 to-[#22C55E]/10 dark:from-[#EC4899]/25 dark:via-[#FF6B00]/18 dark:to-[#22C55E]/15"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#FF6B00]/30 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#EC4899]/30 blur-3xl"
            />
            <CardHeader className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <BrandLogo brandId={brand.id} title={brand.name} size={48} className="rounded-xl" />
                  <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">
                      Yayıncı havuzu
                    </CardTitle>
                    <CardDescription>
                      {brand.name} markası için doğru yayıncıyı bulun.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    <RefreshCcw size={12} className={loading ? "animate-spin" : undefined} />
                    Yenile
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {notReady && <PoolServerBanner />}

          <MarkaStatGrid
            columns={4}
            items={[
              {
                label: "Yayıncı profili",
                value: fmtBrandCount(poolSummary.count),
                sub: "yayında",
                icon: <Users size={18} />,
                tone: "primary",
              },
              {
                label: "Toplam takipçi",
                value: fmtCompactViews(poolSummary.followers),
                sub: "havuz toplamı",
                icon: <Users size={18} />,
                tone: "blue",
              },
              {
                label: "Ort. izlenme",
                value: fmtCompactViews(Math.round(poolSummary.avgViews)),
                sub: "profil başı",
                icon: <Eye size={18} />,
                tone: "violet",
              },
              {
                label: "Kategori",
                value: fmtBrandCount(poolSummary.categories),
                sub: "farklı etiket",
                icon: <Globe2 size={18} />,
                tone: "amber",
              },
            ]}
          />

          {/* Filtre çubuğu */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applySearch();
                      }
                    }}
                    placeholder="Yayıncı adı, kategori veya açıklama ara…"
                    className="pl-9"
                  />
                </div>
                <Button size="sm" onClick={applySearch}>
                  Ara
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  <SlidersHorizontal size={12} />
                  Filtreler
                </Button>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={clearFilters}
                  >
                    Temizle
                  </Button>
                )}
              </div>

              {allCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map((c) => {
                    const active = filters.category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCategory(c)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                          active
                            ? "border-[#FF6B00] bg-[#FF6B00]/15 text-[#FF6B00]"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}

              {filtersOpen && (
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 md:grid-cols-4">
                  <Field label="Dil">
                    <Select
                      value={filters.language ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          language: e.target.value || undefined,
                        }))
                      }
                      options={[
                        { value: "", label: "Tümü" },
                        ...LANGUAGES.map((l) => ({ value: l, label: l.toUpperCase() })),
                      ]}
                    />
                  </Field>
                  <Field label="Ülke">
                    <Select
                      value={filters.country ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          country: e.target.value || undefined,
                        }))
                      }
                      options={[
                        { value: "", label: "Tümü" },
                        ...COUNTRIES.map((c) => ({ value: c, label: c })),
                      ]}
                    />
                  </Field>
                  <Field label="Min ücret (USD)">
                    <OptionalNumberInput
                      value={filters.minRate}
                      onChange={(n) => setFilters((f) => ({ ...f, minRate: n }))}
                      min={0}
                      placeholder="—"
                    />
                  </Field>
                  <Field label="Max ücret (USD)">
                    <OptionalNumberInput
                      value={filters.maxRate}
                      onChange={(n) => setFilters((f) => ({ ...f, maxRate: n }))}
                      min={0}
                      placeholder="—"
                    />
                  </Field>
                  <Field label="Min takipçi">
                    <OptionalNumberInput
                      value={filters.minFollowers}
                      onChange={(n) => setFilters((f) => ({ ...f, minFollowers: n }))}
                      min={0}
                      placeholder="—"
                    />
                  </Field>
                  <Field label="Max takipçi">
                    <OptionalNumberInput
                      value={filters.maxFollowers}
                      onChange={(n) => setFilters((f) => ({ ...f, maxFollowers: n }))}
                      min={0}
                      placeholder="—"
                    />
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Grid */}
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Havuz yükleniyor…
            </div>
          ) : profiles.length === 0 ? (
            <EmptyPool notReady={notReady} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((p) => (
                <MarkaPoolCard
                  key={p.id}
                  profile={p}
                  brandId={brandId}
                  monthYm={month}
                  storeSlice={storeSlice}
                  onOfferClick={(profile) => setSelectedProfile(profile)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users size={11} />
              {profiles.length} yayıncı listeleniyor
            </span>
            {hasActiveFilters && (
              <span>Filtreler aktif — temizlemek için "Temizle"</span>
            )}
          </div>

          <OfferFormModal
            open={selectedProfile !== null}
            onClose={() => setSelectedProfile(null)}
            profile={selectedProfile}
            brandId={brandId}
            initiator="brand"
            onCreated={() => {
              void load();
            }}
          />
        </div>
      )}
    </MarkaPageGuard>
  );
}

function EmptyPool({ notReady }: { notReady: boolean }) {
  if (notReady) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
        <Users size={28} className="mx-auto mb-2 text-muted-foreground/70" />
        <p className="text-sm font-medium text-foreground">Havuz boş</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sunucu hazırlandıktan sonra yayıncı profilleri burada görünecek.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <Users size={28} className="mx-auto mb-2 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">
        Eşleşen yayıncı bulunamadı
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Filtreleri değiştirip tekrar deneyin.
      </p>
    </div>
  );
}
