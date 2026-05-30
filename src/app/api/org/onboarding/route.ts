import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  findOrganizationById,
  updateOrganization,
} from "@/lib/db/repository";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit, hasOrgCapability } from "@/lib/org-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCIES = ["USD", "EUR", "TRY"] as const;

/** GET /api/org/onboarding — oturum org'unun onboarding durumu. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!session.organizationId) {
    return NextResponse.json({ organization: null, completed: true });
  }
  const org = await findOrganizationById(session.organizationId).catch(() => null);
  return NextResponse.json({
    organization: org,
    completed: org?.onboardingCompleted ?? true,
  });
}

type Body = {
  name?: string;
  primaryColor?: string;
  defaultCurrency?: string;
  timezone?: string;
  contactName?: string;
  contactEmail?: string;
  logoUrl?: string;
  /** İlişkili tek markanın kategorisi (type=brand org için). */
  brandCategory?: string;
  /** İlk markanın aylık hedefi. */
  brandMonthlyTarget?: number;
  complete?: boolean;
};

/** POST /api/org/onboarding — org profilini günceller, opsiyonel olarak tamamlar. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organizasyon bulunamadı" }, { status: 400 });
  }
  if (!hasOrgCapability(session, "admin")) {
    return NextResponse.json({ error: "Yetki yok (owner/admin gerekli)" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)) {
    patch.primary_color = body.primaryColor;
  }
  if (typeof body.defaultCurrency === "string" && (CURRENCIES as readonly string[]).includes(body.defaultCurrency)) {
    patch.default_currency = body.defaultCurrency;
  }
  if (typeof body.timezone === "string" && body.timezone.trim()) patch.timezone = body.timezone.trim();
  if (typeof body.contactName === "string") patch.contact_name = body.contactName.trim() || null;
  if (typeof body.contactEmail === "string") patch.contact_email = body.contactEmail.trim() || null;
  if (typeof body.logoUrl === "string") patch.logo_url = body.logoUrl.trim() || null;
  if (body.complete === true) patch.onboarding_completed = true;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  try {
    const org = await updateOrganization(session.organizationId, patch);

    // type=brand org'larda tek markanın kategori/hedefini de güncelle.
    if (
      (typeof body.brandCategory === "string" || typeof body.brandMonthlyTarget === "number") &&
      session.brandId
    ) {
      const brandPatch: Record<string, unknown> = {};
      if (typeof body.brandCategory === "string" && body.brandCategory.trim()) {
        brandPatch.category = body.brandCategory.trim();
      }
      if (typeof body.brandMonthlyTarget === "number" && body.brandMonthlyTarget >= 0) {
        brandPatch.monthly_target = Math.round(body.brandMonthlyTarget);
      }
      if (Object.keys(brandPatch).length > 0) {
        await getSupabaseAdmin().from("brands").update(brandPatch).eq("id", session.brandId);
      }
    }

    if (body.complete === true) {
      await writeAudit(session, "org_onboarding_completed", `org=${org.id} (${org.name})`);
    }
    return NextResponse.json({ organization: org });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
