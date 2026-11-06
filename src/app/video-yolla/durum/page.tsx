"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setThumbClipKey } from "@/lib/link-thumb-client";
import { formatClipSubmissionMetrics } from "@/lib/clip-farm/display";
import { fmtClipMoney, type ClipCampaign, type ClipCurrency, type ClipPlatform } from "@/lib/clip-farm/types";
import { CLIP_KEY_STORAGE } from "@/components/clip-farm/shared";
import { VideoYollaStage } from "@/components/clip-farm/video-yolla-stage";
import { VideoPlayerModal, VideoThumb, type PlayableMedia } from "@/components/izlenme/link-thumb";
import { clipPublicPaths, resolveClipHostHint } from "@/lib/clip-host";
import { cn } from "@/lib/utils";

interface MeResponse {
  ok: boolean;
  error?: string;
  creator?: { name: string; status: string };
  campaigns?: ClipCampaign[];
  submissions?: {
    id: string;
    url: string;
    platform: ClipPlatform;
    campaignId: string;
    status: "pending" | "approved" | "rejected";
    rejectReason: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    lastCheckedAt: string | null;
    lastCheckError?: string | null;
    shares?: number | null;
    createdAt: string;
  }[];
  earnings?: { monthYm: string; rows: { campaignId: string; currency: ClipCurrency; due: number; capped: boolean; paid: number | null }[] }[];
}

const STATUS_LABEL = { pending: "İnceleniyor", approved: "Onaylandı", rejected: "Reddedildi" } as const;
const STATUS_CLS = {
  pending: "bg-amber-200 text-amber-800",
  approved: "bg-emerald-200 text-emerald-800",
  rejected: "bg-rose-200 text-rose-800",
} as const;

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function DurumInner() {
  const params = useSearchParams();
  const [data, setData] = useState<MeResponse | null>(null);
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const [homeHref, setHomeHref] = useState("/video-yolla");

  useEffect(() => {
    setHomeHref(clipPublicPaths(resolveClipHostHint()).home);
    const k = params.get("k") || window.localStorage.getItem(CLIP_KEY_STORAGE) || "";
    if (!k) {
      setData({ ok: false, error: "Kişisel link bulunamadı. Video gönderdiğinde sana verilen linki aç." });
      return;
    }
    window.localStorage.setItem(CLIP_KEY_STORAGE, k);
    setThumbClipKey(k);
    void fetch(`/api/clip/me?k=${encodeURIComponent(k)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ ok: false, error: "Yüklenemedi, sayfayı yenile." }));
  }, [params]);

  if (!data) {
    return (
      <p className="flex items-center justify-center gap-2 py-20 text-sm text-[#111]/60">
        <Loader2 size={16} className="animate-spin" /> Yükleniyor…
      </p>
    );
  }
  if (!data.ok) {
    return (
      <div className="py-16 text-center text-sm">
        <p className="text-[#111]/60">{data.error ?? "Bulunamadı."}</p>
        <Link href={homeHref} className="mt-4 inline-block font-bold text-[#c2410c]">
          Video gönder
        </Link>
      </div>
    );
  }

  const subs = data.submissions ?? [];
  const thisMonth = data.earnings?.[0];
  const counts = {
    approved: subs.filter((s) => s.status === "approved").length,
    pending: subs.filter((s) => s.status === "pending").length,
    rejected: subs.filter((s) => s.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[#111]/60">Merhaba</p>
          <h1 className="text-4xl uppercase [font-family:var(--font-vy-display),Impact,sans-serif]">{data.creator?.name}</h1>
        </div>
        <Link href={homeHref} className="rounded-lg border-2 border-[#111] bg-[#ff4d00] px-4 py-2 text-sm font-bold text-[#111] shadow-[3px_3px_0_#111]">
          Yeni video gönder
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-4">
          <p className="text-xs text-[#111]/60">Bu ay ödül</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {thisMonth?.rows.length
              ? thisMonth.rows.map((r) => fmtClipMoney(r.due, r.currency)).join(" + ")
              : fmtClipMoney(0, data.campaigns?.[0]?.currency ?? "TRY")}
          </p>
        </div>
        <div className="rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-4">
          <p className="text-xs text-[#111]/60">Onaylı video</p>
          <p className="mt-1 text-2xl font-bold">{counts.approved}</p>
        </div>
        <div className="rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-4">
          <p className="text-xs text-[#111]/60">İnceleniyor</p>
          <p className="mt-1 text-2xl font-bold">{counts.pending}</p>
        </div>
        <div className="rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-4">
          <p className="text-xs text-[#111]/60">Reddedilen</p>
          <p className="mt-1 text-2xl font-bold">{counts.rejected}</p>
        </div>
      </div>

      {(data.earnings ?? []).some((e) => e.rows.length > 0) && (
        <section className="rounded-lg border-2 border-[#111] bg-[#fbf8f1] p-4">
          <h2 className="mb-2 text-sm font-semibold">Aylık ödül</h2>
          <ul className="divide-y divide-[#111]/15 text-sm">
            {(data.earnings ?? [])
              .filter((e) => e.rows.length > 0)
              .map((e) => (
                <li key={e.monthYm} className="flex items-center justify-between py-2">
                  <span className="capitalize">{monthLabel(e.monthYm)}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {e.rows.map((r) => fmtClipMoney(r.due, r.currency)).join(" + ")}
                    {e.rows.every((r) => r.paid != null) ? (
                      <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] text-emerald-800">Ödendi</span>
                    ) : (
                      <span className="rounded-full bg-[#111]/10 px-2 py-0.5 text-[11px] text-[#111]/70">Bekliyor</span>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Videoların ({subs.length})</h2>
        {subs.length === 0 ? (
          <p className="text-sm text-[#111]/60">Henüz video göndermedin.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {subs.map((s) => (
              <div key={s.id} className="space-y-1.5">
                <VideoThumb media={{ url: s.url, views: s.views, family: s.platform }} onPlay={setPlaying} />
                <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLS[s.status])}>
                  {STATUS_LABEL[s.status]}
                </span>
                {s.status === "rejected" && s.rejectReason && <p className="text-[11px] text-rose-600">{s.rejectReason}</p>}
                {(() => {
                  const m = formatClipSubmissionMetrics(s);
                  return (
                    <p
                      className={cn(
                        "text-[11px]",
                        m.tone === "warn" ? "text-amber-800" : "text-[#111]/60",
                      )}
                      title={m.title}
                    >
                      {m.text}
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </section>
      {playing && <VideoPlayerModal media={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

export default function DurumPage() {
  return (
    <VideoYollaStage>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 text-[#111]">
        <Suspense fallback={null}>
          <DurumInner />
        </Suspense>
      </div>
    </VideoYollaStage>
  );
}
