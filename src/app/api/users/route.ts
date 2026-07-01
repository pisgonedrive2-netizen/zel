import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { fetchUsers, upsertAppUser } from "@/lib/db/repository";
import type { AppUser } from "@/store/auth";
import { sanitizePermissions } from "@/lib/permissions";
import { isMainAdminSession } from "@/lib/user-guards";

/** GET /api/users — yalnızca yönetici (kullanıcı listesi senkronu). */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ users: [] });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const users = await fetchUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const body = (await req.json()) as Omit<AppUser, "id"> & { id?: string; pin?: string };
  if (!body.username || !body.pin) {
    return NextResponse.json({ error: "username ve pin gerekli" }, { status: 400 });
  }
  const id =
    typeof body.id === "string" && /^u-[a-z0-9-]+$/i.test(body.id)
      ? body.id
      : `u-${crypto.randomUUID().slice(0, 8)}`;
  const user: AppUser = {
    id,
    username: body.username.toLowerCase().trim(),
    pin: "",
    name: body.name,
    role: body.role,
    employeeId: body.employeeId,
    brandId: body.brandId,
    avatar: body.avatar ?? body.name.slice(0, 1).toUpperCase(),
    active: body.active ?? true,
    permissions: isMainAdminSession(session) ? sanitizePermissions(body.permissions) : undefined,
  };
  try {
    await upsertAppUser(user, body.pin);
    return NextResponse.json({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kullanıcı kaydedilemedi";
    console.error("POST /api/users:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
