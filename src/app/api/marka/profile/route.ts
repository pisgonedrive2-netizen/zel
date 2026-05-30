import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { isBrandReadOnly } from "@/lib/org-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileBody = {
  brandId?: string;
  name?: string;
  shortName?: string;
  category?: string;
  notes?: string;
};

/**
 * POST — Marka profilini günceller (ad, kısa ad, kategori, notlar).
 * Yalnızca admin veya hedef markaya bağlı `brand` rolü düzenleyebilir.
 * Durum (status) ve hedef (monthlyTarget) bu uçtan değiştirilmez.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (isBrandReadOnly(session)) {
    return NextResponse.json(
      { error: "Bu hesap salt-okunur — değişiklik kaydedilemez." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as ProfileBody | null;
  const brandId = String(body?.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  }

  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== brandId) {
      return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
    }
  } else if (session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const update: Record<string, string> = {};
  if (typeof body?.name === "string") {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ error: "Marka adı boş olamaz" }, { status: 400 });
    update.name = v;
  }
  if (typeof body?.shortName === "string") update.short_name = body.shortName.trim();
  if (typeof body?.category === "string") update.category = body.category.trim();
  if (typeof body?.notes === "string") update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("brands")
    .update(update)
    .eq("id", brandId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, brandId });
}
