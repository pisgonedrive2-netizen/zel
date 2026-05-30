import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import type { SessionPayload } from "@/lib/session";
import { canManageOrgTeam, writeAudit, accessibleBrandIds } from "@/lib/org-access";
import { organizationMemberToRow } from "@/lib/db/mappers";
import { upsertAppUser } from "@/lib/db/repository";
import { fetchOrgTeam, findOrgMemberById, setMemberBrandScope } from "@/lib/db/org-team-repo";
import { ASSIGNABLE_ORG_ROLES, ORG_ROLE_LABELS } from "@/lib/org-roles";
import type { AppUser } from "@/store/auth";
import type { OrganizationMember, OrgRole } from "@/store/store";

export const runtime = "nodejs";

function generateServerPin(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function uniqueUsername(base: string): Promise<string> {
  const baseUn = base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "ekip";
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 40; i++) {
    const candidate = i === 0 ? baseUn : `${baseUn}${i + 1}`;
    const { data, error } = await admin.from("app_users").select("id").eq("username", candidate).maybeSingle();
    if (error) throw new Error(`app_users check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseUn}${Date.now().toString(36)}`;
}

/**
 * Oturum için ekip yönetilecek organizasyonu + erişilebilir markaları çözer.
 * Marka kullanıcısı: kendi org'u. Platform admini: ?brandId= ile markanın org'u.
 */
async function resolveTeamOrg(
  session: SessionPayload,
  requestedBrandId?: string | null
): Promise<{ organizationId: string; brandIds: string[] } | null> {
  const admin = getSupabaseAdmin();
  if (session.role === "brand") {
    if (!session.organizationId) return null;
    return { organizationId: session.organizationId, brandIds: accessibleBrandIds(session) };
  }
  if (session.role === "admin") {
    if (!requestedBrandId) return null;
    const { data: brandRow } = await admin
      .from("brands")
      .select("organization_id")
      .eq("id", requestedBrandId)
      .maybeSingle();
    const orgId = brandRow ? String((brandRow as Record<string, unknown>).organization_id ?? "") : "";
    if (!orgId) return null;
    const { data: brandRows } = await admin.from("brands").select("id").eq("organization_id", orgId);
    const brandIds = (brandRows ?? []).map((b) => String((b as Record<string, unknown>).id));
    return { organizationId: orgId, brandIds };
  }
  return null;
}

// ── GET: ekip listesi ───────────────────────────────────────────────────────
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const url = new URL(req.url);
  const ctx = await resolveTeamOrg(session, url.searchParams.get("brandId"));
  if (!ctx) return NextResponse.json({ error: "Organizasyon bulunamadı." }, { status: 403 });

  try {
    const members = await fetchOrgTeam(ctx.organizationId);
    return NextResponse.json({ members, brandIds: ctx.brandIds, canManage: canManageOrgTeam(session) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Yüklenemedi" }, { status: 500 });
  }
}

// ── POST: yeni ekip üyesi oluştur ─────────────────────────────────────────────
interface CreateBody {
  name?: string;
  username?: string;
  orgRole?: string;
  title?: string;
  scopeAllBrands?: boolean;
  brandIds?: string[];
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManageOrgTeam(session)) {
    return NextResponse.json({ error: "Ekip yönetme yetkiniz yok." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const name = body.name?.trim() ?? "";
  const orgRole = (body.orgRole ?? "") as OrgRole;
  if (!name) return NextResponse.json({ error: "Ad soyad zorunlu." }, { status: 400 });
  if (!ASSIGNABLE_ORG_ROLES.includes(orgRole)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  // Admin'in brandId'sini bulmak için scope brandIds gönderiminden ilkini kullan.
  const firstBrand = body.brandIds?.[0];
  const ctx = await resolveTeamOrg(session, firstBrand);
  if (!ctx) return NextResponse.json({ error: "Organizasyon bulunamadı." }, { status: 403 });

  const scopeAllBrands = body.scopeAllBrands ?? false;
  // İstenen markalar yalnızca org'un markalarıyla sınırlı olabilir.
  const requestedBrands = (body.brandIds ?? []).filter((b) => ctx.brandIds.includes(b));
  const scopeBrands = scopeAllBrands ? ctx.brandIds : requestedBrands;
  if (!scopeAllBrands && scopeBrands.length === 0) {
    return NextResponse.json({ error: "En az bir marka seçin veya tüm markalar erişimini açın." }, { status: 400 });
  }

  try {
    const username = await uniqueUsername(body.username?.trim() || name.replace(/\s+/g, ""));
    const userId = `u-team-${username}`.slice(0, 48);
    const plainPin = generateServerPin();
    const now = new Date().toISOString();
    const primaryBrand = scopeBrands[0] ?? ctx.brandIds[0];

    const newUser: AppUser = {
      id: userId,
      username,
      pin: "",
      name,
      role: "brand",
      brandId: primaryBrand,
      avatar: name.slice(0, 1).toUpperCase() || "E",
      active: true,
    };
    await upsertAppUser(newUser, plainPin);

    const memberId = `om-${userId}`.slice(0, 48);
    const member: OrganizationMember = {
      id: memberId,
      organizationId: ctx.organizationId,
      userId,
      orgRole,
      scopeAllBrands,
      title: body.title?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
    };
    const { error: memberErr } = await getSupabaseAdmin()
      .from("organization_members")
      .insert(organizationMemberToRow(member));
    if (memberErr) {
      // Rollback user.
      await getSupabaseAdmin().from("app_users").delete().eq("id", userId);
      return NextResponse.json({ error: `organization_members: ${memberErr.message}` }, { status: 500 });
    }
    if (!scopeAllBrands) await setMemberBrandScope(memberId, scopeBrands);

    await writeAudit(
      session,
      "brand_team_member_added",
      `${name} (${ORG_ROLE_LABELS[orgRole]}) → org=${ctx.organizationId}, user=${userId}`
    );

    return NextResponse.json({ ok: true, userId, username, memberId, plainPin });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Oluşturulamadı" }, { status: 500 });
  }
}

// ── PATCH: üye güncelle (rol/başlık/durum/scope/PIN) ──────────────────────────
interface PatchBody {
  memberId?: string;
  orgRole?: string;
  title?: string;
  active?: boolean;
  scopeAllBrands?: boolean;
  brandIds?: string[];
  resetPin?: boolean;
}

export async function PATCH(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManageOrgTeam(session)) {
    return NextResponse.json({ error: "Ekip yönetme yetkiniz yok." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const memberId = body.memberId?.trim() ?? "";
  if (!memberId) return NextResponse.json({ error: "memberId zorunlu." }, { status: 400 });

  try {
    const memberRow = await findOrgMemberById(memberId);
    if (!memberRow) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
    const memberOrg = String(memberRow.organization_id);
    const targetUserId = String(memberRow.user_id);

    const ctx = await resolveTeamOrg(session, body.brandIds?.[0]);
    if (!ctx || ctx.organizationId !== memberOrg) {
      return NextResponse.json({ error: "Bu üye için yetkili değilsiniz." }, { status: 403 });
    }
    // Sahibin rolü bu arayüzden değiştirilemez.
    if (String(memberRow.org_role) === "owner" && body.orgRole && body.orgRole !== "owner") {
      return NextResponse.json({ error: "Marka sahibinin rolü değiştirilemez." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const memberPatch: Record<string, unknown> = {};
    if (body.orgRole && String(memberRow.org_role) !== "owner") {
      if (!ASSIGNABLE_ORG_ROLES.includes(body.orgRole as OrgRole)) {
        return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
      }
      memberPatch.org_role = body.orgRole;
    }
    if (typeof body.title === "string") memberPatch.title = body.title.trim();
    if (typeof body.scopeAllBrands === "boolean") memberPatch.scope_all_brands = body.scopeAllBrands;
    if (Object.keys(memberPatch).length > 0) {
      const { error } = await admin.from("organization_members").update(memberPatch).eq("id", memberId);
      if (error) throw new Error(`organization_members: ${error.message}`);
    }

    if (Array.isArray(body.brandIds) && body.scopeAllBrands !== true) {
      const scope = body.brandIds.filter((b) => ctx.brandIds.includes(b));
      await setMemberBrandScope(memberId, scope);
    } else if (body.scopeAllBrands === true) {
      await setMemberBrandScope(memberId, []);
    }

    if (typeof body.active === "boolean") {
      const { error } = await admin.from("app_users").update({ active: body.active }).eq("id", targetUserId);
      if (error) throw new Error(`app_users: ${error.message}`);
    }

    let plainPin: string | undefined;
    if (body.resetPin) {
      plainPin = generateServerPin();
      const { data: userRow } = await admin
        .from("app_users")
        .select("id, username, name, role, employee_id, brand_id, avatar, active")
        .eq("id", targetUserId)
        .maybeSingle();
      if (userRow) {
        const u = userRow as Record<string, unknown>;
        await upsertAppUser(
          {
            id: String(u.id),
            username: String(u.username),
            pin: "",
            name: String(u.name),
            role: u.role as AppUser["role"],
            employeeId: u.employee_id ? String(u.employee_id) : undefined,
            brandId: u.brand_id ? String(u.brand_id) : undefined,
            avatar: String(u.avatar ?? ""),
            active: Boolean(u.active),
          },
          plainPin
        );
      }
    }

    await writeAudit(session, "brand_team_member_updated", `member=${memberId} (org=${memberOrg})`);
    return NextResponse.json({ ok: true, plainPin });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Güncellenemedi" }, { status: 500 });
  }
}

// ── DELETE: üyeyi kaldır (kullanıcıyı pasifleştir + üyeliği sil) ───────────────
export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManageOrgTeam(session)) {
    return NextResponse.json({ error: "Ekip yönetme yetkiniz yok." }, { status: 403 });
  }

  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId")?.trim() ?? "";
  if (!memberId) return NextResponse.json({ error: "memberId zorunlu." }, { status: 400 });

  try {
    const memberRow = await findOrgMemberById(memberId);
    if (!memberRow) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });
    const memberOrg = String(memberRow.organization_id);
    const targetUserId = String(memberRow.user_id);

    const ctx = await resolveTeamOrg(session, url.searchParams.get("brandId"));
    if (!ctx || ctx.organizationId !== memberOrg) {
      return NextResponse.json({ error: "Bu üye için yetkili değilsiniz." }, { status: 403 });
    }
    if (String(memberRow.org_role) === "owner") {
      return NextResponse.json({ error: "Marka sahibi kaldırılamaz." }, { status: 400 });
    }
    if (targetUserId === session.userId) {
      return NextResponse.json({ error: "Kendinizi kaldıramazsınız." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    await admin.from("organization_members").delete().eq("id", memberId);
    await admin.from("app_users").update({ active: false }).eq("id", targetUserId);

    await writeAudit(session, "brand_team_member_removed", `member=${memberId} (org=${memberOrg})`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kaldırılamadı" }, { status: 500 });
  }
}
