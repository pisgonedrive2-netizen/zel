import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { fetchViewershipBootstrap } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

/** Marka linkleri + snapshot + manuel izlenme — tam bootstrap olmadan yeniden yükleme. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  try {
    const data = await fetchViewershipBootstrap(session);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "İzlenme yükleme hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
