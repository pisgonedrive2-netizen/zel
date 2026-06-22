import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { taskFromRow } from "@/types/internal-task";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.status === "string") {
    patch.status = body.status;
    patch.done_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (typeof body.priority === "string") patch.priority = body.priority;
  if ("assigneeEmployeeId" in body) patch.assignee_employee_id = body.assigneeEmployeeId ? String(body.assigneeEmployeeId) : null;
  if (typeof body.assigneeName === "string") patch.assignee_name = body.assigneeName;
  if ("dueDate" in body) patch.due_date = body.dueDate ? String(body.dueDate) : null;
  if (typeof body.orderIndex === "number") patch.order_index = body.orderIndex;

  const { data, error } = await getSupabaseAdmin()
    .from("internal_tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, task: taskFromRow(data as Record<string, unknown>) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const { id } = await params;
  const { error } = await getSupabaseAdmin().from("internal_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
