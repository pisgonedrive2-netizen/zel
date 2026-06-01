import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { OrgRole } from "@/store/store";

/** Marka ekip görünümü için üye + bağlı kullanıcı bilgisi. */
export interface OrgTeamMember {
  memberId: string;
  organizationId: string;
  userId: string;
  orgRole: OrgRole;
  title: string;
  scopeAllBrands: boolean;
  brandIds: string[];
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
    username: string;
    avatar: string;
    active: boolean;
    lastLoginAt?: string;
    /** Platform rolü (admin = iç ajans/platform ekibi). */
    role?: string;
  } | null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Bir organizasyondaki tüm ekip üyeleri (kullanıcı bilgisi + scope markaları ile). */
export async function fetchOrgTeam(organizationId: string): Promise<OrgTeamMember[]> {
  const admin = getSupabaseAdmin();
  const { data: memberRows, error: mErr } = await admin
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId);
  if (mErr) throw new Error(`organization_members: ${mErr.message}`);
  const members = (memberRows ?? []) as Record<string, unknown>[];
  if (members.length === 0) return [];

  const userIds = members.map((m) => str(m.user_id));
  const memberIds = members.map((m) => str(m.id));

  const [{ data: userRows }, { data: scopeRows }] = await Promise.all([
    admin.from("app_users").select("id, name, username, avatar, active, last_login_at, role").in("id", userIds),
    admin.from("organization_member_brands").select("member_id, brand_id").in("member_id", memberIds),
  ]);

  const usersById = new Map<string, Record<string, unknown>>();
  for (const u of (userRows ?? []) as Record<string, unknown>[]) usersById.set(str(u.id), u);

  const scopeByMember = new Map<string, string[]>();
  for (const s of (scopeRows ?? []) as Record<string, unknown>[]) {
    const mid = str(s.member_id);
    const arr = scopeByMember.get(mid) ?? [];
    arr.push(str(s.brand_id));
    scopeByMember.set(mid, arr);
  }

  return members.map((m) => {
    const u = usersById.get(str(m.user_id));
    return {
      memberId: str(m.id),
      organizationId: str(m.organization_id),
      userId: str(m.user_id),
      orgRole: m.org_role as OrgRole,
      title: str(m.title),
      scopeAllBrands: Boolean(m.scope_all_brands),
      brandIds: scopeByMember.get(str(m.id)) ?? [],
      createdAt: str(m.created_at),
      updatedAt: str(m.updated_at),
      user: u
        ? {
            name: str(u.name),
            username: str(u.username),
            avatar: str(u.avatar),
            active: Boolean(u.active),
            lastLoginAt: u.last_login_at ? str(u.last_login_at) : undefined,
            role: u.role ? str(u.role) : undefined,
          }
        : null,
    };
  });
}

/** Tek üye (memberId) — org doğrulaması için. */
export async function findOrgMemberById(memberId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("organization_members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error(`organization_members: ${error.message}`);
  return (data as Record<string, unknown>) ?? null;
}

/** Üyenin scope markalarını sıfırlayıp yeniden yazar. */
export async function setMemberBrandScope(memberId: string, brandIds: string[]): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from("organization_member_brands").delete().eq("member_id", memberId);
  if (brandIds.length > 0) {
    const rows = brandIds.map((brand_id) => ({ member_id: memberId, brand_id }));
    const { error } = await admin.from("organization_member_brands").insert(rows);
    if (error) throw new Error(`organization_member_brands: ${error.message}`);
  }
}
