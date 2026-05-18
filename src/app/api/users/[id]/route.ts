import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { upsertAppUser, deleteAppUser, fetchUsers } from "@/lib/db/repository";
import { canApplyUserPatch, canDeleteUser } from "@/lib/user-guards";
import type { AppUser } from "@/store/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  const patch = (await req.json()) as Partial<AppUser> & { newPin?: string };
  const users = await fetchUsers();
  const prev = users.find((u) => u.id === id);
  if (!prev) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  const guard = canApplyUserPatch(users, id, patch);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }
  const next: AppUser = {
    ...prev,
    ...patch,
    id,
    pin: "",
    username: patch.username ? patch.username.toLowerCase().trim() : prev.username,
  };
  await upsertAppUser(next, patch.newPin);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  const users = await fetchUsers();
  const guard = canDeleteUser(users, id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }
  await deleteAppUser(id);
  return NextResponse.json({ ok: true });
}
