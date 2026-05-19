import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/password";
import { validatePlainPin } from "@/lib/pin-update";
import type { AppUser } from "@/store/auth";

function profileFields(user: AppUser) {
  return {
    username: user.username.toLowerCase().trim(),
    name: user.name,
    role: user.role,
    employee_id: user.employeeId ?? null,
    brand_id: user.brandId ?? null,
    avatar: user.avatar,
    active: user.active,
    last_login_at: user.lastLoginAt ?? null,
  };
}

/**
 * Kullanıcı kaydı — PIN hash yalnızca `pinPlain` verildiğinde güncellenir.
 * Mevcut kullanıcıda PIN yoksa hash'e dokunulmaz (deploy / profil kaydı güvenli).
 */
export async function upsertAppUser(user: AppUser, pinPlain?: string): Promise<void> {
  const plain = pinPlain ? validatePlainPin(pinPlain) : undefined;
  if (pinPlain?.trim() && !plain) {
    throw new Error("PIN en az 4 karakter olmalıdır.");
  }

  const { data: existing, error: selErr } = await getSupabaseAdmin()
    .from("app_users")
    .select("id, pin_hash")
    .eq("id", user.id)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existing) {
    const updatePayload: Record<string, unknown> = profileFields(user);
    if (plain) {
      updatePayload.pin_hash = await hashPin(plain);
      updatePayload.pin_updated_at = new Date().toISOString();
    }
    const { error } = await getSupabaseAdmin()
      .from("app_users")
      .update(updatePayload)
      .eq("id", user.id);
    if (error) throw new Error(error.message);
    return;
  }

  if (!plain) {
    throw new Error("Yeni kullanıcı için PIN zorunludur.");
  }

  const { error } = await getSupabaseAdmin().from("app_users").insert({
    id: user.id,
    ...profileFields(user),
    pin_hash: await hashPin(plain),
    pin_updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function appUserExists(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
