import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { purgeBrandTenant } from "@/lib/db/purge-brand-tenant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { brandFromRow, brandToRow } from "@/lib/db/mappers";
import type { Brand } from "@/store/store";

export const runtime = "nodejs";

type PatchBody = Partial<Pick<Brand, "status" | "name" | "shortName" | "category" | "notes" | "monthlyTarget">>;

/** Platform yöneticisi markayı kalıcı siler veya durumunu günceller. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Marka id gerekli." }, { status: 400 });
  }
  try {
    await purgeBrandTenant(id);
    try {
      await getSupabaseAdmin().from("audit_logs").insert({
        actor_id: session.userId,
        actor_name: session.name,
        action: "brand_deleted",
        detail: `brand=${id}`,
      });
    } catch {
      /* audit opsiyonel */
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Marka silinemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const admin = getSupabaseAdmin();
  const { data: row, error: fetchErr } = await admin
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Marka bulunamadı." }, { status: 404 });
  }
  const prev = brandFromRow(row as Record<string, unknown>);
  const next: Brand = {
    ...prev,
    ...body,
    id,
    status: body.status ?? prev.status,
  };
  const { error } = await admin.from("brands").upsert(brandToRow(next));
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, brand: next });
}
