import type { AppUser } from "@/store/auth";

/** WhatsApp / e-posta ile paylaşım için düz metin giriş bilgisi. */
export function formatLoginCredentials(
  user: Pick<AppUser, "name" | "username">,
  pin: string,
  loginUrl?: string,
): string {
  const url =
    loginUrl ??
    (typeof window !== "undefined" ? `${window.location.origin}/login` : "");
  const lines = [
    "Foxstream — Giriş bilgileri",
    "",
    `İsim: ${user.name}`,
    `Kullanıcı adı: ${user.username}`,
    `Şifre (PIN): ${pin}`,
  ];
  if (url) lines.push("", `Giriş: ${url}`);
  return lines.join("\n");
}

export async function copyLoginCredentials(
  user: Pick<AppUser, "name" | "username">,
  pin: string,
): Promise<void> {
  await navigator.clipboard.writeText(formatLoginCredentials(user, pin));
}
