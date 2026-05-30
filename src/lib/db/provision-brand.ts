import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { brandToRow, organizationToRow, organizationMemberToRow } from "@/lib/db/mappers";
import { upsertAppUser } from "@/lib/db/repository";
import type { AppUser } from "@/store/auth";
import type { Brand, Organization, OrganizationMember } from "@/store/store";

/** Server-side PIN üreteci — karışan karakterler (0/O, l/I) hariç 8 karakter. */
export function generateServerPin(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Türkçe karakterleri ASCII'ye indirip slug üretir (a-z0-9-). */
export function toSlug(input: string, fallback = "marka"): string {
  const tr: Record<string, string> = {
    "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "İ": "i",
    "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u",
  };
  const lowered = input.split("").map((c) => tr[c] ?? c).join("").toLowerCase();
  const slug = lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug || fallback;
}

async function uniqueBrandId(base: string): Promise<string> {
  const baseId = `br-${base}`;
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseId : `${baseId}-${i + 1}`;
    const { data, error } = await admin.from("brands").select("id").eq("id", candidate).maybeSingle();
    if (error) throw new Error(`brands check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseId}-${Date.now().toString(36)}`;
}

async function uniqueOrgSlug(base: string): Promise<string> {
  const baseSlug = base || "marka";
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const { data, error } = await admin.from("organizations").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw new Error(`organizations check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

async function uniqueUsername(base: string): Promise<string> {
  const baseUn = base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "marka";
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseUn : `${baseUn}${i + 1}`;
    const { data, error } = await admin.from("app_users").select("id").eq("username", candidate).maybeSingle();
    if (error) throw new Error(`app_users check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseUn}${Date.now().toString(36)}`;
}

export interface ProvisionBrandInput {
  brandName: string;
  shortName?: string;
  category?: string;
  contactName?: string;
  contactEmail?: string;
  preferredUsername?: string;
  notes?: string;
  customPin?: string;
  createdFromRequestId?: string;
}

export interface ProvisionBrandResult {
  organization: Organization;
  brand: Brand;
  user: AppUser;
  memberId: string;
  plainPin: string;
}

/**
 * Yeni bağımsız marka kiracısı oluşturur: organization (type=brand) + brand +
 * marka sahibi kullanıcısı (role=brand, owner üyeliği, tek markaya scope'lu) + PIN.
 * Hata durumunda kısmi kayıtları geri alır. Hem kayıt onayı hem admin formu kullanır.
 */
export async function provisionBrandTenant(
  input: ProvisionBrandInput
): Promise<ProvisionBrandResult> {
  const admin = getSupabaseAdmin();
  const slugBase = toSlug(input.shortName || input.brandName);
  const brandId = await uniqueBrandId(slugBase);
  const usernameBase = input.preferredUsername?.replace(/[^a-z0-9]+/g, "") || slugBase;
  const username = await uniqueUsername(usernameBase);
  const userId = `u-brand-${slugBase}`.slice(0, 48);
  const plainPin = input.customPin?.trim() || generateServerPin();
  const now = new Date().toISOString();

  const orgSlug = await uniqueOrgSlug(slugBase);
  const orgId = `org-${orgSlug}`.slice(0, 48);
  const organization: Organization = {
    id: orgId,
    name: input.brandName,
    slug: orgSlug,
    type: "brand",
    status: "active",
    plan: "starter",
    primaryColor: "#FF6B00",
    locale: "tr",
    timezone: "Europe/Istanbul",
    defaultCurrency: "USD",
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    onboardingCompleted: false,
    createdFromRequestId: input.createdFromRequestId,
    createdAt: now,
    updatedAt: now,
  };
  const { error: orgErr } = await admin.from("organizations").insert(organizationToRow(organization));
  if (orgErr) throw new Error(`organizations: ${orgErr.message}`);

  const brand: Brand = {
    id: brandId,
    name: input.brandName,
    shortName: input.shortName || input.brandName.slice(0, 12),
    category: input.category ?? "Diğer",
    status: "active",
    notes: input.notes ?? "",
    organizationId: orgId,
  };
  const brandRow = {
    ...brandToRow(brand),
    created_from_request_id: input.createdFromRequestId ?? null,
  };
  const { error: brandErr } = await admin.from("brands").insert(brandRow);
  if (brandErr) {
    await admin.from("organizations").delete().eq("id", orgId);
    throw new Error(`brands: ${brandErr.message}`);
  }

  const user: AppUser = {
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
    await upsertAppUser(user, plainPin);
  } catch (e) {
    await admin.from("brands").delete().eq("id", brandId);
    await admin.from("organizations").delete().eq("id", orgId);
    throw e;
  }

  const memberId = `om-${userId}`.slice(0, 48);
  try {
    const member: OrganizationMember = {
      id: memberId,
      organizationId: orgId,
      userId,
      orgRole: "owner",
      scopeAllBrands: false,
      title: "Marka sahibi",
      createdAt: now,
      updatedAt: now,
    };
    await admin.from("organization_members").insert(organizationMemberToRow(member));
    await admin.from("organization_member_brands").insert({ member_id: memberId, brand_id: brandId });
  } catch {
    /* üyelik bağı best-effort; brand_id session üzerinden yine çalışır */
  }

  return { organization, brand, user, memberId, plainPin };
}
