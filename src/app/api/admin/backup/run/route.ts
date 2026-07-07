import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import { runSystemBackup } from "@/lib/system-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manuel tam sistem yedeği — DB'ye kaydeder ve Orkun'a bildirim gönderir. */
export async function POST() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json({ error: "Yalnızca ana yönetici" }, { status: 403 });
  }

  try {
    const meta = await runSystemBackup({ triggeredBy: "manual", notify: true });
    return NextResponse.json({ ok: true, snapshot: meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : "?";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
