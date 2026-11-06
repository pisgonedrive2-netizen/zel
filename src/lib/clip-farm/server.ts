import { randomBytes, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { detectPlatform } from "@/lib/social-api/platform-detect";
import { fetchMetricsForLink, fetchRichDetailsForLink } from "@/lib/social-api/clients";
import { mediaKeyFromUrl, parseMediaRef } from "@/lib/media-ref";
import { accountIdentityFromLink } from "@/lib/yeni-hesaplar";
import {
  CLIP_PLATFORMS,
  campaignFromRow,
  campaignToRow,
  creatorFromRow,
  payoutFromRow,
  snapshotFromRow,
  submissionFromRow,
  type ClipAccount,
  type ClipCampaign,
  type ClipCreator,
  type ClipPayout,
  type ClipPlatform,
  type ClipSnapshot,
  type ClipSubmission,
} from "@/lib/clip-farm/types";
import { CLIP_LIMITS, normalizeClipContact } from "@/lib/clip-farm/abuse";

const db = () => getSupabaseAdmin();

export function newClipId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function istanbulDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
}

/** Tablolar oluşturulmadıysa false — admin ekranı kurulum kartı gösterir. */
export async function clipTablesReady(): Promise<boolean> {
  const { error } = await db().from("clip_campaigns").select("id").limit(1);
  return !error;
}

async function selectAll<T>(table: string, map: (r: Record<string, unknown>) => T, order = "created_at"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db().from(table).select("*").range(from, from + 999);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []).map(map));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface ClipFarmData {
  campaigns: ClipCampaign[];
  creators: ClipCreator[];
  submissions: ClipSubmission[];
  snapshots: ClipSnapshot[];
  payouts: ClipPayout[];
}

export async function loadClipFarm(): Promise<ClipFarmData> {
  const [campaigns, creators, submissions, snapshots, payouts] = await Promise.all([
    selectAll("clip_campaigns", campaignFromRow),
    selectAll("clip_creators", creatorFromRow),
    selectAll("clip_submissions", submissionFromRow),
    selectAll("clip_snapshots", snapshotFromRow, "date"),
    selectAll("clip_payouts", payoutFromRow, "paid_at"),
  ]);
  return { campaigns, creators, submissions, snapshots, payouts };
}

export async function activeCampaigns(): Promise<ClipCampaign[]> {
  const { data, error } = await db().from("clip_campaigns").select("*").eq("status", "active").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(campaignFromRow);
}

/** Hiç kampanya yoksa gönderim formunun çalışması için tek bir açık kampanya açar. Oranlar 0 kalır; tutarı panelden yazarsın. */
export async function ensureOpenCampaign(): Promise<ClipCampaign[]> {
  const active = await activeCampaigns();
  if (active.length > 0) return active;
  const { count, error } = await db().from("clip_campaigns").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return [];
  const created = await saveCampaign({
    id: "cc-acik",
    title: "Clip farm",
    description: "Lanetkel YouTube yayın veya reels kesitlerini kendi hesabında paylaş, linkini gönder, ödül kazan.",
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
    createdAt: new Date().toISOString(),
  });
  return [created];
}

export async function saveCampaign(c: ClipCampaign): Promise<ClipCampaign> {
  const row = campaignToRow({ ...c, id: c.id || newClipId("cc") });
  const { data, error } = await db().from("clip_campaigns").upsert(row).select("*").single();
  if (error) throw new Error(error.message);
  return campaignFromRow(data);
}

export function normalizeAccounts(raw: unknown): ClipAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: ClipAccount[] = [];
  for (const a of raw) {
    const platform = String((a as ClipAccount)?.platform ?? "").toLowerCase() as ClipPlatform;
    const handle = String((a as ClipAccount)?.handle ?? "")
      .trim()
      .replace(/^https?:\/\/[^/]+\//, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    if (!CLIP_PLATFORMS.includes(platform) || !/^[\w.-]{2,40}$/.test(handle)) continue;
    if (!out.some((x) => x.platform === platform && x.handle === handle)) out.push({ platform, handle });
  }
  return out.slice(0, 10);
}

