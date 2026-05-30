import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { isBrandReadOnly } from "@/lib/org-access";
import { syncAppData, pickSnapshot } from "@/lib/db/repository";
import type { AppHydratePayload } from "@/store/store";

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  // Salt-okunur marka rolleri (denetçi/görüntüleyici) brand_monthly_stats yazamaz.
  // Brand sync yalnızca bu tabloyu hedeflediğinden girişte engelliyoruz.
  if (isBrandReadOnly(session)) {
    return NextResponse.json(
      { error: "Bu hesap salt-okunur — değişiklik kaydedilemez." },
      { status: 403 }
    );
  }
  const body = (await req.json()) as AppHydratePayload;
  try {
    await syncAppData(session, pickSnapshot(body as Record<string, unknown>));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Senkronizasyon hatası";
    const status = msg.includes("senkronizasyon izni") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
