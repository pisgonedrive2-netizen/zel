import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "expense");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Sadece resim dosyaları yüklenebilir (png/jpg/webp/gif)" },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya 10MB'den büyük olamaz" }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeFolder = folder.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 32);
  const key = `${safeFolder}/${session.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await getSupabaseAdmin().storage
    .from("proofs")
    .upload(key, buffer, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: `Yükleme başarısız: ${error.message}` }, { status: 500 });
  }

  const { data } = getSupabaseAdmin().storage.from("proofs").getPublicUrl(key);
  return NextResponse.json({ url: data.publicUrl, path: key });
}
