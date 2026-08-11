import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { fetchBootstrap } from "@/lib/db/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  try {
    const data = await fetchBootstrap(session);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bootstrap hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
