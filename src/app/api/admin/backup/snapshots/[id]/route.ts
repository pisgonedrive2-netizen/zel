import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import { loadSystemBackupExport } from "@/lib/system-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Kayıtlı yedek anlık görüntüsünü JSON olarak indirir. */
export async function GET(_req: Request, ctx: RouteContext) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json({ error: "Yalnızca ana yönetici" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const payload = await loadSystemBackupExport(id);
  if (!payload) {
    return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
  }

  const filename = `foxstream-sistem-yedegi-${id}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
