"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/modal";
import {
  Field,
  FormActions,
  FormGrid,
  Input,
  OptionalNumberInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { createPost, updatePost } from "@/lib/streamer-pool-api";
import {
  BRAND_POST_PLATFORM_LABELS,
  BRAND_POST_TYPE_LABELS,
  type BrandPostPlatform,
  type BrandPostType,
} from "@/types/brand-deals";
import type { BrandDeal, BrandPost } from "@/store/store";

interface PostFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Marka tarafında zorunlu; yayıncı tarafında seçilen deal'dan türetilir. */
  brandId?: string;
  /** Yayıncı tarafında doldurulur (kendi employeeId'si). */
  employeeId?: string;
  /** Kullanıcının seçebileceği aktif deal'lar (opsiyonel). */
  deals?: BrandDeal[];
  /** Önceden seçili deal. Marka anlaşma detayından açılırken kullanılır. */
  defaultDealId?: string;
  /** Düzenleme modunda varolan post. */
  editingPost?: BrandPost | null;
  /**
   * Eğer true ise yayıncı tarafında brandId mevcut deal'dan türetilir,
   * deal seçimi zorunludur.
   */
  requireDealForBrand?: boolean;
  onSaved: (post: BrandPost) => void;
}

/**
 * Post ekleme/düzenleme modali. Marka ve yayıncı tarafında ortak kullanılır.
 */
export function PostFormModal({
  open,
  onClose,
  brandId,
  employeeId,
  deals,
  defaultDealId,
  editingPost,
  requireDealForBrand = false,
  onSaved,
}: PostFormModalProps) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<BrandPostPlatform>("instagram");
  const [postType, setPostType] = useState<BrandPostType>("reel");
  const [caption, setCaption] = useState("");
  const [dealId, setDealId] = useState<string>("");
  const [views, setViews] = useState<number | undefined>(undefined);
  const [likes, setLikes] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      setUrl(editingPost.url);
      setPlatform(editingPost.platform);
      setPostType(editingPost.postType);
      setCaption(editingPost.caption ?? "");
      setDealId(editingPost.dealId ?? "");
      setViews(editingPost.views || undefined);
      setLikes(editingPost.likes || undefined);
    } else {
      setUrl("");
      setPlatform("instagram");
      setPostType("reel");
      setCaption("");
      setDealId(defaultDealId ?? "");
      setViews(undefined);
      setLikes(undefined);
    }
    setError(null);
    setSubmitting(false);
  }, [open, editingPost, defaultDealId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("URL zorunlu.");
      return;
    }
    let resolvedBrandId = brandId;
    if (requireDealForBrand) {
      const deal = deals?.find((d) => d.id === dealId);
      if (!deal) {
        setError("Bir anlaşma seçmelisiniz (postun hangi markaya ait olduğu için).");
        return;
      }
      resolvedBrandId = deal.brandId;
    }
    if (!editingPost && !resolvedBrandId) {
      setError("Marka bilgisi eksik.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editingPost) {
        const next = await updatePost(editingPost.id, {
          postType,
          caption: caption.trim(),
          views,
          likes,
        });
        onSaved(next);
      } else {
        const created = await createPost({
          brandId: resolvedBrandId!,
          employeeId,
          dealId: dealId || undefined,
          url: url.trim(),
          platform,
          postType,
          caption: caption.trim(),
          views,
          likes,
        });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={editingPost ? "Post düzenle" : "Post ekle"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Post URL" required>
          <Input
            value={url}
            disabled={!!editingPost}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://instagram.com/p/..."
            required
          />
        </Field>

        <FormGrid>
          <Field label="Platform" required>
            <Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as BrandPostPlatform)}
              disabled={!!editingPost}
              options={Object.entries(BRAND_POST_PLATFORM_LABELS).map(
                ([value, label]) => ({ value, label })
              )}
            />
          </Field>
          <Field label="Tip">
            <Select
              value={postType}
              onChange={(e) => setPostType(e.target.value as BrandPostType)}
              options={Object.entries(BRAND_POST_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Field>
        </FormGrid>

        {deals && deals.length > 0 && (
          <Field label="Anlaşma (opsiyonel)" hint="Postu bir anlaşmaya bağlayabilirsiniz.">
            <Select
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              disabled={!!editingPost}
              options={[
                { value: "", label: "— Bağımsız —" },
                ...deals.map((d) => ({
                  value: d.id,
                  label: d.title,
                })),
              ]}
            />
          </Field>
        )}

        <Field label="Açıklama / caption">
          <Textarea
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Postun caption'ı veya açıklama notu."
          />
        </Field>

        <FormGrid>
          <Field label="İzlenme (manuel)" hint="Otomatik metrik aktifse boş bırakın.">
            <OptionalNumberInput
              value={views}
              onChange={(n) => setViews(n)}
              min={0}
              placeholder="—"
            />
          </Field>
          <Field label="Beğeni (manuel)">
            <OptionalNumberInput
              value={likes}
              onChange={(n) => setLikes(n)}
              min={0}
              placeholder="—"
            />
          </Field>
        </FormGrid>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <FormActions
          onCancel={onClose}
          submitLabel={submitting ? "Kaydediliyor…" : editingPost ? "Güncelle" : "Ekle"}
        />
        {submitting && (
          <p className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 size={11} className="animate-spin" /> Sunucuya gönderiliyor…
          </p>
        )}
      </form>
    </Modal>
  );
}
