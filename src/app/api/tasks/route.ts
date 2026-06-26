import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import {
  taskFromRow,
  ONBOARDING_TEMPLATE,
  type TaskPriority,
  type TaskStatus,
  type TaskCategory,
  type DailyTaskItem,
} from "@/types/internal-task";
import { notifyStreamerTaskReminder } from "@/lib/task-notifications";

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function assertEmployeeActive(employeeId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("employees")
    .select("status, name")
    .eq("id", employeeId)
    .maybeSingle();
  if (!data) return null;
  if (String(data.status) === "inactive") {
    return `${String(data.name)} işten ayrılmış — onboarding veya yeni görev atanamaz.`;
  }
  return null;
}

// GET — admin/auditor görev listesini görür. ?hideExited=1 pasif personel onboarding'ini gizler.
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ tasks: [] });
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const hideExited = req.nextUrl.searchParams.get("hideExited") === "1";
  const { data, error } = await getSupabaseAdmin()
    .from("internal_tasks")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let tasks = (data ?? []).map((r) => taskFromRow(r as Record<string, unknown>));

  if (hideExited) {
    const { data: inactive } = await getSupabaseAdmin()
      .from("employees")
      .select("id, name")
      .eq("status", "inactive");
    const inactiveIds = new Set((inactive ?? []).map((e) => String(e.id)));
    const inactiveNames = new Set((inactive ?? []).map((e) => String(e.name).toLowerCase()));
    tasks = tasks.filter((t) => {
      if (t.subjectEmployeeId && inactiveIds.has(t.subjectEmployeeId)) return false;
      if (t.category === "onboarding" && t.subjectName) {
        const prefix = t.title.split(":")[0]?.trim().toLowerCase();
        if (inactiveNames.has(prefix)) return false;
      }
      return true;
    });
  }

  return NextResponse.json({ tasks });
}

// POST — tek görev, onboarding, günlük plan veya temizlik. Sadece admin yazabilir.
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

  // İşten ayrılan personelin bekleyen onboarding görevlerini temizle.
  if (body.template === "cleanup-exited") {
    const { data: inactive } = await db.from("employees").select("id, name").eq("status", "inactive");
    const ids = (inactive ?? []).map((e) => String(e.id));
    let deleted = 0;
    if (ids.length > 0) {
      const { data: removed } = await db
        .from("internal_tasks")
        .delete()
        .in("subject_employee_id", ids)
        .neq("status", "done")
        .select("id");
      deleted += removed?.length ?? 0;
    }
    for (const row of inactive ?? []) {
      const name = String(row.name);
      const { data: removed } = await db
        .from("internal_tasks")
        .delete()
        .ilike("title", `${name}:%`)
        .eq("category", "onboarding")
        .neq("status", "done")
        .select("id");
      deleted += removed?.length ?? 0;
    }
    return NextResponse.json({ ok: true, deleted });
  }

  // Günlük plan — bugün (veya seçilen gün) için toplu görev + isteğe bağlı bildirim.
  if (body.template === "daily") {
    const dueDate = body.dueDate ? String(body.dueDate) : todayIso();
    const notify = body.notify !== false;
    const items = Array.isArray(body.items) ? (body.items as DailyTaskItem[]) : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "items dizisi boş" }, { status: 400 });
    }
    const rows = items.map((item, i) => ({
      id: newId("task"),
      title: String(item.title ?? "").trim(),
      description: String(item.description ?? ""),
      status: "todo" as TaskStatus,
      priority: (item.priority ?? "normal") as TaskPriority,
      category: "daily" as TaskCategory,
      assignee_employee_id: item.assigneeEmployeeId ? String(item.assigneeEmployeeId) : null,
      assignee_name: String(item.assigneeName ?? ""),
      subject_employee_id: null,
      subject_name: "",
      created_by: session.userId,
      created_by_name: session.name,
      due_date: dueDate,
      order_index: i,
      created_at: now,
      updated_at: now,
    })).filter((r) => r.title);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Geçerli görev başlığı yok" }, { status: 400 });
    }

    const { error } = await db.from("internal_tasks").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let notified = 0;
    if (notify) {
      for (const row of rows) {
        if (!row.assignee_employee_id) continue;
        const sent = await notifyStreamerTaskReminder({
          assigneeEmployeeId: row.assignee_employee_id,
          title: row.title,
          dueDate,
          triggeredBy: session.userId,
        });
        if (sent) notified++;
      }
    }

    return NextResponse.json({ ok: true, created: rows.length, notified, dueDate });
  }

  // Onboarding şablonu: yeni personel için takvimli görev seti üret.
  if (body.template === "onboarding") {
    const subjectName = String(body.subjectName ?? "").trim();
    if (!subjectName) {
      return NextResponse.json({ error: "subjectName zorunlu" }, { status: 400 });
    }
    const subjectEmployeeId = body.subjectEmployeeId ? String(body.subjectEmployeeId) : null;
    if (subjectEmployeeId) {
      const blocked = await assertEmployeeActive(subjectEmployeeId);
      if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    }
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
  const assigneeEmployeeId = body.assigneeEmployeeId ? String(body.assigneeEmployeeId) : null;
  if (assigneeEmployeeId) {
    const blocked = await assertEmployeeActive(assigneeEmployeeId);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
  }
  const row = {
    id: newId("task"),
    title,
    description: String(body.description ?? ""),
    status: (String(body.status ?? "todo") as TaskStatus),
    priority: (String(body.priority ?? "normal") as TaskPriority),
    category: (String(body.category ?? "general") as TaskCategory),
    assignee_employee_id: assigneeEmployeeId,
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

  if (body.notify === true && assigneeEmployeeId) {
    await notifyStreamerTaskReminder({
      assigneeEmployeeId,
      title,
      dueDate: row.due_date,
      triggeredBy: session.userId,
    });
  }

  return NextResponse.json({ ok: true, task: taskFromRow(data as Record<string, unknown>) });
}
