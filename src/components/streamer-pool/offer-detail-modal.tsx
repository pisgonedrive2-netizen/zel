"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Handshake,
  Loader2,
  MessageSquare,
  Send,
  ShieldX,
  Sparkles,
  Undo2,
  XCircle,
} from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  Input,
  OptionalNumberInput,
  Textarea,
} from "@/components/ui/field";
import { fmtBrandMoney } from "@/lib/brand-monthly-stats";
import { fmtDateTime } from "@/lib/fmt-date";
import { cn } from "@/lib/utils";
import {
  BRAND_OFFER_STATUS_BADGE_CLS,
  BRAND_OFFER_STATUS_LABELS,
  BRAND_OFFER_TYPE_LABELS,
  OFFER_DELIVERABLE_LABELS,
  OFFER_PLATFORM_LABELS,
  type BrandOfferStatus,
} from "@/types/streamer-pool";
import {
  fetchOfferDetail,
  postOfferMessage,
  respondToOffer,
  withdrawOffer,
} from "@/lib/streamer-pool-api";
import type {
  BrandOffer,
  BrandOfferDeliverable,
  BrandOfferMessage,
} from "@/store/store";

export interface OfferDetailViewerInfo {
  /** Görüntüleyen kullanıcının rolü — sohbet hizalaması ve aksiyon yetkisi belirler. */
  role: "brand" | "streamer" | "admin";
  /** Bu kullanıcının kim olduğunu kısaca anlatan label (mesaj balonu üstünde). */
  displayName?: string;
  /** Teklifi başlatan kişi mi? (geri çekme yetkisi). */
  isInitiator?: boolean;
}

interface OfferDetailModalProps {
  open: boolean;
  onClose: () => void;
  offerId: string | null;
  viewer: OfferDetailViewerInfo;
  /** İsim çözücüler — opsiyonel. */
  brandLabel?: string;
  streamerLabel?: string;
  /** Aksiyon başarılıysa parent listeyi yenilemek için. */
  onMutated?: () => void;
}

/**
 * Teklif detay modali — marka ve yayıncı tarafında ortak.
 *
 * - Mesaj akışı (brand sağ, streamer sol, admin gri — viewer rolüne göre yön).
 * - Aksiyon barı offer.status'a göre değişir:
 *   pending|negotiating → mesaj + karşı teklif + kabul/red + iptal (initiator)
 *   accepted            → "Anlaşmaya git" linki
 *   rejected/withdrawn  → read-only
 */
