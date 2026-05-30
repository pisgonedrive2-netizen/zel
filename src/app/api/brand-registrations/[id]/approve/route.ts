import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { notificationToRow } from "@/lib/db/mappers";
import {
  findBrandRegistrationRequestById,
  updateBrandRegistrationRequest,
} from "@/lib/db/repository";
import { provisionBrandTenant } from "@/lib/db/provision-brand";
import type { AppNotification } from "@/store/store";

export const runtime = "nodejs";

async function insertNotification(notif: AppNotification): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("app_notifications")
    .insert(notificationToRow(notif));
  if (!error) return;
  const isEnum =
    error.message.includes("enum") ||
    error.message.includes("invalid input value");
  if (isEnum) {
    await getSupabaseAdmin()
      .from("app_notifications")
      .insert(notificationToRow({ ...notif, type: "general" }));
    return;
  }
  throw new Error(error.message);
}

async function insertAuditLog(
  actorId: string,
  actorName: string,
  action: string,
  detail: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("audit_logs").insert({
    actor_id: actorId,
    actor_name: actorName,
    action,
    detail,
  });
  if (error) throw new Error(`audit_logs: ${error.message}`);
}

type ApproveBody = { usernameOverride?: string; customPin?: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json(
      { error: "Supabase yapılandırılmamış." },
      { status: 503 },
    );
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Başvuru id zorunlu." }, { status: 400 });
  }

  // Gövde opsiyonel: boş gövde / geçersiz JSON tolere edilir.
  const body = (await req.json().catch(() => ({}))) as ApproveBody;
  const usernameOverride = body.usernameOverride?.trim().toLowerCase() || undefined;
  const customPin = body.customPin?.trim() || undefined;

  try {
    const reqRow = await findBrandRegistrationRequestById(id);
    if (!reqRow) {
      return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    }
    if (reqRow.status === "approved") {
      return NextResponse.json(
        { error: "Bu başvuru zaten onaylanmış." },
        { status: 409 },
      );
    }
    if (reqRow.status === "rejected") {
      return NextResponse.json(
        { error: "Reddedilmiş bir başvuru onaylanamaz." },
        { status: 409 },
      );
    }

    const { brand, user, plainPin } = await provisionBrandTenant({
      brandName: reqRow.brandName,
      shortName: reqRow.shortName || undefined,
      category: reqRow.category,
      contactName: reqRow.contactName,
      contactEmail: reqRow.contactEmail,
      preferredUsername: usernameOverride || reqRow.preferredUsername || undefined,
      notes: reqRow.notes,
      customPin,
      createdFromRequestId: reqRow.id,
    });

    const now = new Date().toISOString();
    const updated = await updateBrandRegistrationRequest(reqRow.id, {
      status: "approved",
      reviewedBy: session.userId,
      reviewedAt: now,
      createdBrandId: brand.id,
      createdUserId: user.id,
    });

    try {
      await insertAuditLog(
        session.userId,
        session.name,
        "brand_registration_approved",
        `${reqRow.brandName} → brand=${brand.id}, user=${user.id} (req=${reqRow.id})`,
      );
    } catch {
      /* audit hatası akışı kesmesin */
    }

    try {
      const welcome: AppNotification = {
        id: `n-${crypto.randomUUID().slice(0, 12)}`,
        type: "general",
        title: `Foxstream'e hoş geldin — ${brand.name}`,
        message: [
          "Marka kaydın onaylandı. Aşağıdaki bilgilerle giriş yapabilirsin.",
          `Kullanıcı adı: ${user.username}`,
          "PIN: yöneticinin paylaştığı tek seferlik PIN (giriş sonrası değiştir).",
        ].join("\n"),
        forRole: "brand",
        forUserId: user.id,
        refId: reqRow.id,
        triggeredBy: session.userId,
        createdAt: now,
        read: false,
        href: "/marka/operasyon",
      };
      await insertNotification(welcome);
    } catch {
      /* bildirim isteğe bağlı */
    }

    return NextResponse.json({
      ok: true,
      request: updated,
      brand,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        brandId: user.brandId,
        avatar: user.avatar,
        active: user.active,
      },
      plainPin,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onay sırasında hata.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
