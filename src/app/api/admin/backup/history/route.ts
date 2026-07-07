import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import { listSystemBackupSnapshots } from "@/lib/system-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Son sistem yedeklerinin listesi — yalnızca ana yönetici. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json({ error: "Yalnızca ana yönetici" }, { status: 403 });
  }

  const snapshots = await listSystemBackupSnapshots(30);
  return NextResponse.json({ snapshots });
}
