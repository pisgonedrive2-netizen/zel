import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { employeeToRow, notificationToRow } from "@/lib/db/mappers";
import {
  findStreamerRegistrationRequestById,
  updateStreamerRegistrationRequest,
  upsertAppUser,
} from "@/lib/db/repository";
import type { AppNotification, Employee } from "@/store/store";
import type { AppUser } from "@/store/auth";

export const runtime = "nodejs";

function generateServerPin(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function toSlug(input: string, fallback = "yayinci"): string {
  const tr: Record<string, string> = {
    ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  };
  const lowered = input.split("").map((c) => tr[c] ?? c).join("").toLowerCase();
  const slug = lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug || fallback;
}

async function uniqueEmployeeId(base: string): Promise<string> {
  const baseId = `emp-${base}`;
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseId : `${baseId}-${i + 1}`;
    const { data, error } = await admin.from("employees").select("id").eq("id", candidate).maybeSingle();
    if (error) throw new Error(`employees check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseId}-${Date.now().toString(36)}`;
}

async function uniqueUsername(base: string): Promise<string> {
  const baseUn = base.replace(/[^a-z0-9]+/g, "").slice(0, 24) || "yayinci";
  const admin = getSupabaseAdmin();
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? baseUn : `${baseUn}${i + 1}`;
    const { data, error } = await admin.from("app_users").select("id").eq("username", candidate).maybeSingle();
    if (error) throw new Error(`app_users check: ${error.message}`);
    if (!data) return candidate;
  }
  return `${baseUn}${Date.now().toString(36)}`;
}

async function insertNotification(notif: AppNotification): Promise<void> {
  const { error } = await getSupabaseAdmin().from("app_notifications").insert(notificationToRow(notif));
  if (!error) return;
  const isEnum = error.message.includes("enum") || error.message.includes("invalid input value");
  if (isEnum) {
    await getSupabaseAdmin().from("app_notifications").insert(notificationToRow({ ...notif, type: "general" }));
    return;
  }
  throw new Error(error.message);
}

type ApproveBody = { usernameOverride?: string; customPin?: string };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Başvuru id zorunlu." }, { status: 400 });
  }

  // Gövde opsiyonel: boş gövde / geçersiz JSON tolere edilir.
  const body = (await req.json().catch(() => ({}))) as ApproveBody;
  const usernameOverride = body.usernameOverride?.trim().toLowerCase() || undefined;
  const customPin = body.customPin?.trim() || undefined;

  try {
    const reqRow = await findStreamerRegistrationRequestById(id);
    if (!reqRow) {
      return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
    }
    if (reqRow.status === "approved") {
      return NextResponse.json({ error: "Bu başvuru zaten onaylanmış." }, { status: 409 });
    }
    if (reqRow.status === "rejected") {
      return NextResponse.json({ error: "Reddedilmiş bir başvuru onaylanamaz." }, { status: 409 });
    }

    const slugBase = toSlug(reqRow.displayName);
    const employeeId = await uniqueEmployeeId(slugBase);
    const usernameBase =
      usernameOverride?.replace(/[^a-z0-9]+/g, "") ||
      reqRow.preferredUsername?.replace(/[^a-z0-9]+/g, "") ||
      slugBase;
    const username = await uniqueUsername(usernameBase);
    const userId = `u-streamer-${slugBase}`.slice(0, 48);
    const plainPin = customPin || generateServerPin();
    const now = new Date().toISOString();
    const todayYm = now.slice(0, 7);
    const todayDate = now.slice(0, 10);

    // 1) Employee (kind=streamer)
    const employee: Employee = {
      id: employeeId,
      name: reqRow.realName?.trim() || reqRow.displayName,
      role: "Yayıncı",
      department: "Yayın",
      baseSalary: 0,
      rentSupport: 0,
      initialAdvance: 0,
      paymentDay: "1-5",
      payrollStartMonth: todayYm,
      startDate: todayDate,
      status: "active",
      walletAddress: "",
      avatar: reqRow.displayName.slice(0, 1).toUpperCase() || "Y",
      notes: reqRow.notes,
      kind: "streamer",
    };
    const { error: empErr } = await getSupabaseAdmin().from("employees").insert(employeeToRow(employee));
    if (empErr) {
      return NextResponse.json({ error: `employees: ${empErr.message}` }, { status: 500 });
    }

    // 2) app_user (role=streamer)
    const newUser: AppUser = {
      id: userId,
      username,
      pin: "",
      name: reqRow.displayName,
      role: "streamer",
      employeeId,
      avatar: employee.avatar,
      active: true,
    };
    try {
      await upsertAppUser(newUser, plainPin);
    } catch (e) {
      await getSupabaseAdmin().from("employees").delete().eq("id", employeeId);
      throw e;
    }

    // 3) Draft havuz profili
    try {
      const categories = reqRow.categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await getSupabaseAdmin().from("streamer_pool_profiles").insert({
        id: `spp-${crypto.randomUUID().slice(0, 12)}`,
        employee_id: employeeId,
        display_name: reqRow.displayName,
        headline: "",
        bio: reqRow.notes,
        categories,
        languages: ["tr"],
        countries: ["TR"],
        rate_currency: "USD",
        status: "draft",
        visibility: "public",
      });
    } catch {
      /* havuz profili best-effort (modül hazır değilse atla) */
    }

    const updated = await updateStreamerRegistrationRequest(reqRow.id, {
      status: "approved",
      reviewedBy: session.userId,
      reviewedAt: now,
      createdEmployeeId: employeeId,
      createdUserId: userId,
    });

    try {
      await getSupabaseAdmin().from("audit_logs").insert({
        actor_id: session.userId,
        actor_name: session.name,
        action: "streamer_registration_approved",
        detail: `${reqRow.displayName} → employee=${employeeId}, user=${userId} (req=${reqRow.id})`,
      });
    } catch {
      /* audit opsiyonel */
    }

    try {
      const welcome: AppNotification = {
        id: `n-${crypto.randomUUID().slice(0, 12)}`,
        type: "general",
        title: `Foxstream'e hoş geldin — ${reqRow.displayName}`,
        message: [
          "Yayıncı kaydın onaylandı. Aşağıdaki bilgilerle giriş yapabilirsin.",
          `Kullanıcı adı: ${username}`,
          "PIN: yöneticinin paylaştığı tek seferlik PIN (giriş sonrası değiştir).",
          "Girişten sonra Havuz Profilim'i tamamlamayı unutma.",
        ].join("\n"),
        forRole: "streamer",
        forUserId: userId,
        refId: reqRow.id,
        triggeredBy: session.userId,
        createdAt: now,
        read: false,
        href: "/yayinci/onboarding",
      };
      await insertNotification(welcome);
    } catch {
      /* bildirim opsiyonel */
    }

    return NextResponse.json({
      ok: true,
      request: updated,
      employee: { id: employee.id, name: employee.name },
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        employeeId: newUser.employeeId,
        avatar: newUser.avatar,
        active: newUser.active,
      },
      plainPin,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onay sırasında hata.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