export async function creatorByKey(key: string): Promise<(ClipCreator & { accessKey: string }) | null> {
  if (!key || key.length < 16) return null;
  const { data } = await db().from("clip_creators").select("*").eq("access_key", key).maybeSingle();
  return data ? { ...creatorFromRow(data), accessKey: String(data.access_key) } : null;
}

/** Aynı Telegram/telefon ile ikinci profil açılmasını engeller. */
export async function creatorByContact(
  contact: string
): Promise<(ClipCreator & { accessKey: string }) | null> {
  const norm = normalizeClipContact(contact);
  if (norm.length < 3) return null;
  const { data: byNorm } = await db()
    .from("clip_creators")
    .select("*")
    .eq("contact_norm", norm)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byNorm) return { ...creatorFromRow(byNorm), accessKey: String(byNorm.access_key) };

  // Eski satırlar contact_norm boş olabilir
  const { data: list } = await db()
    .from("clip_creators")
    .select("*")
    .ilike("contact", `%${contact.replace(/^@/, "").slice(0, 40)}%`)
    .limit(20);
  const hit = (list ?? []).find(
    (r) => normalizeClipContact(String(r.contact ?? "")) === norm
  );
  return hit ? { ...creatorFromRow(hit), accessKey: String(hit.access_key) } : null;
}

export async function createCreator(
  input: Omit<ClipCreator, "id" | "status" | "notes" | "createdAt"> & { submitIp?: string }
) {
  const accessKey = randomBytes(18).toString("base64url");
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    id: newClipId("ccr"),
    name: input.name,
    contact: input.contact,
    contact_norm: normalizeClipContact(input.contact),
    email: input.email,
    payout_method: input.payoutMethod,
    payout_details: input.payoutDetails,
    accounts: input.accounts,
    status: "pending",
    access_key: accessKey,
    last_submit_ip: input.submitIp ?? null,
    last_submit_at: now,
    submit_count: 0,
  };
  const { data, error } = await db().from("clip_creators").insert(row).select("*").single();
  if (error) {
    // Migration henüz yoksa sade satır dene
    if (/contact_norm|last_submit/i.test(error.message)) {
      const { data: d2, error: e2 } = await db()
        .from("clip_creators")
        .insert({
          id: row.id,
          name: input.name,
          contact: input.contact,
          email: input.email,
          payout_method: input.payoutMethod,
          payout_details: input.payoutDetails,
          accounts: input.accounts,
          status: "pending",
          access_key: accessKey,
        })
        .select("*")
        .single();
      if (e2) throw new Error(e2.message);
      return { ...creatorFromRow(d2), accessKey };
    }
    throw new Error(error.message);
  }
  return { ...creatorFromRow(data), accessKey };
}

export async function touchCreatorSubmit(creatorId: string, ip: string, added: number) {
  if (added <= 0) return;
  const now = new Date().toISOString();
  try {
    const { data } = await db().from("clip_creators").select("submit_count").eq("id", creatorId).maybeSingle();
    const prev = Number(data?.submit_count ?? 0) || 0;
    await db()
      .from("clip_creators")
      .update({
        last_submit_ip: ip,
        last_submit_at: now,
        submit_count: prev + added,
        updated_at: now,
      })
      .eq("id", creatorId);
  } catch {
    /* kolon yoksa sessiz */
  }
}

export async function countCreatorPending(creatorId: string): Promise<number> {
  const { count } = await db()
    .from("clip_submissions")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "pending");
  return count ?? 0;
}

export async function countCreatorSince(creatorId: string, sinceIso: string): Promise<number> {
  const { count } = await db()
    .from("clip_submissions")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .gte("created_at", sinceIso);
  return count ?? 0;
}

