import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess,
  resolveBrandId,
  accessibleBrandIds,
  hasOrgCapability,
  writeAudit,
} from "@/lib/org-access";
import {
  fetchBrandTasks,
  fetchBrandShifts,
  fetchBrandStaff,
  upsertBrandTask,
  upsertBrandShift,
  deleteBrandTask,
  deleteBrandShift,
  insertBrandActivity,
} from "@/lib/db/brand-personnel-repo";
import { notifyBrandTaskReminder } from "@/lib/task-notifications";
import type {
  BrandStaffShift,
  BrandStaffTask,
  TaskPriority,
  TaskStatus,
} from "@/types/brand-personnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASK_STATUS: readonly TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];
const TASK_PRIORITY: readonly TaskPriority[] = ["low", "medium", "high"];
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ tasks: [], shifts: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const ids =
    session.role === "brand"
      ? requested
        ? [requested]
        : accessibleBrandIds(session)
      : requested
        ? [requested]
        : [];
  try {
    const [tasks, shifts] = await Promise.all([
      fetchBrandTasks(ids),
      fetchBrandShifts(ids),
    ]);
    return NextResponse.json({ tasks, shifts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Takip verisi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Takip yönetimi yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | (Record<string, unknown> & { kind?: string })
    | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Toplu günlük görev ataması
  if (body.kind === "daily-bulk") {
    const dueDate = String(body.dueDate ?? today).trim() || today;
    const notify = body.notify !== false;
    const defaultStaffId = String(body.staffId ?? "").trim() || undefined;
    const lines = Array.isArray(body.lines)
      ? (body.lines as unknown[]).map((l) => String(l).trim()).filter(Boolean)
      : String(body.text ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
    if (lines.length === 0) {
      return NextResponse.json({ error: "En az bir görev satırı gerekli" }, { status: 400 });
    }
    const brandStaff = await fetchBrandStaff([brandId]);
    const created: BrandStaffTask[] = [];
    for (const line of lines) {
      let staffId = defaultStaffId;
      let title = line;
      const colon = line.indexOf(":");
      if (colon > 0 && colon < 28) {
        const maybeName = line.slice(0, colon).trim().toLowerCase();
        const match = brandStaff.find(
          (s) => s.name.toLowerCase() === maybeName || s.name.split(" ")[0].toLowerCase() === maybeName,
        );
        if (match) {
          staffId = match.id;
          title = line.slice(colon + 1).trim() || line;
        }
      }
      const task: BrandStaffTask = {
        id: `tk-${crypto.randomUUID().slice(0, 10)}`,
        brandId,
        staffId,
        title,
        description: "",
        status: "todo",
        priority: pick(body.priority, TASK_PRIORITY, "medium"),
        dueDate,
        createdAt: now,
        updatedAt: now,
      };
      const saved = await upsertBrandTask(task);
      created.push(saved);
      if (notify) {
        await notifyBrandTaskReminder({
          brandId,
          title: saved.title,
          dueDate,
          triggeredBy: session.userId,
        }).catch(() => undefined);
      }
    }
    await writeAudit(session, "brand_task_created", `daily-bulk ${created.length} görev brand=${brandId}`);
    return NextResponse.json({ ok: true, created: created.length, tasks: created });
  }

  if (body.kind === "shift") {
    const staffId = String(body.staffId ?? "").trim();
    const shiftDate = String(body.shiftDate ?? "").trim();
    if (!staffId || !shiftDate) {
      return NextResponse.json({ error: "staffId ve shiftDate gerekli" }, { status: 400 });
    }
    const isNew = !(typeof body.id === "string" && /^sh-/.test(body.id as string));
    const shift: BrandStaffShift = {
      id: isNew ? `sh-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
      brandId,
      staffId,
      shiftDate,
      startTime: String(body.startTime ?? "09:00"),
      endTime: String(body.endTime ?? "18:00"),
      note: String(body.note ?? ""),
      createdAt: (body.createdAt as string) ?? now,
      updatedAt: now,
    };
    try {
      const saved = await upsertBrandShift(shift);
      await writeAudit(session, isNew ? "brand_shift_created" : "brand_shift_updated", `shift=${saved.id} brand=${brandId}`);
      return NextResponse.json({ shift: saved });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Vardiya kaydedilemedi";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // default: task
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title gerekli" }, { status: 400 });
  const isNew = !(typeof body.id === "string" && /^tk-/.test(body.id as string));
  const task: BrandStaffTask = {
    id: isNew ? `tk-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
    brandId,
    staffId: String(body.staffId ?? "").trim() || undefined,
    title,
    description: String(body.description ?? ""),
    status: pick(body.status, TASK_STATUS, "todo"),
    priority: pick(body.priority, TASK_PRIORITY, "medium"),
    dueDate: String(body.dueDate ?? "").trim() || undefined,
    createdAt: (body.createdAt as string) ?? now,
    updatedAt: now,
  };
  try {
    const saved = await upsertBrandTask(task);
    await insertBrandActivity({
      brandId,
      staffId: saved.staffId,
      actorUserId: session.userId,
      actorName: session.name,
      type: isNew ? "task_created" : "task_updated",
      detail: `${saved.title} (${saved.status})`,
    }).catch(() => {});
    await writeAudit(session, isNew ? "brand_task_created" : "brand_task_updated", `task=${saved.id} brand=${brandId}`);
    return NextResponse.json({ task: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Görev kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "hr")) {
    return NextResponse.json({ error: "Silme yetkisi yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "task";
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    if (kind === "shift") await deleteBrandShift(id);
    else await deleteBrandTask(id);
    await writeAudit(session, kind === "shift" ? "brand_shift_deleted" : "brand_task_deleted", `id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