export function OfferDetailModal({
  open,
  onClose,
  offerId,
  viewer,
  brandLabel,
  streamerLabel,
  onMutated,
}: OfferDetailModalProps) {
  const [offer, setOffer] = useState<BrandOffer | null>(null);
  const [messages, setMessages] = useState<BrandOfferMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [counterBudget, setCounterBudget] = useState<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const load = useMemo(
    () => async () => {
      if (!offerId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchOfferDetail(offerId);
        setOffer(data.offer);
        setMessages(data.messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Teklif yüklenemedi");
      } finally {
        setLoading(false);
      }
    },
    [offerId]
  );

  useEffect(() => {
    if (!open || !offerId) return;
    setOffer(null);
    setMessages([]);
    setDraftMessage("");
    setCounterBudget(undefined);
    setActionError(null);
    void load();
  }, [open, offerId, load]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages.length]);

  async function doSendMessage() {
    if (!offer || !draftMessage.trim()) return;
    setActionBusy("message");
    setActionError(null);
    try {
      const next = await postOfferMessage(offer.id, {
        body: draftMessage.trim(),
        counterBudgetUsd: counterBudget,
      });
      setMessages((arr) => [...arr, next]);
      setDraftMessage("");
      setCounterBudget(undefined);
      onMutated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Mesaj gönderilemedi");
    } finally {
      setActionBusy(null);
    }
  }

  async function doRespond(action: "accept" | "reject" | "counter") {
    if (!offer) return;
    setActionBusy(action);
    setActionError(null);
    try {
      const res = await respondToOffer(offer.id, {
        action,
        counterBudgetUsd: action === "counter" ? counterBudget : undefined,
        message: draftMessage.trim() || undefined,
      });
      setOffer(res.offer);
      setDraftMessage("");
      setCounterBudget(undefined);
      onMutated?.();
      // Mesajları yeniden çek (yanıt mesaj olarak eklenmiş olabilir)
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Aksiyon başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  async function doWithdraw() {
    if (!offer) return;
    const ok = typeof window === "undefined" ? true : window.confirm("Teklifi geri çekmek istediğinize emin misiniz?");
    if (!ok) return;
    setActionBusy("withdraw");
    setActionError(null);
    try {
      const next = await withdrawOffer(offer.id);
      setOffer(next);
      onMutated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Geri çekme başarısız");
    } finally {
      setActionBusy(null);
    }
  }

  const status: BrandOfferStatus | undefined = offer?.status;
  const isOpenForActions = status === "pending" || status === "negotiating";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? `Teklif · ${offer.title}` : "Teklif detayı"}
      size="full"
    >
      {loading && !offer && (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={16} className="mr-2 animate-spin" /> Yükleniyor…
        </div>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {offer && (
        <div className="flex h-full min-h-0 flex-col gap-4 md:flex-row">
          <aside className="w-full shrink-0 space-y-3 md:w-[280px]">
            <SummaryPanel
              offer={offer}
              brandLabel={brandLabel}
              streamerLabel={streamerLabel}
            />
            <DeliverableList items={offer.deliverables} />
            {offer.notes && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-1 font-semibold text-foreground">Not</p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {offer.notes}
                </p>
              </div>
            )}
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-background/40">
            <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={12} />
                Mesaj akışı ({messages.length})
              </span>
              {viewer.isInitiator && isOpenForActions && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="gap-1 text-muted-foreground hover:text-destructive"
                  onClick={doWithdraw}
                  disabled={actionBusy === "withdraw"}
                >
                  <Undo2 size={11} /> Teklifi geri çek
                </Button>
              )}
            </header>

            <div className="flex min-h-[280px] flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
              {messages.length === 0 ? (
                <p className="my-auto text-center text-xs text-muted-foreground">
                  Henüz mesaj yok. İlk mesajı gönderin.
                </p>
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    viewerRole={viewer.role}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {isOpenForActions ? (
              <div className="border-t border-border px-3 py-3">
                {actionError && (
                  <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                    {actionError}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px]">
                  <Textarea
                    rows={2}
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    placeholder="Mesajınızı yazın…"
                  />
                  <Field label="Karşı teklif (USD)">
                    <OptionalNumberInput
                      value={counterBudget}
                      onChange={(n) => setCounterBudget(n)}
                      placeholder="—"
                      min={0}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={doSendMessage}
                    disabled={actionBusy !== null || !draftMessage.trim()}
                    className="gap-1.5"
                  >
                    <Send size={12} />
                    {actionBusy === "message" ? "Gönderiliyor…" : "Mesaj gönder"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => doRespond("counter")}
                    disabled={actionBusy !== null || counterBudget == null}
                    className="gap-1.5"
                  >
                    <Sparkles size={12} />
                    {actionBusy === "counter" ? "…" : "Karşı teklif"}
                  </Button>
                  <span className="ml-auto flex flex-wrap gap-2">
                    {viewer.role !== "admin" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => doRespond("reject")}
                          disabled={actionBusy !== null}
                          className="gap-1.5 text-destructive hover:border-destructive/40"
                        >
                          <XCircle size={12} />
                          {actionBusy === "reject" ? "…" : "Reddet"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => doRespond("accept")}
                          disabled={actionBusy !== null}
                          className="gap-1.5 bg-[#22C55E] text-white hover:bg-[#22C55E]/90"
                        >
                          <Check size={12} />
                          {actionBusy === "accept" ? "…" : "Kabul et"}
                        </Button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <ClosedActionBar
                offer={offer}
                viewerRole={viewer.role}
              />
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function SummaryPanel({
  offer,
  brandLabel,
  streamerLabel,
}: {
  offer: BrandOffer;
  brandLabel?: string;
  streamerLabel?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={cn("border", BRAND_OFFER_STATUS_BADGE_CLS[offer.status])}
        >
          {BRAND_OFFER_STATUS_LABELS[offer.status]}
        </Badge>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {BRAND_OFFER_TYPE_LABELS[offer.offerType]}
        </Badge>
      </div>

      <div className="space-y-1.5 text-xs">
        <SummaryRow label="Marka" value={brandLabel ?? offer.brandId} />
        <SummaryRow label="Yayıncı" value={streamerLabel ?? offer.employeeId} />
        <SummaryRow
          label="Bütçe"
          value={
            offer.budgetUsd != null
              ? fmtBrandMoney(offer.budgetUsd, "USD")
              : "—"
          }
        />
        {(offer.startDate || offer.endDate) && (
          <SummaryRow
            label="Tarih aralığı"
            value={`${offer.startDate ?? "—"} → ${offer.endDate ?? "—"}`}
          />
        )}
        <SummaryRow
          label="Başlatan"
          value={offer.initiator === "brand" ? "Marka" : "Yayıncı"}
        />
        <SummaryRow label="Oluşturma" value={fmtDateTime(offer.createdAt)} />
      </div>

      {offer.description && (
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Açıklama</p>
          <p className="whitespace-pre-line">{offer.description}</p>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function DeliverableList({ items }: { items: BrandOfferDeliverable[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Deliverable
      </p>
      <ul className="space-y-1.5">
        {items.map((d, i) => (
          <li
            key={`${d.type}-${d.platform ?? ""}-${i}`}
            className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"
          >
            <span className="font-medium">
              {humanLabel(OFFER_DELIVERABLE_LABELS, d.type)}
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {d.platform && (
                <span>{humanLabel(OFFER_PLATFORM_LABELS, d.platform)}</span>
              )}
              <span className="tabular-nums">×{d.count}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function humanLabel(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

function MessageBubble({
  message,
  viewerRole,
}: {
  message: BrandOfferMessage;
  viewerRole: "brand" | "streamer" | "admin";
}) {
  const isAdmin = message.authorRole === "admin";
  // Sohbet hizalaması: viewer ile aynı taraf sağda
  const align =
    isAdmin
      ? "center"
      : message.authorRole === viewerRole
        ? "right"
        : "left";
  const tone =
    isAdmin
      ? "bg-muted text-foreground border-border"
      : message.authorRole === "brand"
        ? "bg-[#FF6B00]/10 border-[#FF6B00]/30 text-foreground dark:bg-[#FF6B00]/20"
        : "bg-[#22C55E]/10 border-[#22C55E]/30 text-foreground dark:bg-[#22C55E]/20";
  return (
    <div
      className={cn(
        "flex w-full",
        align === "right" && "justify-end",
        align === "left" && "justify-start",
        align === "center" && "justify-center"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl border px-3 py-2 text-xs shadow-sm",
          tone
        )}
      >
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="font-semibold">
            {message.authorRole === "brand"
              ? "Marka"
              : message.authorRole === "streamer"
                ? "Yayıncı"
                : "Yönetici"}
          </span>
          <span>·</span>
          <span>{fmtDateTime(message.createdAt)}</span>
        </div>
        {message.counterBudgetUsd != null && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-md border border-current/30 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold">
            <Sparkles size={10} />
            Karşı teklif: {fmtBrandMoney(message.counterBudgetUsd, "USD")}
          </div>
        )}
        <p className="whitespace-pre-line">{message.body}</p>
      </div>
    </div>
  );
}

function ClosedActionBar({
  offer,
  viewerRole,
}: {
  offer: BrandOffer;
  viewerRole: "brand" | "streamer" | "admin";
}) {
  const status = offer.status;
  const dealHref =
    viewerRole === "brand"
      ? offer.createdDealId
        ? `/marka/anlasmalar/${offer.createdDealId}`
        : "/marka/anlasmalar"
      : viewerRole === "streamer"
        ? "/yayinci/postlar"
        : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        {status === "accepted" ? (
          <Handshake size={12} className="text-emerald-600" />
        ) : status === "rejected" ? (
          <ShieldX size={12} className="text-red-600" />
        ) : status === "withdrawn" ? (
          <Undo2 size={12} />
        ) : (
          <CalendarDays size={12} />
        )}
        Bu teklif {BRAND_OFFER_STATUS_LABELS[status]?.toLowerCase()}.
      </span>
      {status === "accepted" && dealHref && (
        <Link
          href={dealHref}
          className="inline-flex items-center gap-1 rounded-md bg-[#22C55E] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#22C55E]/90"
        >
          Anlaşmaya git <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}
