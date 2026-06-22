import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { taskFromRow, ONBOARDING_TEMPLATE, type TaskPriority, type TaskStatus, type TaskCategory } from "@/types/internal-task";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}

function addDaysIso(startIso: string, days: number): string {
  const d = new Date(startIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// GET — admin/auditor görev listesini görür.
export async function GET() {
  if (!isSupabaseEnabled()) return NextResponse.json({ tasks: [] });
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("internal_tasks")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: (data ?? []).map((r) => taskFromRow(r as Record<string, unknown>)) });
}

// POST — tek görev veya onboarding şablonu (toplu). Sadece admin yazabilir.
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Onboarding şablonu: yeni personel için takvimli görev seti üret.
  if (body.template === "onboarding") {
    const subjectName = String(body.subjectName ?? "").trim();
    if (!subjectName) {
      return NextResponse.json({ error: "subjectName zorunlu" }, { status: 400 });
    }
    const subjectEmployeeId = body.subjectEmployeeId ? String(body.subjectEmployeeId) : null;
    const startIso = body.startDate ? String(body.startDate) : now;
    const assigneeName = String(body.assigneeName ?? session.name);
    const assigneeEmployeeId = body.assigneeEmployeeId ? String(body.assigneeEmployeeId) : null;
    const rows = ONBOARDING_TEMPLATE.map((t, i) => ({
      id: newId("task"),
      title: `${subjectName}: ${t.title}`,
      description: t.description,
      status: "todo" as TaskStatus,
      priority: t.priority,
      category: "onboarding" as TaskCategory,
      assignee_employee_id: assigneeEmployeeId,
      assignee_name: assigneeName,
      subject_employee_id: subjectEmployeeId,
      subject_name: subjectName,
      created_by: session.userId,
      created_by_name: session.name,
      due_date: addDaysIso(startIso, t.offsetDays),
      order_index: i,
      created_at: now,
      updated_at: now,
    }));
    const { error } = await db.from("internal_tasks").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: rows.length });
  }

  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title zorunlu" }, { status: 400 });
  const row = {
    id: newId("task"),
    title,
    description: String(body.description ?? ""),
    status: (String(body.status ?? "todo") as TaskStatus),
    priority: (String(body.priority ?? "normal") as TaskPriority),
    category: (String(body.category ?? "general") as TaskCategory),
    assignee_employee_id: body.assigneeEmployeeId ? String(body.assigneeEmployeeId) : null,
    assignee_name: String(body.assigneeName ?? ""),
    subject_employee_id: body.subjectEmployeeId ? String(body.subjectEmployeeId) : null,
    subject_name: String(body.subjectName ?? ""),
    created_by: session.userId,
    created_by_name: session.name,
    due_date: body.dueDate ? String(body.dueDate) : null,
    order_index: Number(body.orderIndex ?? 0),
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await db.from("internal_tasks").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, task: taskFromRow(data as Record<string, unknown>) });
}
