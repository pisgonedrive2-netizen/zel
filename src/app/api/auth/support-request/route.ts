import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { notificationToRow } from "@/lib/db/mappers";
import type { AppNotification } from "@/store/store";
import { REGISTRATION_ENABLED } from "@/lib/feature-flags";
import { fmtDateTime } from "@/lib/fmt-date";

export const runtime = "nodejs";

type PasswordResetBody = {
  type: "password_reset";
  username: string;
  contact?: string;
  note?: string;
};

type RegistrationBody = {
  type: "registration";
  fullName: string;
  preferredUsername?: string;
  accountType?: string;
  contact?: string;
  note?: string;
};

type Body = PasswordResetBody | RegistrationBody;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function insertAdminNotification(notif: AppNotification) {
  const { error } = await getSupabaseAdmin()
    .from("app_notifications")
    .insert(notificationToRow(notif));
  if (!error) return;

  // Migration henüz uygulanmadıysa enum hatası — general ile yedekle
  const isEnum =
    error.message.includes("enum") ||
    error.message.includes("invalid input value");
  const canFallback =
    notif.type === "password_reset_request" || notif.type === "account_registration_request";
  if (isEnum && canFallback) {
    const { error: retryErr } = await getSupabaseAdmin()
      .from("app_notifications")
      .insert(notificationToRow({ ...notif, type: "general" }));
    if (!retryErr) return;
    throw new Error(retryErr.message);
  }
  throw new Error(error.message);
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json(
      { error: "Talep şu an kaydedilemiyor. Lütfen yöneticiyle doğrudan iletişime geçin." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.type) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const day = todayKey();

  try {
    if (body.type === "password_reset") {
      const username = body.username?.trim().toLowerCase() ?? "";
      if (!username) {
        return NextResponse.json({ error: "Kullanıcı adı gerekli" }, { status: 400 });
      }
      const contact = body.contact?.trim() ?? "";
      const note = body.note?.trim() ?? "";
      const refId = `pwd-reset:${username}:${day}`;

      const { data: existing } = await getSupabaseAdmin()
        .from("app_notifications")
        .select("id")
        .eq("ref_id", refId)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({
          ok: true,
          message: "Bugün için bu kullanıcı adına zaten şifre sıfırlama talebi iletildi. Yönetici en kısa sürede dönüş yapacaktır.",
        });
      }

      const lines = [
        `Kullanıcı adı: ${username}`,
        contact ? `İletişim: ${contact}` : null,
        note ? `Not: ${note}` : null,
        `Tarih: ${fmtDateTime(new Date())}`,
      ].filter(Boolean);

      const notif: AppNotification = {
        id: `n-${crypto.randomUUID().slice(0, 12)}`,
        type: "password_reset_request",
        title: `Şifre sıfırlama talebi — ${username}`,
        message: lines.join("\n"),
        forRole: "admin",
        refId,
        createdAt: now,
        read: false,
        href: "/kullanicilar",
      };
      await insertAdminNotification(notif);

      return NextResponse.json({
        ok: true,
        message:
          "Talebiniz yöneticiye iletildi. PIN sıfırlama için en kısa sürede size dönüş yapılacaktır.",
      });
    }

    if (body.type === "registration") {
      if (!REGISTRATION_ENABLED) {
        return NextResponse.json(
          { error: "Kayıt talepleri şu an kapalı. Lütfen yöneticiyle iletişime geçin." },
          { status: 403 },
        );
      }
      const fullName = body.fullName?.trim() ?? "";
      if (!fullName) {
        return NextResponse.json({ error: "Ad soyad gerekli" }, { status: 400 });
      }
      const preferredUsername = body.preferredUsername?.trim().toLowerCase() ?? "";
      const accountType = body.accountType?.trim() || "belirtilmedi";
      const contact = body.contact?.trim() ?? "";
      const note = body.note?.trim() ?? "";
      const refId = `register:${preferredUsername || fullName.toLowerCase().replace(/\s+/g, "-")}:${day}`;

      const lines = [
        `Ad: ${fullName}`,
        preferredUsername ? `Tercih edilen kullanıcı adı: ${preferredUsername}` : null,
        `Hesap türü: ${accountType}`,
        contact ? `İletişim: ${contact}` : null,
        note ? `Mesaj: ${note}` : null,
        `Tarih: ${fmtDateTime(new Date())}`,
      ].filter(Boolean);

      const notif: AppNotification = {
        id: `n-${crypto.randomUUID().slice(0, 12)}`,
        type: "account_registration_request",
        title: `Yeni hesap kayıt talebi — ${fullName}`,
        message: lines.join("\n"),
        forRole: "admin",
        refId,
        createdAt: now,
        read: false,
        href: "/kullanicilar",
      };
      await insertAdminNotification(notif);

      return NextResponse.json({
        ok: true,
        message:
          "Kayıt talebiniz alındı. Yönetici onayından sonra giriş bilgileriniz size iletilecektir.",
      });
    }

    return NextResponse.json({ error: "Geçersiz talep türü" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kayıt başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
