import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashPin, verifyPin } from "@/lib/password";
import { validatePlainPin } from "@/lib/pin-update";
import type { AppUser } from "@/store/auth";

async function findExistingRow(user: AppUser): Promise<{ id: string; pin_hash: string } | null> {
  const admin = getSupabaseAdmin();
  const { data: byId, error: idErr } = await admin
    .from("app_users")
    .select("id, pin_hash")
    .eq("id", user.id)
    .maybeSingle();
  if (idErr) throw new Error(idErr.message);
  if (byId) return { id: String(byId.id), pin_hash: String(byId.pin_hash) };

  const un = user.username.toLowerCase().trim();
  const { data: byName, error: nameErr } = await admin
    .from("app_users")
    .select("id, pin_hash")
    .eq("username", un)
    .maybeSingle();
  if (nameErr) throw new Error(nameErr.message);
  if (byName) return { id: String(byName.id), pin_hash: String(byName.pin_hash) };
  return null;
}

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

  const existing = await findExistingRow(user);

  if (existing) {
    const rowId = existing.id;
    const updatePayload: Record<string, unknown> = profileFields(user);
    if (plain) {
      const pinHash = await hashPin(plain);
      const selfCheck = await verifyPin(plain, pinHash);
      if (!selfCheck) {
        throw new Error("PIN hash oluşturulamadı — tekrar deneyin.");
      }
      updatePayload.pin_hash = pinHash;
      updatePayload.pin_updated_at = new Date().toISOString();
    }
    const { error } = await getSupabaseAdmin()
      .from("app_users")
      .update(updatePayload)
      .eq("id", rowId);
    if (error) throw new Error(error.message);

    if (plain) {
      const { data: saved, error: readErr } = await getSupabaseAdmin()
        .from("app_users")
        .select("pin_hash")
        .eq("id", rowId)
        .maybeSingle();
      if (readErr || !saved) {
        throw new Error("PIN kaydı doğrulanamadı — tekrar deneyin.");
      }
      const ok = await verifyPin(plain, String(saved.pin_hash));
      if (!ok) {
        throw new Error("PIN sunucuya yazıldı ancak giriş doğrulaması başarısız — tekrar kaydedin.");
      }
    }
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
