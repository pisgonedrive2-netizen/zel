import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { loginUser } from "@/lib/db/repository";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const body = (await req.json()) as { username?: string; pin?: string };
  const username = body.username?.trim() ?? "";
  const pin = body.pin ?? "";
  if (!username || !pin) {
    return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli" }, { status: 400 });
  }
  const session = await loginUser(username, pin);
  if (!session) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
  }
  await setSessionCookie(session);
  return NextResponse.json({
    user: {
      id: session.userId,
      username: session.username,
      name: session.name,
      role: session.role,
      employeeId: session.employeeId,
      brandId: session.brandId,
      avatar: session.avatar,
      pin: "",
      active: true,
    },
  });
}
