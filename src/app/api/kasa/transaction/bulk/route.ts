import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canWriteKasa(role: string): boolean {
  return role === "admin";
}

interface BulkBody {
  ids?: string[];
  countInGenel?: boolean;
}

/**
 * PATCH — birden çok kasa hareketinin `count_in_genel` bayrağını TEK sorguda
 * günceller. Toplu TRON dahil et/çıkar işlemi yüzlerce eşzamanlı tekil POST
 * yerine bunu kullanır (bağlantı limiti/aşırı yük kaynaklı kayıt hatalarını önler).
 */
export async function PATCH(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli — lütfen tekrar giriş yapın" }, { status: 401 });
  }
  if (!canWriteKasa(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekli" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BulkBody;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string" && x) : [];
  const include = Boolean(body.countInGenel);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Güncellenecek hareket id'si yok" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // Supabase/PostgREST `.in()` filtresini çok uzun listede bölmek için chunk'la.
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await admin
      .from("kasa_transactions")
      .update({ count_in_genel: include })
      .in("id", slice);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, updated: ids.length });
}
