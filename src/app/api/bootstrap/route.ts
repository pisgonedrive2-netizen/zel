import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { fetchBootstrap } from "@/lib/db/repository";

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
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bootstrap hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
