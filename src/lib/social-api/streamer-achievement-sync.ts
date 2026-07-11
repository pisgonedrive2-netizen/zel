import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isoToLocalDateOnly, weekStartFromDateIso } from "@/lib/data";
import { incrementUsage, getMonthlyUsage } from "./quota";
import { SOCIAL_PLANS, type SocialPlatform } from "./config";
import {
  fetchProfilePostsForAccount,
  type ProfilePostItem,
} from "./streamer-profile-posts";

export type StreamerAccountRow = {
  id: string;
  employee_id: string;
  platform: string;
  handle: string;
  url: string;
  status: string;
};

const ACHIEVEMENT_PLATFORMS = new Set(["youtube", "instagram", "tiktok"]);

function slugPlatform(platform: string): SocialPlatform | null {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return "youtube";
  if (p.includes("instagram")) return "instagram";
  if (p.includes("tiktok")) return "tiktok";
  return null;
}

export async function countActivePersonalAccounts(employeeId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const { data: accounts, error } = await db
    .from("streamer_accounts")
    .select("platform")
    .eq("employee_id", employeeId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return ((accounts ?? []) as { platform: string }[]).filter((a) =>
    ACHIEVEMENT_PLATFORMS.has(slugPlatform(a.platform) ?? "")
  ).length;
}

function stablePersonalReelId(accountId: string, externalRef: string): string {
  const ref = externalRef.replace(/[^a-zA-Z0-9]/g, "").slice(0, 28);
  return `wr-sa-${accountId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}-${ref}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function upsertPersonalAchievementPost(opts: {
  account: StreamerAccountRow;
  post: ProfilePostItem;
  metrics?: { views?: number | null };
}): Promise<{ created: boolean } | null> {
  const { account, post } = opts;
  const localDate = isoToLocalDateOnly(post.publishedAt);
  if (!localDate || localDate < daysAgoIso(120)) return null;

  const weekStart = weekStartFromDateIso(localDate);
  if (!weekStart) return null;

  const db = getSupabaseAdmin();
  const reelId = stablePersonalReelId(account.id, post.externalRef);
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("week_brand_reels")
    .select("id")
    .eq("streamer_account_id", account.id)
    .eq("external_ref", post.externalRef)
    .maybeSingle();

  const finalId = existing?.id ? String(existing.id) : reelId;
  const row: Record<string, unknown> = {
    id: finalId,
    employee_id: account.employee_id,
    week_start: weekStart,
    brand_id: null,
    content_url: post.url.trim(),
    platform: post.platform,
    content_type: post.contentType,
    brand_link_id: null,
    streamer_account_id: account.id,
    published_at: post.publishedAt ?? `${localDate}T12:00:00.000Z`,
    external_ref: post.externalRef,
    notes: "Kişisel hesap · API",
    last_views: opts.metrics?.views ?? null,
    last_checked_at: now,
    last_check_error: null,
    updated_at: now,
  };

  const { error } = await db.from("week_brand_reels").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`week_brand_reels: ${error.message}`);
  return { created: !existing?.id };
}

export async function syncEmployeePersonalAccounts(
  employeeId: string,
  opts?: { maxAccounts?: number; maxPostsPerAccount?: number }
): Promise<{
  attempted: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const summary = {
    attempted: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  const db = getSupabaseAdmin();
  const { data: accounts, error } = await db
    .from("streamer_accounts")
    .select("id, employee_id, platform, handle, url, status")
    .eq("employee_id", employeeId)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const active = ((accounts ?? []) as StreamerAccountRow[]).filter((a) =>
    ACHIEVEMENT_PLATFORMS.has(slugPlatform(a.platform) ?? "")
  );

  const maxAccounts = opts?.maxAccounts ?? 12;
  const maxPosts = opts?.maxPostsPerAccount ?? 30;

  for (const account of active.slice(0, maxAccounts)) {
    const platform = slugPlatform(account.platform);
    if (!platform) continue;

    summary.attempted += 1;

    const usage = await getMonthlyUsage(platform);
    const safeLimit = Math.floor(
      SOCIAL_PLANS[platform].monthlyLimit * SOCIAL_PLANS[platform].safeFraction
    );
    if (usage.requestsUsed >= safeLimit) {
      summary.skipped += 1;
      summary.errors.push(`${account.handle}: kota dolu`);
      continue;
    }

    try {
      const posts = await fetchProfilePostsForAccount({
        platform: account.platform,
        handle: account.handle,
        url: account.url,
        maxItems: maxPosts,
      });
      await incrementUsage(platform, platform === "instagram" ? 3 : 1);

      for (const post of posts) {
        const ensured = await upsertPersonalAchievementPost({ account, post });
        if (ensured) summary.synced += 1;
      }
    } catch (err) {
      summary.failed += 1;
      const msg = err instanceof Error ? err.message : "Hata";
      summary.errors.push(`${account.platform}/${account.handle}: ${msg.slice(0, 100)}`);
    }
  }

  return summary;
}
