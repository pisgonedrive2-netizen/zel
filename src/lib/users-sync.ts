import type { AppUser } from "@/store/auth";

/** Yedek içe aktarımından sonra kullanıcı listesini Supabase ile hizalar. */
export async function syncImportedUsersToServer(imported: AppUser[]): Promise<void> {
  const listRes = await fetch("/api/users", { credentials: "include" });
  if (!listRes.ok) {
    throw new Error(await listRes.text());
  }
  const { users: serverUsers } = (await listRes.json()) as { users?: AppUser[] };
  const onServer = serverUsers ?? [];
  const importedIds = new Set(imported.map((u) => u.id));

  for (const su of onServer) {
    if (!importedIds.has(su.id)) {
      const del = await fetch(`/api/users/${su.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!del.ok) {
        const err = (await del.json().catch(() => ({}))) as { error?: string };
        if (!String(err.error ?? "").includes("Ana yönetici")) {
          throw new Error(err.error ?? del.statusText);
        }
      }
    }
  }

  for (const u of imported) {
    const exists = onServer.some((s) => s.id === u.id);
    if (exists) {
      const body: Record<string, unknown> = {
        username: u.username,
        name: u.name,
        role: u.role,
        employeeId: u.role === "streamer" ? u.employeeId : undefined,
        brandId: u.role === "brand" ? u.brandId : undefined,
        avatar: u.avatar,
        active: u.active,
      };
      if (u.pin) body.newPin = u.pin;
      const patch = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!patch.ok) {
        throw new Error((await patch.json().catch(() => ({})) as { error?: string }).error ?? patch.statusText);
      }
    } else {
      if (!u.pin) {
        throw new Error(`${u.name}: yeni kullanıcı için yedekte PIN gerekli`);
      }
      const post = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: u.id,
          username: u.username,
          pin: u.pin,
          name: u.name,
          role: u.role,
          employeeId: u.role === "streamer" ? u.employeeId : undefined,
          brandId: u.role === "brand" ? u.brandId : undefined,
          avatar: u.avatar,
          active: u.active,
        }),
      });
      if (!post.ok) {
        throw new Error((await post.json().catch(() => ({})) as { error?: string }).error ?? post.statusText);
      }
    }
  }
}
