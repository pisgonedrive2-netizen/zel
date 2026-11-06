"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { ProfilePostItem } from "@/lib/social-api/streamer-profile-posts";
import { mediaKeyFromUrl } from "@/lib/media-ref";
import { PLATFORM_LABEL, type ClipAccount, type ClipCampaign, type ClipCreator, type ClipSubmission } from "@/lib/clip-farm/types";
import { VideoThumb } from "@/components/izlenme/link-thumb";
import { inputCls } from "@/components/clip-farm/shared";
import { cn } from "@/lib/utils";

/** Kişinin kanalını açar; seçilen videolar onaylı olarak dahil edilir. */
export function ChannelPicker({
  creator,
  account,
  campaigns,
  submissions,
  busy,
  onAdd,
  onClose,
}: {
  creator: ClipCreator;
  account: ClipAccount | null;
  campaigns: ClipCampaign[];
  submissions: ClipSubmission[];
  busy: boolean;
  onAdd: (campaignId: string, urls: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ProfilePostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState("");
  const usable = campaigns.filter((c) => c.status !== "ended");
  const [campaignId, setCampaignId] = useState(usable[0]?.id ?? "");

  const known = useMemo(() => {
    const m = new Map<string, ClipSubmission>();
    for (const s of submissions) m.set(s.mediaKey, s);
    return m;
  }, [submissions]);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ platform: account.platform, handle: account.handle });
    void fetch(`/api/admin/account-videos?${params}`, { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; items?: ProfilePostItem[]; error?: string };
        if (!res.ok || !json.ok) setError(json.error ?? "Kanal videoları alınamadı");
        else setItems((json.items ?? []).filter((i) => i.url));
      })
      .catch(() => setError("Kanal videoları alınamadı"))
      .finally(() => setLoading(false));
  }, [account]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(url: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  const manualUrls = manual.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const total = picked.size + manualUrls.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="flex h-full w-full max-w-4xl flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{creator.name}</p>
            <h2 className="truncate text-lg font-semibold">
              {account ? `${PLATFORM_LABEL[account.platform]} · @${account.handle}` : "Link ile video ekle"}
            </h2>
            <p className="text-xs text-muted-foreground">Ödemeye dahil etmek istediğin videoları seç. Seçtiklerin direkt onaylanır.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" aria-label="Kapat">
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {account && loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Kanaldaki son videolar getiriliyor…
            </p>
          )}
          {error && <p className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-600">{error}</p>}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((it) => {
                const existing = known.get(mediaKeyFromUrl(it.url));
                const on = picked.has(it.url);
                return (
                  <div key={it.url} className="relative space-y-1">
                    <VideoThumb
                      media={{ url: it.url, views: it.views ?? null, family: account?.platform ?? "diger", title: it.title, thumbnailUrl: it.thumbnailUrl }}
                      compact
                      onPlay={() => !existing && toggle(it.url)}
                      className={cn(on && "ring-2 ring-primary", existing && "opacity-60")}
                    />
                    {existing ? (
                      <span className="absolute left-1 top-1 rounded bg-background/95 px-1 text-[9px] font-semibold">
                        {existing.status === "approved" ? "Dahil" : existing.status === "pending" ? "Gönderdi" : "Reddedildi"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle(it.url)}
                        className={cn(
                          "absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/40 text-transparent"
                        )}
                        aria-label="Seç"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 space-y-1">
            <p className="text-xs font-medium">Listede olmayan video linkleri</p>
            <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={3} placeholder="Her satıra bir link" className={cn(inputCls, "h-auto py-2 font-mono text-xs")} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={cn(inputCls, "w-auto")}>
            {usable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || total === 0 || !campaignId}
            onClick={() => void onAdd(campaignId, [...picked, ...manualUrls]).then(() => {
              setPicked(new Set());
              setManual("");
            })}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {total > 0 ? `${total} videoyu dahil et` : "Video seç"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
