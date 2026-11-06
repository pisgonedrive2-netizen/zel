import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import {
  PRIM_POOL_LOCKED_KEY,
  normalizePrimPoolLocked,
} from "@/lib/prim-pool-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readLocked(): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", PRIM_POOL_LOCKED_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizePrimPoolLocked(data?.value);
}

export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: true, locked: false });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  try {
    const locked = await readLocked();
    return NextResponse.json({ ok: true, locked });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Okuma hatası" },
      { status: 500 }
    );
  }
}

/** POST { locked } — yalnızca ana yönetici (Orkun) prim havuzu kilidini değiştirir. */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json(
      { ok: false, error: "Yalnızca ana yönetici prim kilidini değiştirebilir" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { locked?: boolean };
  if (typeof body.locked !== "boolean") {
    return NextResponse.json({ ok: false, error: "locked boolean gerekli" }, { status: 400 });
  }

  try {
    const { error } = await getSupabaseAdmin().from("app_settings").upsert(
      {
        key: PRIM_POOL_LOCKED_KEY,
        value: body.locked,
        updated_by: session.userId,
      },
      { onConflict: "key" }
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, locked: body.locked });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Kayıt hatası" },
      { status: 500 }
    );
  }
}
