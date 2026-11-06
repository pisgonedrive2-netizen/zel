import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { ensureOpenCampaign } from "@/lib/clip-farm/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Açık sayfa: aktif kampanyalar ve ödül kuralları. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json(
      { ok: false, campaigns: [], hint: "offline" as const },
      { status: 503 },
    );
  }
  try {
    const campaigns = await ensureOpenCampaign();
    if (campaigns.length > 0) {
      return NextResponse.json({ ok: true, campaigns });
    }
    const { count, error } = await getSupabaseAdmin()
      .from("clip_campaigns")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    const hint = (count ?? 0) > 0 ? ("paused" as const) : ("none" as const);
    return NextResponse.json({ ok: true, campaigns: [], hint });
  } catch {
    return NextResponse.json(
      { ok: false, campaigns: [], hint: "error" as const, error: "Kampanyalar şu an yüklenemiyor." },
      { status: 503 },
    );
  }
}
