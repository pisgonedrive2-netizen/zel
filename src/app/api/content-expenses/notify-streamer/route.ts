import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { notifyStreamerExpenseUpdate } from "@/lib/expense-notify";
import type { AppNotification } from "@/store/store";

export const runtime = "nodejs";

type Body = {
  expenseId: string;
  submittedBy: string;
  type: AppNotification["type"];
  title: string;
  message: string;
};

/** Admin/denetçi harcama kararı sonrası yayıncıya kalıcı bildirim. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.expenseId || !body.submittedBy || !body.title) {
    return NextResponse.json({ error: "Eksik alanlar" }, { status: 400 });
  }

  try {
    await notifyStreamerExpenseUpdate({
      expenseId: body.expenseId,
      forUserId: body.submittedBy,
      type: body.type,
      title: body.title,
      message: body.message,
      triggeredBy: session.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bildirim kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
