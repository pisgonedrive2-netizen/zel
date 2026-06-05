import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Marka kiracısını tamamen kaldırır (org + marka + tüm marka kullanıcıları).
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

  const orgId = (brand as { organization_id?: string | null }).organization_id;

  await admin.from("app_users").delete().eq("brand_id", brandId);

  if (orgId) {
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
