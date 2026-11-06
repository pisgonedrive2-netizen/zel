import type {
  ClipCampaign,
  ClipCreator,
  ClipMetrics,
  ClipPayout,
  ClipSnapshot,
  ClipSubmission,
} from "@/lib/clip-farm/types";

export const ZERO_METRICS: ClipMetrics = { views: 0, likes: 0, comments: 0, shares: 0 };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Bir videonun bu sayılarla toplamda kazandığı tutar (kampanya kuralları + video tavanı). */
export function videoEarning(m: ClipMetrics, c: ClipCampaign): number {
  if (m.views < c.minViews) return 0;
  const raw =
    (m.views / 1000) * c.ratePer1kViews +
    m.likes * c.ratePerLike +
    m.comments * c.ratePerComment +
    m.shares * c.ratePerShare;
  const capped = c.maxPerVideo != null && c.maxPerVideo > 0 ? Math.min(raw, c.maxPerVideo) : raw;
  return round2(Math.max(0, capped));
}

export function currentMetrics(s: ClipSubmission): ClipMetrics {
  return {
    views: s.views ?? 0,
    likes: s.likes ?? 0,
    comments: s.comments ?? 0,
    shares: s.shares ?? 0,
  };
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(d).padStart(2, "0")}`;
}

export function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Ay sonundaki sayılar: o tarihe kadarki son ölçüm. Güncel ayda canlı sayı kullanılır. */
export function metricsAtMonthEnd(
  s: ClipSubmission,
  snaps: ClipSnapshot[],
  ym: string,
  todayYm: string
): ClipMetrics {
  if (ym >= todayYm) return currentMetrics(s);
  const end = lastDayOfMonth(ym);
  let best: ClipSnapshot | null = null;
  for (const snap of snaps) {
    if (snap.submissionId !== s.id || snap.date > end) continue;
    if (!best || snap.date > best.date) best = snap;
  }
  return best ?? ZERO_METRICS;
}

export interface VideoMonthLine {
  submission: ClipSubmission;
  metrics: ClipMetrics;
  totalEarning: number;
  /** Bu ayda kazanılan kısım (ay sonu toplam − önceki ay sonu toplam). */
  monthEarning: number;
}

export interface CreatorMonthSummary {
  creator: ClipCreator;
  campaignId: string;
  currency: ClipCampaign["currency"];
  lines: VideoMonthLine[];
  gross: number;
  /** Kişi başı aylık tavan uygulanmış tutar. */
  due: number;
  capped: boolean;
  paid: ClipPayout | null;
}

/**
 * Aylık hakediş: yalnızca onaylı videolar; her video o ay içinde büyüdüğü kadar kazandırır.
 * Kampanya × kişi bazında gruplanır, kişi başı aylık tavan uygulanır.
 */
export function monthlySummaries(input: {
  monthYm: string;
  todayYm: string;
  campaigns: ClipCampaign[];
  creators: ClipCreator[];
  submissions: ClipSubmission[];
  snapshots: ClipSnapshot[];
  payouts: ClipPayout[];
}): CreatorMonthSummary[] {
  const { monthYm, todayYm } = input;
  const campaigns = new Map(input.campaigns.map((c) => [c.id, c]));
  const creators = new Map(input.creators.map((c) => [c.id, c]));
  const snapsBySub = new Map<string, ClipSnapshot[]>();
  for (const s of input.snapshots) {
    const arr = snapsBySub.get(s.submissionId);
    if (arr) arr.push(s);
    else snapsBySub.set(s.submissionId, [s]);
  }
  const groups = new Map<string, CreatorMonthSummary>();
  for (const sub of input.submissions) {
    if (sub.status !== "approved") continue;
    if (sub.createdAt.slice(0, 7) > monthYm) continue;
    const campaign = campaigns.get(sub.campaignId);
    const creator = creators.get(sub.creatorId);
    if (!campaign || !creator) continue;
    const snaps = snapsBySub.get(sub.id) ?? [];
    const now = metricsAtMonthEnd(sub, snaps, monthYm, todayYm);
    const before = sub.createdAt.slice(0, 7) >= monthYm ? ZERO_METRICS : metricsAtMonthEnd(sub, snaps, prevMonth(monthYm), todayYm);
    const totalEarning = videoEarning(now, campaign);
    const monthEarning = round2(Math.max(0, totalEarning - videoEarning(before, campaign)));
    const key = `${creator.id}|${campaign.id}`;
    const g =
      groups.get(key) ??
      ({
        creator,
        campaignId: campaign.id,
        currency: campaign.currency,
        lines: [],
        gross: 0,
        due: 0,
        capped: false,
        paid: null,
      } satisfies CreatorMonthSummary);
    g.lines.push({ submission: sub, metrics: now, totalEarning, monthEarning });
    g.gross = round2(g.gross + monthEarning);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    const cap = campaigns.get(g.campaignId)?.maxPerCreatorMonth;
    g.due = cap != null && cap > 0 ? Math.min(g.gross, cap) : g.gross;
    g.capped = g.due < g.gross;
    g.paid =
      input.payouts.find(
        (p) => p.creatorId === g.creator.id && p.monthYm === monthYm && p.currency === g.currency
      ) ?? null;
    g.lines.sort((a, b) => b.monthEarning - a.monthEarning);
  }
  return [...groups.values()].sort((a, b) => b.due - a.due);
}

export type ClipFlag = "account" | "early" | "engagement" | "error" | "unmeasured";

export const FLAG_LABEL: Record<ClipFlag, string> = {
  account: "Kişinin bildirdiği hesaplardan değil",
  early: "Kampanya başlamadan yayınlanmış",
  engagement: "Etkileşim çok düşük (bot olabilir)",
  error: "Sayılar çekilemedi",
  unmeasured: "Henüz ölçülmedi",
};

/** Onay öncesi göz atılacak uyarılar. */
export function submissionFlags(
  s: ClipSubmission,
  creator: ClipCreator | undefined,
  campaign: ClipCampaign | undefined
): ClipFlag[] {
  const flags: ClipFlag[] = [];
  if (s.lastCheckError) flags.push("error");
  else if (!s.lastCheckedAt) flags.push("unmeasured");
  const declared = (creator?.accounts ?? [])
    .filter((a) => a.platform === s.platform)
    .map((a) => a.handle.toLowerCase().replace(/^@/, ""));
  if (s.accountHandle && declared.length > 0 && !declared.includes(s.accountHandle.toLowerCase())) {
    flags.push("account");
  }
  if (campaign?.startsOn && s.publishedAt && s.publishedAt.slice(0, 10) < campaign.startsOn) {
    flags.push("early");
  }
  const views = s.views ?? 0;
  if (views >= 10_000 && ((s.likes ?? 0) + (s.comments ?? 0)) / views < 0.002) flags.push("engagement");
  return flags;
}
