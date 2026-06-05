import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow, kasaAccountToRow } from "@/lib/db/mappers";
import type { Kasa } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — kasa hesabını Supabase'e yazar (admin/denetçi). */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Kasa> & { id?: string };
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const row = kasaAccountToRow({
    id,
    name: body.name ?? "",
    kind: body.kind ?? "general",
    currency: body.currency ?? "USD",
    isDefault: body.isDefault ?? false,
    archived: body.archived ?? false,
    orderIndex: body.orderIndex ?? 0,
    notes: body.notes ?? "",
    tronAddress: body.tronAddress,
    tronSyncFrom: body.tronSyncFrom,
  } as Kasa);

  const { error } = await getSupabaseAdmin()
    .from("kasas")
    .upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await getSupabaseAdmin()
    .from("kasas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    kasa: data ? kasaAccountFromRow(data as Record<string, unknown>) : null,
  });
}