export async function countIpSince(ip: string, sinceIso: string): Promise<number> {
  if (!ip || ip === "local") return 0;
  const { count, error } = await db()
    .from("clip_submissions")
    .select("id", { count: "exact", head: true })
    .eq("submit_ip", ip)
    .gte("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

export async function countNewCreatorsByIpSince(ip: string, sinceIso: string): Promise<number> {
  if (!ip || ip === "local") return 0;
  const { count, error } = await db()
    .from("clip_creators")
    .select("id", { count: "exact", head: true })
    .eq("last_submit_ip", ip)
    .gte("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

export { CLIP_LIMITS, normalizeClipContact };

export async function updateCreator(id: string, patch: Partial<ClipCreator>) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if (patch.notes != null) row.notes = patch.notes;
  if (patch.name != null) row.name = patch.name;
  if (patch.contact != null) row.contact = patch.contact;
  if (patch.payoutMethod != null) row.payout_method = patch.payoutMethod;
  if (patch.payoutDetails != null) row.payout_details = patch.payoutDetails;
  if (patch.accounts) row.accounts = normalizeAccounts(patch.accounts);
  const { error } = await db().from("clip_creators").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export type AddResult = { url: string; ok: boolean; error?: string; id?: string };

/** Linkleri doğrular ve ekler. Aynı video daha önce gönderildiyse reddedilir. */
export async function addSubmissions(input: {
  creatorId: string;
  campaign: ClipCampaign;
  urls: string[];
  source: "creator" | "admin";
  approvedBy?: string;
  submitIp?: string;
}): Promise<AddResult[]> {
  const results: AddResult[] = [];
  const seen = new Set<string>();
  for (const raw of input.urls) {
    const url = raw.trim();
    if (!url) continue;
    const ref = parseMediaRef(url);
    if (!ref) {
      results.push({ url, ok: false, error: "Video linki değil (profil veya geçersiz link)" });
      continue;
    }
    if (!input.campaign.platforms.includes(ref.platform)) {
      results.push({ url, ok: false, error: "Bu kampanyada bu platform yok" });
      continue;
    }
    const mediaKey = mediaKeyFromUrl(url);
    if (seen.has(mediaKey)) {
      results.push({ url, ok: false, error: "Aynı videoyu iki kez yazdın" });
      continue;
    }
    seen.add(mediaKey);
    const handle = accountIdentityFromLink({ platform: ref.platform, url, handle: "" })?.handle ?? "";
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      id: newClipId("cs"),
      campaign_id: input.campaign.id,
      creator_id: input.creatorId,
      url,
      media_key: mediaKey,
      platform: ref.platform,
      account_handle: handle,
      status: input.source === "admin" ? "approved" : "pending",
      source: input.source,
      reviewed_at: input.source === "admin" ? now : null,
      reviewed_by: input.approvedBy ?? null,
      submit_ip: input.submitIp ?? null,
    };
    let { error } = await db().from("clip_submissions").insert(row);
    if (error && /submit_ip/i.test(error.message)) {
      delete row.submit_ip;
      ({ error } = await db().from("clip_submissions").insert(row));
    }
    if (error) {
      const dup = error.code === "23505" || /duplicate|unique/i.test(error.message);
      results.push({ url, ok: false, error: dup ? "Bu video daha önce gönderilmiş" : error.message });
    } else results.push({ url, ok: true, id: String(row.id) });
  }
  return results;
}

export async function reviewSubmissions(ids: string[], status: "approved" | "rejected" | "pending", reason: string, by: string) {
  const { error } = await db()
    .from("clip_submissions")
    .update({
      status,
      reject_reason: status === "rejected" ? reason : "",
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      reviewed_by: status === "pending" ? null : by,
    })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

export async function deleteSubmissions(ids: string[]) {
  const { error } = await db().from("clip_submissions").delete().in("id", ids).neq("status", "approved");
  if (error) throw new Error(error.message);
}

function toIso(v: string | undefined): string | null {
  if (!v) return null;
  const n = /^\d+$/.test(v) ? Number(v) : NaN;
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** RapidAPI ile sayıları çeker, videoya ve günlük ölçüme yazar. */
export async function refreshSubmission(s: Pick<ClipSubmission, "id" | "url" | "platform">) {
  const detected = detectPlatform(s.url, s.platform);
  const checkedAt = new Date().toISOString();
  if (!detected || detected.kind !== "video") {
    await db().from("clip_submissions").update({ last_checked_at: checkedAt, last_check_error: "Link tanınmadı" }).eq("id", s.id);
    return { id: s.id, ok: false, error: "Link tanınmadı" };
  }
  try {
    let views: number | null = null;
    let likes: number | null = null;
    let comments: number | null = null;
    let shares: number | null = null;
    let publishedAt: string | undefined;
    let author: string | undefined;
    try {
      const rich = await fetchRichDetailsForLink(detected, { includePremium: false });
      ({ views, likes, comments, shares } = rich.metrics);
      publishedAt = rich.publishedAt ?? rich.metrics.publishedAt;
      author = rich.author?.username;
    } catch {
      const m = await fetchMetricsForLink(detected);
      ({ views, likes, comments, shares } = m);
      publishedAt = m.publishedAt;
    }
    const patch: Record<string, unknown> = {
      views,
      likes,
      comments,
      shares,
      last_checked_at: checkedAt,
      last_check_error: null,
    };
    const published = toIso(publishedAt);
    if (published) patch.published_at = published;
    if (author) patch.account_handle = author.replace(/^@/, "").toLowerCase();
    await db().from("clip_submissions").update(patch).eq("id", s.id);
    await db().from("clip_snapshots").upsert({
      submission_id: s.id,
      date: istanbulDate(),
      views: views ?? 0,
      likes: likes ?? 0,
      comments: comments ?? 0,
      shares: shares ?? 0,
    });
    return { id: s.id, ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "Sayılar alınamadı";
    await db().from("clip_submissions").update({ last_checked_at: checkedAt, last_check_error: msg }).eq("id", s.id);
    return { id: s.id, ok: false, error: msg };
  }
}

export async function refreshSubmissions(filter: { ids?: string[]; statuses?: string[] }, budgetMs = 240_000) {
  let q = db().from("clip_submissions").select("id,url,platform,status");
  if (filter.ids?.length) q = q.in("id", filter.ids);
  else q = q.in("status", filter.statuses ?? ["approved", "pending"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const started = Date.now();
  const results: { id: string; ok: boolean; error?: string }[] = [];
  const queue = [...(data ?? [])] as Pick<ClipSubmission, "id" | "url" | "platform">[];
  async function worker() {
    for (;;) {
      if (Date.now() - started > budgetMs) return;
      const next = queue.shift();
      if (!next) return;
      results.push(await refreshSubmission(next));
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return { total: data?.length ?? 0, done: results.length, failed: results.filter((r) => !r.ok).length };
}

export async function markPayout(p: Omit<ClipPayout, "id" | "paidAt">, by: string) {
  const { error } = await db()
    .from("clip_payouts")
    .upsert(
      {
        id: newClipId("cp"),
        creator_id: p.creatorId,
        month_ym: p.monthYm,
        currency: p.currency,
        amount: p.amount,
        note: p.note,
        paid_by: by,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "creator_id,month_ym,currency" }
    );
  if (error) throw new Error(error.message);
}

export async function undoPayout(creatorId: string, monthYm: string, currency: string) {
  const { error } = await db()
    .from("clip_payouts")
    .delete()
    .eq("creator_id", creatorId)
    .eq("month_ym", monthYm)
    .eq("currency", currency);
  if (error) throw new Error(error.message);
}

export async function creatorView(creatorId: string) {
  const [subs, payouts] = await Promise.all([
    db().from("clip_submissions").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }),
    db().from("clip_payouts").select("*").eq("creator_id", creatorId),
  ]);
  const submissions = (subs.data ?? []).map(submissionFromRow);
  const ids = submissions.map((s) => s.id);
  const snaps = ids.length
    ? (await db().from("clip_snapshots").select("*").in("submission_id", ids)).data ?? []
    : [];
  return {
    submissions,
    snapshots: snaps.map(snapshotFromRow),
    payouts: (payouts.data ?? []).map(payoutFromRow),
  };
}
