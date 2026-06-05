import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId, writeAudit } from "@/lib/org-access";
import {
  deleteBrandIgamingTask,
  fetchBrandIgamingTasks,
  upsertBrandIgamingTask,
} from "@/lib/db/brand-igaming-repo";
import type { BrandIgamingTask } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ tasks: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const tasks = await fetchBrandIgamingTasks(brandId);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<BrandIgamingTask> | null;
  if (!body) return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  const brandId = resolveBrandId(session, String(body.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && body.id.startsWith("bt-"));
  const task: BrandIgamingTask = {
    id: isNew ? `bt-${crypto.randomUUID().slice(0, 10)}` : body.id!,
    brandId,
    title,
    description: body.description ?? "",
    assigneeUserId: body.assigneeUserId || undefined,
    staffId: body.staffId || undefined,
    dueDate: body.dueDate || undefined,
    status: body.status ?? "open",
    priority: body.priority ?? "normal",
    campaignId: body.campaignId || undefined,
  };
  const saved = await upsertBrandIgamingTask(task);
  await writeAudit(session, isNew ? "brand_task_created" : "brand_task_updated", `task=${saved.id}`);
  return NextResponse.json({ task: saved });
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await deleteBrandIgamingTask(id);
  return NextResponse.json({ ok: true });
}
