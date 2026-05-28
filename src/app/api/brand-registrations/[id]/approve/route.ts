import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  brandToRow,
  notificationToRow,
} from "@/lib/db/mappers";
import {
  findBrandRegistrationRequestById,
  updateBrandRegistrationRequest,
  upsertAppUser,
} from "@/lib/db/repository";
import type { AppNotification, Brand } from "@/store/store";
import type { AppUser } from "@/store/auth";

export const runtime = "nodejs";

/** Server-side PIN üreteci — karışan karakterler (0/O, l/I) hariç 8 karakter. */
function generateServerPin(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Türkçe karakterleri ASCII'ye indirip slug üretir (a-z0-9-). */
function toSlug(input: string, fallback = "marka"): string {
  const tr: Record<string, string> = {
    "ç": "c", "Ç": "c",
    "ğ": "g", "Ğ": "g",
    "ı": "i", "İ": "i",
    "ö": "o", "Ö": "o",
    "ş": "s", "Ş": "s",
    "ü": "u", "Ü": "u",
  };
  const lowered = input
    .split("")
    .map((c) => tr[c] ?? c)
    .join("")
    .toLowerCase();
  const slug = lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || fallback;
}

async function uniqueBrandId(base: string): Promise<string> {
  const baseId = `br-${base}`;
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseId : `${baseId}-${i + 1}`;
    const { data, error } = await admin
      .from("brands")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (error) throw new Error(`brands check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseId}-${Date.now().toString(36)}`;
}

async function uniqueUsername(base: string): Promise<string> {
  const baseUn = base.replace(/[^a-z0-9]+/g, "").slice(0, 24) || "marka";
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseUn : `${baseUn}${i + 1}`;
    const { data, error } = await admin
      .from("app_users")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (error) throw new Error(`app_users check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseUn}${Date.now().toString(36)}`;
}

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

export async function POST(
  _req: Request,
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

    const slugBase = toSlug(reqRow.shortName || reqRow.brandName);
    const brandId = await uniqueBrandId(slugBase);
    const usernameBase =
      reqRow.preferredUsername?.replace(/[^a-z0-9]+/g, "") || slugBase;
    const username = await uniqueUsername(usernameBase);
    const userId = `u-brand-${slugBase}`.slice(0, 48);
    const plainPin = generateServerPin();
    const now = new Date().toISOString();

    const brand: Brand = {
      id: brandId,
      name: reqRow.brandName,
      shortName: reqRow.shortName || reqRow.brandName.slice(0, 12),
      category: reqRow.category,
      status: "active",
      notes: reqRow.notes,
    };

    const brandRow = {
      ...brandToRow(brand),
      created_from_request_id: reqRow.id,
    };
    const { data: insertedBrand, error: brandErr } = await getSupabaseAdmin()
      .from("brands")
      .insert(brandRow)
      .select("*")
      .maybeSingle();
    if (brandErr) {
      return NextResponse.json(
        { error: `brands: ${brandErr.message}` },
        { status: 500 },
      );
    }
    if (!insertedBrand) {
      return NextResponse.json(
        { error: "brands: insert sonuç dönmedi." },
        { status: 500 },
      );
    }

    const newUser: AppUser = {
      id: userId,
      username,
      pin: "",
      name: `${brand.name} (Marka)`,
      role: "brand",
      brandId,
      avatar: brand.shortName.slice(0, 1).toUpperCase() || "M",
      active: true,
    };
    try {
      await upsertAppUser(newUser, plainPin);
    } catch (e) {
      await getSupabaseAdmin().from("brands").delete().eq("id", brandId);
      throw e;
    }

    const updated = await updateBrandRegistrationRequest(reqRow.id, {
      status: "approved",
      reviewedBy: session.userId,
      reviewedAt: now,
      createdBrandId: brandId,
      createdUserId: userId,
    });

    try {
      await insertAuditLog(
        session.userId,
        session.name,
        "brand_registration_approved",
        `${reqRow.brandName} → brand=${brandId}, user=${userId} (req=${reqRow.id})`,
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
          `Kullanıcı adı: ${username}`,
          "PIN: yöneticinin paylaştığı tek seferlik PIN (giriş sonrası değiştir).",
        ].join("\n"),
        forRole: "brand",
        forUserId: userId,
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
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        brandId: newUser.brandId,
        avatar: newUser.avatar,
        active: newUser.active,
      },
      plainPin,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onay sırasında hata.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
