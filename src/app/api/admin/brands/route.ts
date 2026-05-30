import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { provisionBrandTenant } from "@/lib/db/provision-brand";

export const runtime = "nodejs";

interface Body {
  brandName?: string;
  shortName?: string;
  category?: string;
  contactName?: string;
  contactEmail?: string;
  preferredUsername?: string;
  customPin?: string;
  notes?: string;
}

/**
 * Platform yöneticisi yeni bağımsız marka kiracısı açar (org + brand + sahibi).
 * B2B sisteminin dışındaki yönetici paneli için. Kayıt onayından bağımsız.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const brandName = body.brandName?.trim() ?? "";
  if (!brandName) {
    return NextResponse.json({ error: "Marka adı zorunlu." }, { status: 400 });
  }
  if (body.customPin && body.customPin.trim().length > 0 && body.customPin.trim().length < 4) {
    return NextResponse.json({ error: "PIN en az 4 karakter olmalı." }, { status: 400 });
  }

  try {
    const { brand, user, organization, plainPin } = await provisionBrandTenant({
      brandName,
      shortName: body.shortName?.trim() || undefined,
      category: body.category?.trim() || undefined,
      contactName: body.contactName?.trim() || undefined,
      contactEmail: body.contactEmail?.trim() || undefined,
      preferredUsername: body.preferredUsername?.trim() || undefined,
      customPin: body.customPin?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
    });

    try {
      await getSupabaseAdmin().from("audit_logs").insert({
        actor_id: session.userId,
        actor_name: session.name,
        action: "brand_created",
        detail: `${brand.name} → brand=${brand.id}, org=${organization.id}, user=${user.id}`,
      });
    } catch {
      /* audit opsiyonel */
    }

    return NextResponse.json({
      ok: true,
      brand,
      organization,
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Marka oluşturulamadı." },
      { status: 500 }
    );
  }
}
