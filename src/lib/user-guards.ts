import type { AppUser, Role } from "@/store/auth";

/**
 * Ana yönetici (kurucu) hesabının kimliği ve kullanıcı adı.
 * Bu hesap hiçbir koşulda silinemez, pasifleştirilemez, rolü düşürülemez,
 * kullanıcı adı değiştirilemez. Yetkisini diğer yöneticiler kullanabilir
 * ancak hesabın kendisi korunur.
 */
export const MAIN_ADMIN_ID = "u-admin";
export const MAIN_ADMIN_USERNAME = "orkun";

/** "orkun" kullanıcı adı veya "u-admin" id'li hesap ana yöneticidir. */
export function isMainAdmin(u: Pick<AppUser, "id" | "username"> | null | undefined): boolean {
  if (!u) return false;
  return u.id === MAIN_ADMIN_ID || u.username.toLowerCase().trim() === MAIN_ADMIN_USERNAME;
}

function countActiveRole(users: AppUser[], role: Role): number {
  return users.filter((u) => u.role === role && u.active).length;
}

/** Silme: ana yönetici asla silinemez; son aktif yönetici/denetçi de silinemez. */
export function canDeleteUser(
  users: AppUser[],
  id: string
): { ok: true } | { ok: false; reason: string } {
  const u = users.find((x) => x.id === id);
  if (!u) return { ok: false, reason: "Kullanıcı bulunamadı." };
  if (isMainAdmin(u)) {
    return { ok: false, reason: "Ana yönetici hesabı silinemez." };
  }
  if (u.role === "admin" && u.active && countActiveRole(users, "admin") <= 1) {
    return { ok: false, reason: "Son aktif yönetici hesabı silinemez." };
  }
  if (u.role === "auditor" && u.active && countActiveRole(users, "auditor") <= 1) {
    return { ok: false, reason: "Son aktif denetçi hesabı silinemez." };
  }
  return { ok: true };
}

/**
 * Güncelleme: ana yönetici hesabının kritik alanları kilitli; ayrıca son aktif
 * yöneticiyi/denetçiyi pasifleştirme veya rol düşürme engellenir.
 */
export function canApplyUserPatch(
  users: AppUser[],
  id: string,
  patch: Partial<AppUser>
): { ok: true } | { ok: false; reason: string } {
  const u = users.find((x) => x.id === id);
  if (!u) return { ok: false, reason: "Kullanıcı bulunamadı." };

  const nextActive = patch.active !== undefined ? patch.active : u.active;
  const nextRole = patch.role !== undefined ? patch.role : u.role;
  const nextUsername = patch.username !== undefined ? patch.username : u.username;

  if (isMainAdmin(u)) {
    if (nextActive === false) {
      return { ok: false, reason: "Ana yönetici pasifleştirilemez." };
    }
    if (nextRole !== "admin") {
      return { ok: false, reason: "Ana yöneticinin rolü değiştirilemez." };
    }
    if (nextUsername.toLowerCase().trim() !== MAIN_ADMIN_USERNAME) {
      return { ok: false, reason: "Ana yöneticinin kullanıcı adı değiştirilemez." };
    }
  }

  if (u.role === "admin" && u.active && nextActive === false) {
    if (countActiveRole(users, "admin") <= 1) {
      return { ok: false, reason: "Son aktif yönetici pasifleştirilemez." };
    }
  }
  if (u.role === "auditor" && u.active && nextActive === false) {
    if (countActiveRole(users, "auditor") <= 1) {
      return { ok: false, reason: "Son aktif denetçi pasifleştirilemez." };
    }
  }

  if (u.role === "admin" && u.active && nextRole !== "admin") {
    if (countActiveRole(users, "admin") <= 1) {
      return { ok: false, reason: "Son aktif yöneticinin rolü değiştirilemez." };
    }
  }
  if (u.role === "auditor" && u.active && nextRole !== "auditor") {
    if (countActiveRole(users, "auditor") <= 1) {
      return { ok: false, reason: "Son aktif denetçinin rolü değiştirilemez." };
    }
  }

  return { ok: true };
}
