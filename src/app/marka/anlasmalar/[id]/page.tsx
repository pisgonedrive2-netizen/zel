"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Eye,
  FileSignature,
  Handshake,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Video,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { useStore } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FormActions,
  FormGrid,
  Input,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import { PlatformGlyph } from "@/lib/platform-glyph";
import { cn } from "@/lib/utils";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { fmtDateOnly, fmtDateTime } from "@/lib/fmt-date";
import {
  deletePost,
  fetchDealDetail,
  fetchPosts,
  isPoolNotReadyError,
  refreshPostMetrics,
  updateDeal,
} from "@/lib/streamer-pool-api";
import { PoolServerBanner } from "@/components/streamer-pool/pool-server-banner";
import { PostFormModal } from "@/components/streamer-pool/post-form-modal";
import {
  BRAND_DEAL_STATUS_BADGE_CLS,
  BRAND_DEAL_STATUS_LABELS,
  BRAND_DEAL_TYPE_LABELS,
  BRAND_POST_PLATFORM_LABELS,
  BRAND_POST_STATUS_BADGE_CLS,
  BRAND_POST_STATUS_LABELS,
  BRAND_POST_TYPE_LABELS,
  type BrandDealStatus,
} from "@/types/brand-deals";
import type { BrandDeal, BrandPost } from "@/store/store";

