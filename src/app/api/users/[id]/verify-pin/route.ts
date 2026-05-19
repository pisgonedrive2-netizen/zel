import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/password";

/**
 * Admin-only PIN doğrulama. Sunucudaki hash'e karşı verilen düz PIN'i kontrol
 * eder; oturum açmadan kullanıcının doğru PIN'i alıp almadığı doğrulanabilir.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  const pin = (body.pin ?? "").trim();
  if (!pin) {
    return NextResponse.json({ error: "PIN gerekli" }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("pin_hash, active, username")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }
  const ok = await verifyPin(pin, String(data.pin_hash));
  return NextResponse.json({
    ok,
    username: String(data.username ?? ""),
    active: Boolean(data.active),
  });
}
