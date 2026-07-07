import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import { exportSystemTables } from "@/lib/system-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tam sistem yedeği — tüm önemli Supabase tablolarının anlık görüntüsü.
 * İstemci store yedeğinden farklı olarak doğrudan veritabanından okur.
 * Yalnızca ana yönetici (Orkun) erişebilir.
 */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json({ error: "Yalnızca ana yönetici" }, { status: 403 });
  }

  const { tables, tableStats, errors, totalRows } = await exportSystemTables();

  const payload = {
    snapshotVersion: 1,
    exportedAt: new Date().toISOString(),
    project: "foxstream",
    totalRows,
    tableCount: Object.keys(tables).length,
    tableStats,
    tables,
    ...(Object.keys(errors).length ? { errors } : {}),
  };

  const filename = `foxstream-sistem-yedegi-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
