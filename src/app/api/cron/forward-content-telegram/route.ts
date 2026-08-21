import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import {
  listTelegramContentAccounts,
  pickTelegramPollAccountIds,
} from "@/lib/social-api/telegram-content-accounts";
import { getTelegramContentSettings } from "@/lib/social-api/telegram-content-settings";
import { syncPersonalAccountsByIds } from "@/lib/social-api/streamer-achievement-sync";
import { processTelegramContentQueue } from "@/lib/social-api/telegram-content-forward";
import { ensureTelegramContentWebhook } from "@/lib/telegram/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Cron: takip edilen hesaplardan taze Reels/Shorts çek, kuyruğu Telegram topicine at.
 * Vercel Hobby günde 1 cron; 15 dk tarama GitHub Actions ile gelir.
 */
async function run(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET yok" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }

  try {
    const settings = await getTelegramContentSettings();
    if (settings.enabled) {
      await ensureTelegramContentWebhook();
    }
    let poll: Awaited<ReturnType<typeof syncPersonalAccountsByIds>> | null = null;
    if (settings.enabled && isRapidApiEnabled()) {
      const listed = await listTelegramContentAccounts(settings.accountIds);
      const ids = pickTelegramPollAccountIds(listed.watched);
      if (ids.length) {
        poll = await syncPersonalAccountsByIds(ids, { maxPostsPerAccount: 8 });
      }
    }
    const summary = await processTelegramContentQueue();
    return NextResponse.json({ ok: true, poll, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "?" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
