import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAIN_ADMIN_ORG_ID = "org-foxstream";

/**
 * Marka kiracısını kaldırır.
 * - Bağımsız kiracı (tek markalı org): org + üyeler + marka tamamen silinir.
 * - Ajans / çoklu marka org (ör. org-foxstream): yalnızca marka satırı, marka kullanıcıları
 *   ve bu markaya özel org üyelikleri temizlenir; ajans org'u korunur.
 * `brands` silinince CASCADE ile brand_links, deals, posts vb. temizlenir.
 */
export async function purgeBrandTenant(brandId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: brand, error: brandErr } = await admin
    .from("brands")
    .select("id, organization_id")
    .eq("id", brandId)
    .maybeSingle();
  if (brandErr) throw new Error(brandErr.message);
  if (!brand) return;

  const orgId = (brand as { organization_id?: string | null }).organization_id ?? null;

  const { data: brandUsers } = await admin
    .from("app_users")
    .select("id")
    .eq("brand_id", brandId);
  const brandUserIds = (brandUsers ?? []).map((u) => String((u as { id: string }).id));

  if (orgId) {
    const { data: scopedMembers } = await admin
      .from("organization_member_brands")
      .select("member_id")
      .eq("brand_id", brandId);
    const memberIdsFromBrandScope = new Set(
      (scopedMembers ?? []).map((m) => String((m as { member_id: string }).member_id))
    );
    await admin.from("organization_member_brands").delete().eq("brand_id", brandId);

    const { data: allMembers } = await admin
      .from("organization_members")
      .select("id, user_id, org_role")
      .eq("organization_id", orgId);

    for (const m of allMembers ?? []) {
      const memberId = String((m as { id: string }).id);
      const userId = String((m as { user_id: string }).user_id);
      const orgRole = String((m as { org_role: string }).org_role);
      if (orgRole === "owner" && orgId === MAIN_ADMIN_ORG_ID) continue;
      if (brandUserIds.includes(userId)) {
        await admin.from("organization_members").delete().eq("id", memberId);
        continue;
      }
      if (!memberIdsFromBrandScope.has(memberId)) continue;
      const { data: remaining } = await admin
        .from("organization_member_brands")
        .select("brand_id")
        .eq("member_id", memberId);
      if (!remaining?.length) {
        await admin.from("organization_members").delete().eq("id", memberId);
      }
    }

    const { data: org } = await admin
      .from("organizations")
      .select("id, type")
      .eq("id", orgId)
      .maybeSingle();
    const { data: brandsInOrg } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", orgId);
    const orgType = String((org as { type?: string } | null)?.type ?? "");
    const otherBrands = (brandsInOrg ?? []).filter(
      (b) => String((b as { id: string }).id) !== brandId
    );
    const isDedicatedTenant = orgType === "brand" && otherBrands.length === 0;

    if (isDedicatedTenant) {
      const { data: members } = await admin
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId);
      const memberIds = (members ?? []).map((m) => String((m as { id: string }).id));
      if (memberIds.length > 0) {
        await admin.from("organization_member_brands").delete().in("member_id", memberIds);
        await admin.from("organization_members").delete().in("id", memberIds);
      }
      await admin.from("organizations").delete().eq("id", orgId);
    }
  }

  await admin.from("app_users").delete().eq("brand_id", brandId);

  const { error: delErr } = await admin.from("brands").delete().eq("id", brandId);
  if (delErr) throw new Error(`brands delete: ${delErr.message}`);
}

/** Marka sahibi (owner) kullanıcı silinince kiracıyı kaldır. */
export async function isBrandOwnerUser(userId: string, brandId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: brand } = await admin
    .from("brands")
    .select("organization_id")
    .eq("id", brandId)
    .maybeSingle();
  const orgId = (brand as { organization_id?: string | null } | null)?.organization_id;
  if (!orgId) return true;

  const { data: member } = await admin
    .from("organization_members")
    .select("org_role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return true;
  return String((member as { org_role: string }).org_role) === "owner";
}
