import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { ensureExpenseSubmittedNotifications } from "@/lib/expense-notify";

export const runtime = "nodejs";

type Body = {
  expenseId: string;
  employeeName: string;
  brandName: string;
  category: string;
  amountUsd: number;
  description: string;
  month: string;
};

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const session = await getSession();
  if (!session || session.role !== "streamer") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.expenseId || !body.employeeName) {
    return NextResponse.json({ error: "Eksik alanlar" }, { status: 400 });
  }

  try {
    await ensureExpenseSubmittedNotifications({
      expenseId: body.expenseId,
      employeeName: body.employeeName,
      brandName: body.brandName ?? "",
      category: body.category ?? "",
      amountUsd: Number(body.amountUsd) || 0,
      description: body.description ?? "",
      month: body.month ?? "",
      triggeredBy: session.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bildirim kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
