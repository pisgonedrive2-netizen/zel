"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Inbox,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Video,
  Heart,
  FileVideo,
  ShieldAlert,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
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
  refreshPostMetrics,
} from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import { PostFormModal } from "@/components/streamer-pool/post-form-modal";
import { MarkaAchievementPanel } from "@/components/marka/marka-achievement-panel";
import { MarkaStatGrid } from "@/components/marka/marka-stat-grid";
import { computePostListInsights } from "@/lib/marka-brand-insights";
import { fmtBrandCount } from "@/lib/brand-monthly-stats";
import {
  BRAND_POST_PLATFORM_LABELS,
  BRAND_POST_STATUS_BADGE_CLS,
  BRAND_POST_STATUS_LABELS,
  BRAND_POST_TYPE_LABELS,
  type BrandPostPlatform,
  type BrandPostStatus,
} from "@/types/brand-deals";
import type { BrandDeal, BrandPost } from "@/store/store";
import { fetchPostApprovals } from "@/lib/marka-igaming-api";
import {
  BRAND_POST_APPROVAL_LABELS,
  type BrandContentViolation,
  type BrandPostApproval,
} from "@/types/brand-igaming";

export default function MarkaPostlarPage() {
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand, isAdminView, month } = portal;
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const employees = useStore((s) => s.employees);

  const [posts, setPosts] = useState<BrandPost[]>([]);
  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<BrandPostPlatform | "">("");
  const [dealFilter, setDealFilter] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<BrandPostStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [approvalsByPost, setApprovalsByPost] = useState<
    Map<string, BrandPostApproval>
  >(new Map());
  const [violationsByPost, setViolationsByPost] = useState<
    Map<string, BrandContentViolation[]>
  >(new Map());

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const [p, d] = await Promise.all([
        fetchPosts({ brandId }),
        fetchDeals({ brandId, status: "active" }).catch(() => [] as BrandDeal[]),
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
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!brandId) return;
    fetchPostApprovals(brandId)
      .then(({ approvals, violations }) => {
        const aMap = new Map<string, BrandPostApproval>();
        for (const a of approvals) aMap.set(a.postId, a);
        setApprovalsByPost(aMap);
        const vMap = new Map<string, BrandContentViolation[]>();
        for (const v of violations) {
          if (!v.postId) continue;
          const list = vMap.get(v.postId) ?? [];
          list.push(v);
          vMap.set(v.postId, list);
        }
        setViolationsByPost(vMap);
      })
      .catch(() => {
        setApprovalsByPost(new Map());
        setViolationsByPost(new Map());
      });
  }, [brandId, posts.length]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (platformFilter && p.platform !== platformFilter) return false;
      if (dealFilter && p.dealId !== dealFilter) return false;
      if (employeeFilter && p.employeeId !== employeeFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [posts, platformFilter, dealFilter, employeeFilter, statusFilter]);

  const dealOptions = useMemo(
    () => [
      { value: "", label: "Tüm anlaşmalar" },
      ...deals.map((d) => ({ value: d.id, label: d.title })),
    ],
    [deals]
  );

  const postInsights = useMemo(
    () => computePostListInsights(filteredPosts),
    [filteredPosts]
  );

  const employeeOptions = useMemo(() => {
    const set = new Set(posts.map((p) => p.employeeId).filter(Boolean) as string[]);
    return [
      { value: "", label: "Tüm yayıncılar" },
      ...Array.from(set).map((id) => ({
        value: id,
        label: employees.find((e) => e.id === id)?.name ?? id,
      })),
    ];
  }, [posts, employees]);

  async function handleRefresh(id: string) {
    setRefreshingId(id);
    try {
      const next = await refreshPostMetrics(id);
      setPosts((arr) => arr.map((p) => (p.id === id ? next : p)));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Metrik güncellenemedi");
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Postu silmek istediğinize emin misiniz?");
    if (!ok) return;
    try {
      await deletePost(id);
      setPosts((arr) => arr.filter((p) => p.id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Silme başarısız");
    }
  }

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Video size={16} className="text-[#FF6B00]" />
                  Postlar
                </CardTitle>
                <CardDescription>
                  {brand.name} markası için yüklenen tüm içerik URL'leri.
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
                {!readOnly && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus size={12} /> Post ekle
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                <Field label="Yayıncı">
                  <Select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    options={employeeOptions}
                  />
                </Field>
                <Field label="Durum">
                  <Select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as BrandPostStatus | "")
                    }
                    options={[
                      { value: "", label: "Tümü" },
                      ...Object.entries(BRAND_POST_STATUS_LABELS).map(
                        ([value, label]) => ({ value, label })
                      ),
                    ]}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {filteredPosts.length > 0 && (
            <MarkaStatGrid
              columns={4}
              items={[
                {
                  label: "Post",
                  value: fmtBrandCount(postInsights.total),
                  icon: <FileVideo size={18} />,
                  tone: "primary",
                },
                {
                  label: "Toplam izlenme",
                  value: fmtCompactViews(postInsights.totalViews),
                  icon: <Eye size={18} />,
                  tone: "blue",
                },
                {
                  label: "Beğeni",
                  value: fmtCompactViews(postInsights.totalLikes),
                  icon: <Heart size={18} />,
                  tone: "rose",
                },
                {
                  label: "Platform",
                  value: fmtBrandCount(Object.keys(postInsights.byPlatform).length),
                  sub: Object.entries(postInsights.byPlatform)
                    .map(([k, v]) => `${k}: ${v}`)
                    .slice(0, 2)
                    .join(" · "),
                  tone: "violet",
                },
              ]}
            />
          )}

          {brandId && (
            <MarkaAchievementPanel
              brandId={brandId}
              brandName={brand.name}
              monthYm={month}
              extraPosts={posts}
              defaultOpen
            />
          )}

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
          ) : filteredPosts.length === 0 ? (
            <EmptyPosts notReady={notReady} />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-2 font-medium">Önizleme</th>
                      <th className="px-3 py-2 font-medium">Platform</th>
                      <th className="px-3 py-2 font-medium">Tip</th>
                      <th className="px-3 py-2 font-medium">Caption</th>
                      <th className="px-3 py-2 text-right font-medium">İzlenme</th>
                      <th className="px-3 py-2 text-right font-medium">Beğeni</th>
                      <th className="px-3 py-2 font-medium">Durum</th>
                      <th className="px-3 py-2 font-medium">Onay</th>
                      <th className="px-3 py-2 font-medium">Uyumluluk</th>
                      <th className="px-3 py-2 text-right font-medium">Eylem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts.map((post) => {
                      const approval = approvalsByPost.get(post.id);
                      const violations = violationsByPost.get(post.id) ?? [];
                      return (
                      <tr
                        key={post.id}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-3 py-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                            {post.screenshotUrl ? (
                              <img
                                src={post.screenshotUrl}
                                alt=""
                                className="h-full w-full rounded-md object-cover"
                              />
                            ) : (
                              <PlatformGlyph platform={post.platform} size={16} />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {BRAND_POST_PLATFORM_LABELS[post.platform]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {BRAND_POST_TYPE_LABELS[post.postType]}
                        </td>
                        <td className="px-3 py-2 max-w-[260px]">
                          <div className="truncate text-xs text-foreground">
                            {post.caption || post.url}
                          </div>
                          {post.postedAt && (
                            <div className="text-[10px] text-muted-foreground">
                              {fmtDateOnly(post.postedAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtCompactViews(Number(post.views))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {post.likes.toLocaleString("tr-TR")}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border text-[10px]",
                              BRAND_POST_STATUS_BADGE_CLS[post.status]
                            )}
                          >
                            {BRAND_POST_STATUS_LABELS[post.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {approval ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "border text-[10px]",
                                approval.status === "approved"
                                  ? "border-[#22C55E]/50 text-[#16A34A]"
                                  : approval.status === "rejected"
                                    ? "border-red-300 text-red-700"
                                    : "border-amber-300 text-amber-800"
                              )}
                            >
                              {BRAND_POST_APPROVAL_LABELS[approval.status]}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {violations.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {violations.map((v) => (
                                <Badge
                                  key={v.id}
                                  variant="outline"
                                  className={cn(
                                    "gap-0.5 text-[10px] w-fit",
                                    v.severity === "block"
                                      ? "border-red-400 text-red-700"
                                      : v.severity === "warn"
                                        ? "border-amber-300 text-amber-800"
                                        : ""
                                  )}
                                >
                                  <ShieldAlert size={9} />
                                  {v.violationType}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Temiz</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Aç"
                            >
                              <Eye size={11} />
                            </a>
                            {!readOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRefresh(post.id)}
                                  disabled={refreshingId === post.id}
                                  className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                                  title="Metriği yenile"
                                >
                                  <RefreshCcw
                                    size={11}
                                    className={refreshingId === post.id ? "animate-spin" : undefined}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(post.id)}
                                  className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title="Sil"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <PostFormModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            brandId={brandId}
            deals={deals}
            onSaved={(post) => {
              setPosts((arr) => [post, ...arr]);
              void load();
            }}
          />
        </div>
      )}
    </MarkaPageGuard>
  );
}

function EmptyPosts({ notReady }: { notReady: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <Inbox size={28} className="mx-auto mb-2 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground">
        {notReady ? "Henüz post yok" : "Eşleşen post bulunamadı"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {notReady
          ? "Sunucu hazırlandıktan sonra yayıncıların yüklediği postlar burada görünecek."
          : "Filtreleri değiştirip tekrar deneyin veya 'Post ekle' ile manuel ekleyin."}
      </p>
    </div>
  );
}
