import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession, setSessionCookie, type SessionPayload } from "@/lib/session";
import { buildSessionForUserId } from "@/lib/db/repository";
import { isMainAdminSession, MAIN_ADMIN_ID } from "@/lib/user-guards";
import { writeAudit } from "@/lib/org-access";

function userFromSession(session: SessionPayload) {
  return {
    id: session.userId,
    username: session.username,
    name: session.name,
    role: session.role,
    employeeId: session.employeeId,
    brandId: session.brandId,
    organizationId: session.organizationId,
    orgRole: session.orgRole,
    brandIds: session.brandIds,
    avatar: session.avatar,
    pin: "",
    active: true,
    impersonatorId: session.impersonatorId,
    impersonatorName: session.impersonatorName,
  };
}

/**
 * Ana yönetici (Orkun) bir kullanıcının hesabına "denetim için" girer.
 * Oturum çerezi hedef kullanıcıya geçirilir; asıl yöneticinin kimliği
 * impersonatorId olarak gömülür, böylece tek tıkla geri dönülebilir ve
 * işlem audit log'a yazılır. Pasif/yönetici hesaplar dahil herkese girilebilir.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  // Kontrolü elinde tutan kişi: zaten impersonate ediliyorsa asıl yönetici,
  // değilse oturum sahibi. Yalnızca ana yönetici hesaba girebilir.
  const controllerId = session.impersonatorId ?? session.userId;
  const controllerName = session.impersonatorName ?? session.name;
  const controllerIsMainAdmin =
    isMainAdminSession(session) || session.impersonatorId === MAIN_ADMIN_ID;
  if (!controllerIsMainAdmin) {
    return NextResponse.json(
      { error: "Bu işlem yalnızca ana yöneticiye açıktır." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const targetId = body.userId?.trim() ?? "";
  if (!targetId) {
    return NextResponse.json({ error: "Hedef kullanıcı gerekli" }, { status: 400 });
  }

  // Kendine girmek = denetimden çık.
  if (targetId === controllerId) {
    const original = await buildSessionForUserId(controllerId);
    if (!original) {
      return NextResponse.json({ error: "Yönetici hesabı bulunamadı" }, { status: 404 });
    }
    await setSessionCookie(original);
    return NextResponse.json({ user: userFromSession(original) });
  }

  let target: SessionPayload | null;
  try {
    target = await buildSessionForUserId(targetId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hesap yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  const impersonated: SessionPayload = {
    ...target,
    impersonatorId: controllerId,
    impersonatorName: controllerName,
  };
  await setSessionCookie(impersonated);

  await writeAudit(
    { ...session, userId: controllerId, name: controllerName },
    "user_impersonated",
    `${target.name} (@${target.username}) hesabına denetim için girildi`
  );

  return NextResponse.json({ user: userFromSession(impersonated) });
}

/** Denetimden çık — asıl yönetici hesabına geri dön. */
export async function DELETE() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }
  if (!session.impersonatorId) {
    return NextResponse.json({ error: "Zaten kendi hesabınızdasınız" }, { status: 400 });
  }
  const original = await buildSessionForUserId(session.impersonatorId);
  if (!original) {
    return NextResponse.json({ error: "Yönetici hesabı bulunamadı" }, { status: 404 });
  }
  await setSessionCookie(original);

  await writeAudit(
    original,
    "user_impersonation_stopped",
    `${session.name} (@${session.username}) denetiminden çıkıldı`
  );

  return NextResponse.json({ user: userFromSession(original) });
}