export default function MarkaAnlasmaDetayPage() {
  const params = useParams<{ id: string }>();
  const dealId = params?.id;
  const portal = useMarkaPortal();
  const { user, brandId, brand, canViewBrand } = portal;
  const employees = useStore((s) => s.employees);

  const [deal, setDeal] = useState<BrandDeal | null>(null);
  const [posts, setPosts] = useState<BrandPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    setNotReady(false);
    try {
      const [d, p] = await Promise.all([
        fetchDealDetail(dealId),
        fetchPosts({ dealId }),
      ]);
      setDeal(d);
      setPosts(p);
    } catch (err) {
      if (isPoolNotReadyError(err)) {
        setNotReady(true);
      } else {
        setError(err instanceof Error ? err.message : "Anlaşma yüklenemedi");
      }
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const streamerLabel = useMemo(() => {
    if (!deal) return "";
    const e = employees.find((emp) => emp.id === deal.employeeId);
    return e?.name ?? deal.employeeId;
  }, [employees, deal]);

  async function handleRefreshMetric(postId: string) {
    setRefreshingId(postId);
    try {
      const updated = await refreshPostMetrics(postId);
      setPosts((arr) => arr.map((p) => (p.id === postId ? updated : p)));
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Metrik güncellenemedi"
      );
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleDeletePost(postId: string) {
    const ok = window.confirm("Bu postu silmek istediğinize emin misiniz?");
    if (!ok) return;
    try {
      await deletePost(postId);
      setPosts((arr) => arr.filter((p) => p.id !== postId));
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/marka/anlasmalar"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={12} /> Anlaşmalar
            </Link>
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

          {notReady && <PoolServerBanner />}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {loading && !deal ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Anlaşma yükleniyor…
            </div>
          ) : !deal ? (
            !notReady && (
              <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
                Anlaşma bulunamadı.
              </div>
            )
          ) : (
            <>
              <DealSummary
                deal={deal}
                streamerLabel={streamerLabel}
                onEdit={() => setEditOpen(true)}
              />

              <DeliverableChecklist deal={deal} postCount={posts.length} />

              <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Video size={14} className="text-[#FF6B00]" />
                      İlişkili postlar ({posts.length})
                    </CardTitle>
                    <CardDescription>
                      Bu anlaşma için yüklenmiş içerik URL'leri.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setPostModalOpen(true)}
                  >
                    <Plus size={12} /> Post ekle
                  </Button>
                </CardHeader>
                <CardContent>
                  {posts.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                      Henüz post yok. "Post ekle" ile URL paste edebilirsiniz.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {posts
                        .slice()
                        .sort((a, b) =>
                          (b.postedAt ?? b.createdAt).localeCompare(
                            a.postedAt ?? a.createdAt
                          )
                        )
                        .map((post) => (
                          <PostRow
                            key={post.id}
                            post={post}
                            refreshing={refreshingId === post.id}
                            onRefresh={() => handleRefreshMetric(post.id)}
                            onDelete={() => handleDeletePost(post.id)}
                          />
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <DealEditModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                deal={deal}
                onSaved={(next) => {
                  setDeal(next);
                  setEditOpen(false);
                }}
              />

              <PostFormModal
                open={postModalOpen}
                onClose={() => setPostModalOpen(false)}
                brandId={brandId}
                defaultDealId={deal.id}
                employeeId={deal.employeeId}
                deals={[deal]}
                onSaved={(post) => {
                  setPosts((arr) => [post, ...arr]);
                  void load();
                }}
              />
            </>
          )}
        </div>
      )}
    </MarkaPageGuard>
  );
}

function DealSummary({
  deal,
  streamerLabel,
  onEdit,
}: {
  deal: BrandDeal;
  streamerLabel: string;
  onEdit: () => void;
}) {
  const pct =
    deal.budgetUsd > 0
      ? Math.min(100, (deal.paidUsd / deal.budgetUsd) * 100)
      : 0;
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#22C55E]/12 via-transparent to-[#3B82F6]/10"
      />
      <CardHeader className="relative flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("border", BRAND_DEAL_STATUS_BADGE_CLS[deal.status])}
            >
              {BRAND_DEAL_STATUS_LABELS[deal.status]}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {BRAND_DEAL_TYPE_LABELS[deal.dealType]}
            </Badge>
          </div>
          <CardTitle className="text-xl">{deal.title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Handshake size={12} /> {streamerLabel}
            {deal.startDate && (
              <>
                <span>·</span>
                <CalendarRange size={12} /> {fmtDateOnly(deal.startDate)}
              </>
            )}
            {deal.endDate && (
              <>
                <span>→</span>
                {fmtDateOnly(deal.endDate)}
              </>
            )}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil size={12} /> Düzenle
        </Button>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Bütçe / Ödenen</span>
            <span className="tabular-nums">
              <strong>{fmtBrandMoney(deal.paidUsd, "USD")}</strong>
              <span className="text-muted-foreground">
                {" "}
                / {fmtBrandMoney(deal.budgetUsd, "USD")}
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SmallStat label="Post" value={deal.postsCount.toString()} icon={Video} />
          <SmallStat
            label="İzlenme"
            value={fmtCompactViews(Number(deal.totalViews))}
            icon={Eye}
          />
          <SmallStat label="Oluşturma" value={fmtDateOnly(deal.createdAt)} icon={CalendarRange} />
          <SmallStat label="Güncel" value={fmtDateTime(deal.updatedAt)} icon={CalendarRange} />
        </div>

        {deal.notes && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <p className="mb-1 font-semibold text-foreground">Not</p>
            <p className="whitespace-pre-line text-muted-foreground">{deal.notes}</p>
          </div>
        )}

        {deal.contractUrl && (
          <a
            href={deal.contractUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#3B82F6] hover:underline"
          >
            <FileSignature size={11} /> Sözleşme PDF
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon size={10} />
        <span>{label}</span>
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function DeliverableChecklist({
  deal,
  postCount,
}: {
  deal: BrandDeal;
  postCount: number;
}) {
  if (deal.deliverables.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 size={14} className="text-[#22C55E]" />
          Deliverable check-list
        </CardTitle>
        <CardDescription>
          Toplam yüklenen post sayısına göre ilerleme. Detaylı eşleştirme yakında.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {deal.deliverables.map((d, i) => {
          // postCount global; tek bir deliverable için ayrı sayım API'dan henüz
          // gelmiyor. Basit ilerleme: postCount / count.
          const pct = d.count > 0 ? Math.min(100, (postCount / d.count) * 100) : 0;
          return (
            <div
              key={`${d.type}-${d.platform ?? ""}-${i}`}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {BRAND_POST_TYPE_LABELS[d.type as keyof typeof BRAND_POST_TYPE_LABELS] ?? d.type}
                  </span>
                  {d.platform && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {BRAND_POST_PLATFORM_LABELS[
                        d.platform as keyof typeof BRAND_POST_PLATFORM_LABELS
                      ] ?? d.platform}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.min(postCount, d.count)} / {d.count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-[#22C55E]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PostRow({
  post,
  refreshing,
  onRefresh,
  onDelete,
}: {
  post: BrandPost;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border bg-card p-3">
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
          <Badge
            variant="outline"
            className={cn("ml-auto border text-[10px]", BRAND_POST_STATUS_BADGE_CLS[post.status])}
          >
            {BRAND_POST_STATUS_LABELS[post.status]}
          </Badge>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
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
      <div className="flex flex-col items-end gap-1">
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-medium text-[#3B82F6] hover:underline"
        >
          Aç →
        </a>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Metriği yenile"
          >
            <RefreshCcw size={11} className={refreshing ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Sil"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </li>
  );
}

function DealEditModal({
  open,
  onClose,
  deal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  deal: BrandDeal;
  onSaved: (deal: BrandDeal) => void;
}) {
  const [budgetUsd, setBudgetUsd] = useState(deal.budgetUsd);
  const [paidUsd, setPaidUsd] = useState(deal.paidUsd);
  const [notes, setNotes] = useState(deal.notes);
  const [status, setStatus] = useState<BrandDealStatus>(deal.status);
  const [startDate, setStartDate] = useState(deal.startDate ?? "");
  const [endDate, setEndDate] = useState(deal.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBudgetUsd(deal.budgetUsd);
    setPaidUsd(deal.paidUsd);
    setNotes(deal.notes);
    setStatus(deal.status);
    setStartDate(deal.startDate ?? "");
    setEndDate(deal.endDate ?? "");
    setError(null);
    setBusy(false);
  }, [open, deal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await updateDeal(deal.id, {
        budgetUsd,
        paidUsd,
        notes,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncelleme başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title="Anlaşma düzenle">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGrid>
          <Field label="Bütçe (USD)" required>
            <NumberInput value={budgetUsd} onChange={setBudgetUsd} min={0} />
          </Field>
          <Field label="Ödenen (USD)">
            <NumberInput value={paidUsd} onChange={setPaidUsd} min={0} />
          </Field>
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
          <Field label="Durum">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as BrandDealStatus)}
              options={Object.entries(BRAND_DEAL_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Field>
          <div />
        </FormGrid>
        <Field label="Not">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anlaşma notu (yalnızca markaya görünür)"
          />
        </Field>
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <FormActions
          onCancel={onClose}
          submitLabel={busy ? "Kaydediliyor…" : "Kaydet"}
        />
      </form>
    </Modal>
  );
}
