"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  Undo2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useClipAdmin } from "@/components/clip-farm/use-clip-admin";
import { ChannelPicker } from "@/components/clip-farm/channel-picker";
import { CampaignCard, inputCls } from "@/components/clip-farm/shared";
import { creatorRisk } from "@/lib/clip-farm/abuse";
import { formatClipSubmissionMetrics } from "@/lib/clip-farm/display";
import { VideoPlayerModal, VideoThumb, fmtCompact, type PlayableMedia } from "@/components/izlenme/link-thumb";
import {
  CLIP_PLATFORMS,
  PLATFORM_LABEL,
  fmtClipMoney,
  type ClipAccount,
  type ClipCampaign,
  type ClipCreator,
  type ClipCurrency,
  type ClipSubmission,
} from "@/lib/clip-farm/types";
import type { ClipFarmData } from "@/lib/clip-farm/server";
import {
  FLAG_LABEL,
  currentMetrics,
  monthlySummaries,
  submissionFlags,
  videoEarning,
} from "@/lib/clip-farm/rewards";
import { cn } from "@/lib/utils";

type Tab = "pending" | "approved" | "creators" | "payouts" | "campaigns";
type Act = ReturnType<typeof useClipAdmin>["act"];

const REJECT_REASONS = ["Bizim içerik değil", "Kurallara uymuyor", "Aynı video tekrar", "Hesap kişiye ait değil"];

function thisMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()).slice(0, 7);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function relTime(iso: string | null) {
  if (!iso) return "hiç";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "az önce";
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export default function KlipTakipPage() {
  const { state, reload, act, busy, toast } = useClipAdmin();
  const [tab, setTab] = useState<Tab>("pending");
  const [copied, setCopied] = useState(false);

  async function copyPublic() {
    await navigator.clipboard.writeText("https://www.videoyolla.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Video yolla</h1>
          <p className="text-sm text-muted-foreground">
            İnsanlar video linki gönderir, sen onaylarsın. Onaylı videoların sayıları her gün çekilir, ay sonu ödeme hesaplanır.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="https://www.videoyolla.com" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
            Gönderim sayfası <ExternalLink size={13} />
          </Link>
          <button type="button" onClick={() => void copyPublic()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
            <Copy size={13} /> {copied ? "Kopyalandı" : "Linki kopyala"}
          </button>
          {state.status === "ready" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act<{ done: number; failed: number }>({ action: "refresh" }, "Sayılar güncellendi")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw size={13} className={cn(busy && "animate-spin")} /> Sayıları güncelle
            </button>
          )}
        </div>
      </header>

      {state.status === "loading" && (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Yükleniyor…
        </p>
      )}
      {state.status === "error" && <p className="text-sm text-rose-600">{state.error}</p>}
      {state.status === "setup" && <SetupCard sql={state.sql} onCheck={() => void reload()} />}
      {state.status === "ready" && (
        <Ready data={state.data} tab={tab} setTab={setTab} act={act} busy={busy} />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function SetupCard({ sql, onCheck }: { sql: string; onCheck: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <AlertTriangle size={16} className="text-amber-500" /> Tek seferlik kurulum gerekli
      </h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Aşağıdaki SQL’i kopyala.</li>
        <li>
          <a
            href={
              typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
                ? (() => {
                    try {
                      const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
                      return project
                        ? `https://supabase.com/dashboard/project/${project}/sql/new`
                        : "https://supabase.com/dashboard";
                    } catch {
                      return "https://supabase.com/dashboard";
                    }
                  })()
                : "https://supabase.com/dashboard"
            }
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline"
          >
            Supabase SQL Editor
          </a>
          ’ı aç, yapıştır ve <strong>Run</strong>’a bas.
        </li>
        <li>Buraya dönüp “Kontrol et”e bas.</li>
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(sql);
            setCopied(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Copy size={13} /> {copied ? "Kopyalandı" : "SQL’i kopyala"}
        </button>
        <button type="button" onClick={onCheck} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
          <RefreshCw size={13} /> Kontrol et
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">{sql}</pre>
    </div>
  );
}

function Ready({
  data,
  tab,
  setTab,
  act,
  busy,
}: {
  data: ClipFarmData;
  tab: Tab;
  setTab: (t: Tab) => void;
  act: Act;
  busy: boolean;
}) {
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const todayYm = thisMonth();
  const creators = useMemo(() => new Map(data.creators.map((c) => [c.id, c])), [data.creators]);
  const campaigns = useMemo(() => new Map(data.campaigns.map((c) => [c.id, c])), [data.campaigns]);
  const pending = data.submissions.filter((s) => s.status === "pending");
  const approved = data.submissions.filter((s) => s.status === "approved");
  const monthSummaries = useMemo(
    () => monthlySummaries({ monthYm: todayYm, todayYm, ...data }),
    [data, todayYm]
  );
  const dueByCurrency = sumByCurrency(monthSummaries.map((s) => ({ currency: s.currency, amount: s.due })));

  const tabs: { key: Tab; label: string; count?: number; Icon: typeof Check }[] = [
    { key: "pending", label: "Onay bekleyen", count: pending.length, Icon: AlertTriangle },
    { key: "approved", label: "Onaylı videolar", count: approved.length, Icon: Check },
    { key: "creators", label: "Kişiler", count: data.creators.length, Icon: Users },
    { key: "payouts", label: "Ödemeler", Icon: Wallet },
    { key: "campaigns", label: "Kampanyalar", count: data.campaigns.length, Icon: Megaphone },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Onay bekleyen video" value={String(pending.length)} tone={pending.length > 0 ? "warn" : undefined} />
        <Kpi label="Onaylı video" value={String(approved.length)} />
        <Kpi label="Onaylı videoların izlenmesi" value={fmtCompact(approved.reduce((s, v) => s + (v.views ?? 0), 0))} />
        <Kpi label="Bu ay ödenecek" value={dueByCurrency || "0"} />
      </div>

      {data.campaigns.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          <span>Gönderim sayfası boş görünür: önce bir kampanya açıp ödül kurallarını belirle.</span>
          <button type="button" onClick={() => setTab("campaigns")} className="font-medium text-primary">
            Kampanya aç
          </button>
        </div>
      )}

      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map(({ key, label, count, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm",
              tab === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} />
            {label}
            {count != null && (
              <span className={cn("rounded-full px-1.5 text-[11px]", tab === key ? "bg-background/20" : "bg-muted")}>{count}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "pending" && (
        <PendingTab items={pending} creators={creators} campaigns={campaigns} act={act} busy={busy} onPlay={setPlaying} />
      )}
      {tab === "approved" && (
        <ApprovedTab items={approved} data={data} creators={creators} campaigns={campaigns} act={act} busy={busy} onPlay={setPlaying} />
      )}
      {tab === "creators" && <CreatorsTab data={data} act={act} busy={busy} summaries={monthSummaries} />}
      {tab === "payouts" && <PayoutsTab data={data} creators={creators} campaigns={campaigns} act={act} busy={busy} />}
      {tab === "campaigns" && <CampaignsTab campaigns={data.campaigns} act={act} busy={busy} />}

      {playing && <VideoPlayerModal media={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}

function sumByCurrency(rows: { currency: ClipCurrency; amount: number }[]): string {
  const m = new Map<ClipCurrency, number>();
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount);
  return [...m.entries()].filter(([, v]) => v > 0).map(([c, v]) => fmtClipMoney(v, c)).join(" + ");
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={cn("rounded-xl border bg-card px-3 py-2.5", tone === "warn" ? "border-amber-500/50" : "border-border")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

function MetricLine({ s }: { s: ClipSubmission }) {
  const m = formatClipSubmissionMetrics(s);
  return (
    <p
      className={cn(
        "text-[11px] tabular-nums",
        m.tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
      )}
      title={m.title}
    >
      {m.text}
    </p>
  );
}

function PendingTab({
  items,
  creators,
  campaigns,
  act,
  busy,
  onPlay,
}: {
  items: ClipSubmission[];
  creators: Map<string, ClipCreator>;
  campaigns: Map<string, ClipCampaign>;
  act: Act;
  busy: boolean;
  onPlay: (m: PlayableMedia) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = [...selected].filter((id) => items.some((i) => i.id === id));

  async function review(targetIds: string[], status: "approved" | "rejected", why = "") {
    const res = await act({ action: "review", ids: targetIds, status, reason: why }, status === "approved" ? "Onaylandı" : "Reddedildi");
    if (res) setSelected(new Set());
    setRejecting(null);
  }

  if (items.length === 0) return <Empty>Onay bekleyen video yok.</Empty>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={ids.length === items.length}
            onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
          />
          Hepsini seç
        </label>
        <span className="text-muted-foreground">{ids.length} seçili</span>
        <div className="ml-auto flex gap-2">
          <button type="button" disabled={busy || ids.length === 0} onClick={() => void review(ids, "approved")} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white disabled:opacity-40">
            Seçilenleri onayla
          </button>
          <button type="button" disabled={busy || ids.length === 0} onClick={() => setRejecting(ids)} className="h-8 rounded-lg border border-rose-500/50 px-3 text-xs font-medium text-rose-600 disabled:opacity-40">
            Seçilenleri reddet
          </button>
        </div>
      </div>

      {rejecting && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm">
          <span>{rejecting.length} video için ret sebebi:</span>
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-2.5 py-1 text-xs", reason === r ? "border-rose-500 bg-rose-500 text-white" : "border-border")}>
              {r}
            </button>
          ))}
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={cn(inputCls, "h-8 w-56")} />
          <button type="button" disabled={busy} onClick={() => void review(rejecting, "rejected", reason)} className="h-8 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white">
            Reddet
          </button>
          <button type="button" onClick={() => setRejecting(null)} className="text-xs text-muted-foreground">
            Vazgeç
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((s) => {
          const creator = creators.get(s.creatorId);
          const campaign = campaigns.get(s.campaignId);
          const flags = submissionFlags(s, creator, campaign);
          const on = selected.has(s.id);
          return (
            <div key={s.id} className={cn("flex flex-col gap-1.5 rounded-xl border bg-card p-2", on ? "border-primary ring-1 ring-primary/40" : "border-border")}>
              <div className="relative">
                <VideoThumb media={{ url: s.url, views: s.views, family: s.platform }} onPlay={onPlay} />
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                  className="absolute right-1.5 top-1.5 h-4 w-4"
                  aria-label="Seç"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{creator?.name ?? "—"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {PLATFORM_LABEL[s.platform]}
                  {s.accountHandle && ` · @${s.accountHandle}`}
                </p>
                <MetricLine s={s} />
              </div>
              {flags.length > 0 && (
                <ul className="space-y-0.5">
                  {flags.map((f) => (
                    <li key={f} className="flex items-start gap-1 text-[10px] leading-tight text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={10} className="mt-px shrink-0" /> {FLAG_LABEL[f]}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto grid grid-cols-2 gap-1">
                <button type="button" disabled={busy} onClick={() => void review([s.id], "approved")} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-xs font-medium text-white disabled:opacity-50">
                  <Check size={13} /> Onayla
                </button>
                <button type="button" disabled={busy} onClick={() => setRejecting([s.id])} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border text-xs disabled:opacity-50">
                  <X size={13} /> Reddet
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApprovedTab({
  items,
  data,
  creators,
  campaigns,
  act,
  busy,
  onPlay,
}: {
  items: ClipSubmission[];
  data: ClipFarmData;
  creators: Map<string, ClipCreator>;
  campaigns: Map<string, ClipCampaign>;
  act: Act;
  busy: boolean;
  onPlay: (m: PlayableMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const todayYm = thisMonth();
  const monthEarning = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of monthlySummaries({ monthYm: todayYm, todayYm, ...data })) {
      for (const l of s.lines) m.set(l.submission.id, l.monthEarning);
    }
    return m;
  }, [data, todayYm]);
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const shown = items
    .filter((s) => !q || s.accountHandle.includes(q) || (creators.get(s.creatorId)?.name ?? "").toLowerCase().includes(q) || s.url.toLowerCase().includes(q))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

  if (items.length === 0) return <Empty>Henüz onaylı video yok. “Onay bekleyen” sekmesinden veya kişinin kanalından video ekle.</Empty>;
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kişi, hesap veya link ara" className={cn(inputCls, "h-9 pl-8")} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {shown.map((s) => {
          const campaign = campaigns.get(s.campaignId);
          const total = campaign ? videoEarning(currentMetrics(s), campaign) : 0;
          return (
            <div key={s.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2">
              <VideoThumb media={{ url: s.url, views: s.views, family: s.platform }} onPlay={onPlay} badge={s.source === "admin" ? "Kanaldan" : undefined} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{creators.get(s.creatorId)?.name ?? "—"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{s.accountHandle ? `@${s.accountHandle}` : PLATFORM_LABEL[s.platform]}</p>
                <MetricLine s={s} />
              </div>
              {campaign && (
                <p className="text-[11px]">
                  Bu ay <strong>{fmtClipMoney(monthEarning.get(s.id) ?? 0, campaign.currency)}</strong>
                  <span className="text-muted-foreground"> · toplam {fmtClipMoney(total, campaign.currency)}</span>
                </p>
              )}
              {s.lastCheckError && <p className="text-[10px] text-amber-600">Son ölçüm hatalı</p>}
              <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{relTime(s.lastCheckedAt)}</span>
                <span className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void act({ action: "refresh", ids: [s.id] }, "Güncellendi")} title="Sayıları güncelle">
                    <RefreshCw size={12} />
                  </button>
                  <button type="button" disabled={busy} onClick={() => void act({ action: "review", ids: [s.id], status: "pending" }, "Onay geri alındı")} title="Onayı geri al">
                    <Undo2 size={12} />
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreatorsTab({
  data,
  act,
  busy,
  summaries,
}: {
  data: ClipFarmData;
  act: Act;
  busy: boolean;
  summaries: ReturnType<typeof monthlySummaries>;
}) {
  const [picker, setPicker] = useState<{ creator: ClipCreator; account: ClipAccount | null } | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const shown = data.creators.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.accounts.some((a) => a.handle.includes(q))
  );

  if (data.creators.length === 0) return <Empty>Henüz kimse video göndermedi. Gönderim sayfasının linkini paylaş.</Empty>;
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İsim, iletişim veya hesap ara" className={cn(inputCls, "h-9 pl-8")} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const subs = data.submissions.filter((s) => s.creatorId === c.id);
          const due = sumByCurrency(summaries.filter((s) => s.creator.id === c.id).map((s) => ({ currency: s.currency, amount: s.due })));
          const risk = creatorRisk(c, data.submissions, data.creators);
          return (
            <div
              key={c.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card p-3",
                risk.level === "high"
                  ? "border-rose-500/50 ring-1 ring-rose-500/20"
                  : risk.level === "warn"
                    ? "border-amber-500/40"
                    : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.contact}
                    {c.email && ` · ${c.email}`}
                  </p>
                  {c.lastSubmitIp && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">IP · {c.lastSubmitIp}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    c.status === "approved" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    c.status === "pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                    c.status === "blocked" && "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {c.status === "approved" ? "Güvenilir" : c.status === "pending" ? "Yeni" : "Engelli"}
                </span>
              </div>
              {risk.labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {risk.labels.map((l) => (
                    <span
                      key={l}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        risk.level === "high"
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      )}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1 text-center">
                <Mini label="Onaylı" value={String(subs.filter((s) => s.status === "approved").length)} />
                <Mini label="Bekleyen" value={String(subs.filter((s) => s.status === "pending").length)} />
                <Mini label="Bu ay" value={due || "0"} />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Hesapları — videoları seçmek için kanalı aç</p>
                <div className="flex flex-wrap gap-1">
                  {c.accounts.map((a) => (
                    <button
                      key={`${a.platform}-${a.handle}`}
                      type="button"
                      onClick={() => setPicker({ creator: c, account: a })}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:border-primary hover:text-primary"
                    >
                      {PLATFORM_LABEL[a.platform]} · @{a.handle}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPicker({ creator: c, account: null })} className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                    + Link ile ekle
                  </button>
                </div>
              </div>
              {(c.payoutMethod || c.payoutDetails) && (
                <p className="truncate rounded-md bg-muted/60 px-2 py-1 text-[11px]">
                  <span className="text-muted-foreground">{c.payoutMethod}: </span>
                  {c.payoutDetails || "—"}
                </p>
              )}
              <div className="mt-auto flex gap-2 text-xs">
                {c.status !== "approved" && (
                  <button type="button" disabled={busy} onClick={() => void act({ action: "creator.update", id: c.id, patch: { status: "approved" } }, "Güvenilir olarak işaretlendi")} className="text-emerald-600">
                    Güvenilir yap
                  </button>
                )}
                {c.status !== "blocked" ? (
                  <button type="button" disabled={busy} onClick={() => void act({ action: "creator.update", id: c.id, patch: { status: "blocked" } }, "Engellendi")} className="text-rose-600">
                    Engelle
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => void act({ action: "creator.update", id: c.id, patch: { status: "pending" } }, "Engel kaldırıldı")}>
                    Engeli kaldır
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {picker && (
        <ChannelPicker
          creator={picker.creator}
          account={picker.account}
          campaigns={data.campaigns}
          submissions={data.submissions}
          busy={busy}
          onClose={() => setPicker(null)}
          onAdd={async (campaignId, urls) => {
            const res = await act<{ results: { ok: boolean; error?: string }[] }>(
              { action: "add-videos", creatorId: picker.creator.id, campaignId, urls },
            );
            if (res) {
              const ok = res.results.filter((r) => r.ok).length;
              const fail = res.results.length - ok;
              alert(`${ok} video dahil edildi${fail ? `, ${fail} video eklenemedi (${res.results.find((r) => !r.ok)?.error ?? ""})` : ""}.`);
            }
          }}
        />
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-1 py-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PayoutsTab({
  data,
  creators,
  campaigns,
  act,
  busy,
}: {
  data: ClipFarmData;
  creators: Map<string, ClipCreator>;
  campaigns: Map<string, ClipCampaign>;
  act: Act;
  busy: boolean;
}) {
  const todayYm = thisMonth();
  const [month, setMonth] = useState(todayYm);
  const [open, setOpen] = useState<string | null>(null);
  const summaries = useMemo(() => monthlySummaries({ monthYm: month, todayYm, ...data }), [data, month, todayYm]);
  const rows = summaries.filter((s) => s.due > 0 || s.paid);
  const unpaid = sumByCurrency(rows.filter((r) => !r.paid).map((r) => ({ currency: r.currency, amount: r.due })));
  const paid = sumByCurrency(rows.filter((r) => r.paid).map((r) => ({ currency: r.currency, amount: r.paid!.amount })));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="h-8 w-8 rounded-md border border-border">‹</button>
          <span className="w-36 text-center text-sm font-medium capitalize">{monthLabel(month)}</span>
          <button type="button" disabled={month >= todayYm} onClick={() => setMonth(shiftMonth(month, 1))} className="h-8 w-8 rounded-md border border-border disabled:opacity-30">›</button>
        </div>
        <span className="text-sm">Ödenecek: <strong>{unpaid || "0"}</strong></span>
        <span className="text-sm text-muted-foreground">Ödenen: {paid || "0"}</span>
        {month === todayYm && <span className="text-xs text-muted-foreground">Ay bitmedi; tutarlar ay sonuna kadar artabilir.</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Her video, o ay içinde kazandığı kadar öder: ay sonundaki toplam kazancından önceki ay sonundaki toplam düşülür.
      </p>
      {rows.length === 0 ? (
        <Empty>Bu ay ödenecek tutar yok.</Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {rows.map((r) => {
            const key = `${r.creator.id}|${r.campaignId}`;
            const creator = creators.get(r.creator.id) ?? r.creator;
            return (
              <div key={key} className="border-b border-border last:border-b-0">
                <div className="flex flex-wrap items-center gap-3 bg-card px-3 py-2.5">
                  <button type="button" onClick={() => setOpen(open === key ? null : key)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{creator.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {campaigns.get(r.campaignId)?.title} · {r.lines.length} video · {creator.payoutMethod || "ödeme yöntemi yok"}: {creator.payoutDetails || "—"}
                    </p>
                  </button>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{fmtClipMoney(r.due, r.currency)}</p>
                    {r.capped && <p className="text-[10px] text-amber-600">aylık tavan uygulandı ({fmtClipMoney(r.gross, r.currency)})</p>}
                  </div>
                  {r.paid ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                        Ödendi {fmtClipMoney(r.paid.amount, r.currency)}
                      </span>
                      <button type="button" disabled={busy} onClick={() => void act({ action: "payout.undo", creatorId: r.creator.id, monthYm: month, currency: r.currency }, "Ödeme geri alındı")} className="text-muted-foreground hover:text-foreground">
                        Geri al
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || month >= todayYm}
                      title={month >= todayYm ? "Ay bitince ödenir" : undefined}
                      onClick={() => {
                        if (confirm(`${creator.name} için ${fmtClipMoney(r.due, r.currency)} ödendi olarak işaretlensin mi?`)) {
                          void act({ action: "payout.mark", creatorId: r.creator.id, monthYm: month, currency: r.currency, amount: r.due }, "Ödendi olarak işaretlendi");
                        }
                      }}
                      className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Ödendi işaretle
                    </button>
                  )}
                </div>
                {open === key && (
                  <ul className="divide-y divide-border bg-muted/30 text-xs">
                    {r.lines.map((l) => (
                      <li key={l.submission.id} className="flex items-center gap-3 px-3 py-1.5">
                        <a href={l.submission.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary">
                          {l.submission.url}
                        </a>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtCompact(l.metrics.views)} izl · {fmtCompact(l.metrics.likes)} beğ · {fmtCompact(l.metrics.comments)} yor
                        </span>
                        <span className="w-24 text-right font-medium tabular-nums">{fmtClipMoney(l.monthEarning, r.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const EMPTY_CAMPAIGN: ClipCampaign = {
  id: "",
  title: "",
  description: "",
  status: "active",
  currency: "TRY",
  ratePer1kViews: 0,
  ratePerLike: 0,
  ratePerComment: 0,
  ratePerShare: 0,
  minViews: 0,
  maxPerVideo: null,
  maxPerCreatorMonth: null,
  platforms: [...CLIP_PLATFORMS],
  rules: "",
  startsOn: null,
  endsOn: null,
  createdAt: "",
};

function CampaignsTab({ campaigns, act, busy }: { campaigns: ClipCampaign[]; act: Act; busy: boolean }) {
  const [draft, setDraft] = useState<ClipCampaign | null>(campaigns.length === 0 ? { ...EMPTY_CAMPAIGN } : null);
  const set = <K extends keyof ClipCampaign>(k: K, v: ClipCampaign[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const numField = (k: "ratePer1kViews" | "ratePerLike" | "ratePerComment" | "ratePerShare" | "minViews", label: string, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <input type="number" min={0} step="any" value={draft?.[k] ?? 0} onChange={(e) => set(k, Number(e.target.value) || 0)} className={inputCls} />
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
  const optField = (k: "maxPerVideo" | "maxPerCreatorMonth", label: string) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="number"
        min={0}
        step="any"
        placeholder="Sınırsız"
        value={draft?.[k] ?? ""}
        onChange={(e) => set(k, e.target.value === "" ? null : Number(e.target.value))}
        className={inputCls}
      />
    </label>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-2">
        <button type="button" onClick={() => setDraft({ ...EMPTY_CAMPAIGN })} className="h-9 w-full rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground">
          + Yeni kampanya
        </button>
        {campaigns.map((c) => (
          <div key={c.id} className="space-y-1">
            <CampaignCard c={c} active={draft?.id === c.id} onClick={() => setDraft({ ...c })} />
            <p className="px-1 text-[11px] text-muted-foreground">
              {c.status === "active" ? "Açık — gönderim sayfasında görünüyor" : c.status === "paused" ? "Durduruldu — yeni gönderim alınmıyor" : "Bitti"}
            </p>
          </div>
        ))}
      </div>
      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "campaign.save", campaign: draft }, "Kampanya kaydedildi").then((r) => r && setDraft(null));
          }}
          className="space-y-4 rounded-2xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">{draft.id ? "Kampanyayı düzenle" : "Yeni kampanya"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">Kampanya adı</span>
              <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="Örn. Lanetkel klipleri — Ekim" required />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">Kısa açıklama</span>
              <input value={draft.description} onChange={(e) => set("description", e.target.value)} className={inputCls} placeholder="Ne tür videolar istiyoruz?" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Durum</span>
              <select value={draft.status} onChange={(e) => set("status", e.target.value as ClipCampaign["status"])} className={inputCls}>
                <option value="active">Açık</option>
                <option value="paused">Durduruldu</option>
                <option value="ended">Bitti</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Para birimi</span>
              <select value={draft.currency} onChange={(e) => set("currency", e.target.value as ClipCurrency)} className={inputCls}>
                <option value="TRY">TL</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">Ödül</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {numField("ratePer1kViews", "Her 1.000 izlenme için")}
              {numField("ratePerLike", "Her beğeni için")}
              {numField("ratePerComment", "Her yorum için")}
              {numField("ratePerShare", "Her paylaşım için")}
              {numField("minViews", "Sayılması için en az izlenme", "Bu izlenmenin altındaki videolar hiç ödeme almaz")}
              {optField("maxPerVideo", "Bir videodan en fazla")}
              {optField("maxPerCreatorMonth", "Kişi başı ayda en fazla")}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">Platformlar ve tarih</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {CLIP_PLATFORMS.map((p) => (
                <label key={p} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.platforms.includes(p)}
                    onChange={(e) => set("platforms", e.target.checked ? [...draft.platforms, p] : draft.platforms.filter((x) => x !== p))}
                  />
                  {PLATFORM_LABEL[p]}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium">Başlangıç</span>
                <input type="date" value={draft.startsOn ?? ""} onChange={(e) => set("startsOn", e.target.value || null)} className={inputCls} />
                <span className="block text-[11px] text-muted-foreground">Bu tarihten önce yayınlanan videolar uyarı alır</span>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">Bitiş</span>
                <input type="date" value={draft.endsOn ?? ""} onChange={(e) => set("endsOn", e.target.value || null)} className={inputCls} />
              </label>
            </div>
          </fieldset>

          <label className="block space-y-1">
            <span className="text-xs font-medium">Kurallar</span>
            <textarea value={draft.rules} onChange={(e) => set("rules", e.target.value)} rows={4} className={cn(inputCls, "h-auto py-2")} placeholder={"Örn.\n- Video en az 15 saniye olmalı\n- Açıklamada @lanetkelben etiketlenmeli"} />
          </label>

          <div>
            <p className="mb-1 text-xs font-semibold">Gönderim sayfasında böyle görünecek</p>
            <CampaignCard c={draft} />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={busy || draft.platforms.length === 0} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Kaydet
            </button>
            <button type="button" onClick={() => setDraft(null)} className="h-10 rounded-lg border border-border px-4 text-sm">
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
