import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getTelegramWebhookSecret } from "@/lib/telegram/bot";
import { applyTelegramGroupUpdate } from "@/lib/social-api/telegram-content-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram bot webhook — bot bir gruba eklenince / gruptan çıkınca
 * kayıtlı grup listesini günceller. getUpdates ile aynı anda kullanılamaz.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const secret = getTelegramWebhookSecret();
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || header !== secret) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const update = await req.json().catch(() => null);
  if (!update || typeof update !== "object") {
    return NextResponse.json({ ok: true });
  }

  try {
    const groups = await applyTelegramGroupUpdate(update);
    return NextResponse.json({ ok: true, groups: groups.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "?" },
      { status: 500 }
    );
  }
}
