import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { REGISTRATION_ENABLED } from "@/lib/feature-flags";
import { notificationToRow } from "@/lib/db/mappers";
import {
  createStreamerRegistrationRequest,
  fetchStreamerRegistrationRequests,
  findRecentPendingStreamerRegistration,
} from "@/lib/db/repository";
import type { AppNotification, StreamerRegistrationRequest } from "@/store/store";
import { fmtDateTime } from "@/lib/fmt-date";

export const runtime = "nodejs";

type PostBody = {
  displayName?: string;
  realName?: string;
  contactEmail?: string;
  contactPhone?: string;
  telegram?: string;
  platforms?: string;
  categories?: string;
  audienceSize?: string;
  preferredUsername?: string;
  notes?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function insertAdminNotification(notif: AppNotification): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("app_notifications")
    .insert(notificationToRow(notif));
  if (!error) return;
  const isEnum =
    error.message.includes("enum") || error.message.includes("invalid input value");
  if (isEnum) {
    const { error: retryErr } = await getSupabaseAdmin()
      .from("app_notifications")
      .insert(notificationToRow({ ...notif, type: "general" }));
    if (!retryErr) return;
    throw new Error(retryErr.message);
  }
  throw new Error(error.message);
}

function newRequestId(): string {
  return `sreq-${crypto.randomUUID().slice(0, 12)}`;
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json(
      { error: "Başvuru şu an alınamıyor. Lütfen yönetici ile iletişime geçin." },
      { status: 503 }
    );
  }
  if (!REGISTRATION_ENABLED) {
    return NextResponse.json({ error: "Yayıncı kayıt başvuruları şu an kapalı." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const displayName = body.displayName?.trim() ?? "";
  const contactEmail = body.contactEmail?.trim().toLowerCase() ?? "";

  if (!displayName) {
    return NextResponse.json({ error: "Görünen ad zorunlu." }, { status: 400 });
  }
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }

  try {
    const dup = await findRecentPendingStreamerRegistration(contactEmail, displayName);
    if (dup) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          requestId: dup.id,
          message:
            "Bu profil için bekleyen bir başvurunuz zaten var. Yönetici yanıt verdikten sonra tekrar deneyebilirsiniz.",
        },
        { status: 200 }
      );
    }

    const now = new Date().toISOString();
    const request: StreamerRegistrationRequest = {
      id: newRequestId(),
      displayName,
      realName: body.realName?.trim() || undefined,
      contactEmail,
      contactPhone: body.contactPhone?.trim() || undefined,
      telegram: body.telegram?.trim() || undefined,
      platforms: body.platforms?.trim() ?? "",
      categories: body.categories?.trim() ?? "",
      audienceSize: body.audienceSize?.trim() || undefined,
      preferredUsername: body.preferredUsername?.trim().toLowerCase() || undefined,
      notes: body.notes?.trim() ?? "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const created = await createStreamerRegistrationRequest(request);

    const lines = [
      `Yayıncı: ${created.displayName}`,
      created.realName ? `Gerçek ad: ${created.realName}` : null,
      `İletişim: ${created.contactEmail}`,
      created.contactPhone ? `Telefon: ${created.contactPhone}` : null,
      created.telegram ? `Telegram: ${created.telegram}` : null,
      created.platforms ? `Platformlar: ${created.platforms}` : null,
      created.categories ? `Kategoriler: ${created.categories}` : null,
      created.audienceSize ? `Kitle: ${created.audienceSize}` : null,
      created.preferredUsername ? `Tercih edilen kullanıcı adı: ${created.preferredUsername}` : null,
      created.notes ? `Not: ${created.notes}` : null,
      `Tarih: ${fmtDateTime(new Date())}`,
    ].filter(Boolean);

    const notif: AppNotification = {
      id: `n-${crypto.randomUUID().slice(0, 12)}`,
      type: "account_registration_request",
      title: `Yeni yayıncı kayıt başvurusu — ${created.displayName}`,
      message: lines.join("\n"),
      forRole: "admin",
      refId: created.id,
      createdAt: now,
      read: false,
      href: "/kullanicilar?tab=yayinci-basvurulari",
    };
    try {
      await insertAdminNotification(notif);
    } catch {
      /* bildirim akışı başvuru kaydını engellemesin */
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: created.id,
        message:
          "Başvurunuz alındı. Yönetici onayından sonra giriş bilgileriniz size iletilecektir.",
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Başvuru kaydedilemedi.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ requests: [] });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const allowed: StreamerRegistrationRequest["status"][] = [
    "pending",
    "approved",
    "rejected",
    "duplicate",
  ];
  const status =
    statusParam && allowed.includes(statusParam as StreamerRegistrationRequest["status"])
      ? (statusParam as StreamerRegistrationRequest["status"])
      : undefined;

  try {
    const requests = await fetchStreamerRegistrationRequests(status);
    return NextResponse.json({ requests });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Liste alınamadı.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
