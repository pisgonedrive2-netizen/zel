"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Info,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Video,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { PlatformGlyph } from "@/lib/platform-glyph";
import { cn } from "@/lib/utils";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { fmtDateOnly } from "@/lib/fmt-date";
import {
  deletePost,
  fetchDeals,
  fetchPosts,
  isPoolNotReadyError,
} from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import { PostFormModal } from "@/components/streamer-pool/post-form-modal";
import { PostActivityCalendar } from "@/components/streamer-pool/post-activity-calendar";
import { DailyContentCheckin } from "@/components/streamer/daily-content-checkin";
import { AchievementLinkSyncBar } from "@/components/streamer/achievement-link-sync-bar";
import {
  activityDatesList,
  buildStreamerActivity,
} from "@/lib/streamer-activity-dates";
import {
  BRAND_POST_PLATFORM_LABELS,
  BRAND_POST_STATUS_BADGE_CLS,
  BRAND_POST_STATUS_LABELS,
  BRAND_POST_TYPE_LABELS,
  type BrandPostPlatform,
} from "@/types/brand-deals";
import type { BrandDeal, BrandPost } from "@/store/store";

export default function YayinciPostlarPage() {
  const { user } = useAuth();
  const brands = useStore((s) => s.brands);
  const weekBrandReels = useStore((s) => s.weekBrandReels);
  const storeBrandPosts = useStore((s) => s.brandPosts);
  const brandDeals = useStore((s) => s.brandDeals);
  const brandLinks = useStore((s) => s.brandLinks);
  const addWeekBrandReel = useStore((s) => s.addWeekBrandReel);
  const updateWeekBrandReel = useStore((s) => s.updateWeekBrandReel);
  const deleteWeekBrandReel = useStore((s) => s.deleteWeekBrandReel);
  const employeeId = user?.employeeId;

  const [posts, setPosts] = useState<BrandPost[]>([]);
  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<BrandPostPlatform | "">("");
  const [dealFilter, setDealFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const [p, d] = await Promise.all([
        fetchPosts({ employeeId }),
        fetchDeals({ employeeId, status: "active" }).catch(
          () => [] as BrandDeal[]
        ),
      ]);
      setPosts(p);
      setDeals(d);
    } catch (err) {
      if (isPoolNotReadyError(err)) {
        setNotReady(true);
        setPosts([]);
      } else {
        setError(err instanceof Error ? err.message : "Yükleme hatası");
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mergedPosts = useMemo(() => {
    if (!employeeId) return [] as BrandPost[];
    const byId = new Map<string, BrandPost>();
    for (const p of storeBrandPosts) byId.set(p.id, p);
    for (const p of posts) byId.set(p.id, p);
    return [...byId.values()];
  }, [storeBrandPosts, posts, employeeId]);

  const filtered = useMemo(() => {
    return mergedPosts
      .filter((p) => {
        if (platformFilter && p.platform !== platformFilter) return false;
        if (dealFilter && p.dealId !== dealFilter) return false;
        return true;
      })
      .sort((a, b) =>
        (b.postedAt ?? b.createdAt).localeCompare(a.postedAt ?? a.createdAt)
      );
  }, [mergedPosts, platformFilter, dealFilter]);

  const activityOpts = useMemo(
    () => ({ brandDeals, brandLinks }),
    [brandDeals, brandLinks]
  );

  const activity = useMemo(() => {
    if (!employeeId) return { dates: [] as string[], byDate: new Map() };
    return buildStreamerActivity(
      employeeId,
      weekBrandReels,
      mergedPosts,
      activityOpts
    );
  }, [mergedPosts, weekBrandReels, employeeId, activityOpts]);

  const activityDates = useMemo(
    () => activityDatesList(activity.byDate),
    [activity.byDate]
  );

  const brandLabel = useCallback(
    (id: string) => brands.find((b) => b.id === id)?.name ?? id,
    [brands]
  );

  const dealOptions = useMemo(
    () => [
      { value: "", label: "Tüm anlaşmalar" },
      ...deals.map((d) => ({ value: d.id, label: d.title })),
    ],
    [deals]
  );

  async function handleDelete(id: string) {
    const ok = window.confirm("Bu postu silmek istediğinize emin misiniz?");
    if (!ok) return;
    try {
      await deletePost(id);
      setPosts((arr) => arr.filter((p) => p.id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Silme başarısız");
    }
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

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video size={16} className="text-[#FF6B00]" />
              Postlarım
            </CardTitle>
            <CardDescription>
              Markalar için yüklediğiniz içerikler. URL paste ederek yeni post
              ekleyin.
            </CardDescription>
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
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus size={12} /> Post ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Field label="Platform">
              <Select
                value={platformFilter}
                onChange={(e) =>
                  setPlatformFilter(e.target.value as BrandPostPlatform | "")
                }
                options={[
                  { value: "", label: "Tümü" },
                  ...Object.entries(BRAND_POST_PLATFORM_LABELS).map(
                    ([value, label]) => ({ value, label })
                  ),
                ]}
              />
            </Field>
            <Field label="Anlaşma">
              <Select
                value={dealFilter}
                onChange={(e) => setDealFilter(e.target.value)}
                options={dealOptions}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {employeeId && (
        <AchievementLinkSyncBar employeeId={employeeId} employeeName={user?.name} />
      )}

      {employeeId && (
        <DailyContentCheckin
          employeeId={employeeId}
          brands={brands}
          reels={weekBrandReels}
          brandPosts={mergedPosts}
          brandDeals={brandDeals}
          brandLinks={brandLinks}
          onAdd={addWeekBrandReel}
          onUpdate={updateWeekBrandReel}
          onDelete={deleteWeekBrandReel}
        />
      )}

      <PostActivityCalendar
        activityDates={activityDates}
        byDate={activity.byDate}
      />

      <div className="flex items-start gap-3 rounded-xl border border-blue-300/60 bg-blue-50/60 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-100">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
        <p className="text-xs leading-relaxed">
          Yüklediğiniz postlar otomatik olarak marka paneline yansır ve anlaşma
          ilerlemenize sayılır. URL ve platform yeterli; ek istatistikleri marka
          gerekirse manuel girer.
        </p>
      </div>

      {notReady && <PoolServerBanner />}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
          <Video size={28} className="mx-auto mb-2 text-muted-foreground/70" />
          <p className="text-sm font-medium text-foreground">Henüz post eklemediniz</p>
          <p className="mt-1 text-xs text-muted-foreground">
            "Post ekle" ile içerik URL'inizi paste edin.
          </p>
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {filtered.map((post) => (
              <li
                key={post.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 hover:bg-muted/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  {post.screenshotUrl ? (
                    <img
                      src={post.screenshotUrl}
                      alt=""
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    <PlatformGlyph platform={post.platform} size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {BRAND_POST_PLATFORM_LABELS[post.platform]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {BRAND_POST_TYPE_LABELS[post.postType]}
                    </span>
                    <span className="text-muted-foreground">
                      · {brandLabel(post.brandId)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("ml-auto border text-[10px]", BRAND_POST_STATUS_BADGE_CLS[post.status])}
                    >
                      {BRAND_POST_STATUS_LABELS[post.status]}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-foreground">
                    {post.caption || post.url}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Eye size={10} />
                      {fmtCompactViews(Number(post.views))}
                    </span>
                    <span>{post.likes.toLocaleString("tr-TR")} ❤</span>
                    {post.postedAt && <span>· {fmtDateOnly(post.postedAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Aç"
                  >
                    <Eye size={11} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Sil"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {employeeId && (
        <PostFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          employeeId={employeeId}
          deals={deals}
          requireDealForBrand
          onSaved={(post) => {
            setPosts((arr) => [post, ...arr]);
            void load();
          }}
        />
      )}
    </div>
  );
}
