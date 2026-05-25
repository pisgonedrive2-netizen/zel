import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled } from "@/lib/env";
import { fetchContentUrlMetadata } from "@/lib/social-url-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { url } — içerik linkinden yayın tarihi (yayıncı reel formu). */
export async function POST(req: NextRequest) {
  if (!isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "API yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ ok: false, error: "url gerekli" }, { status: 400 });
  }

  try {
    const meta = await fetchContentUrlMetadata(url);
    return NextResponse.json({ ok: true, ...meta });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Metadata alınamadı",
    }, { status: 500 });
  }
}
