import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BrandStaff,
  BrandStaffActivity,
  BrandStaffShift,
  BrandStaffTask,
  StaffCurrency,
  StaffStatus,
  TaskPriority,
  TaskStatus,
} from "@/types/brand-personnel";

const str = (v: unknown, d = ""): string => (v == null ? d : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

const STATUS: readonly StaffStatus[] = ["active", "passive", "invited"];
const CURRENCY: readonly StaffCurrency[] = ["USD", "EUR", "TRY"];
const TASK_STATUS: readonly TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];
const TASK_PRIORITY: readonly TaskPriority[] = ["low", "medium", "high"];

// ── Staff ──────────────────────────────────────────────────────────────────
function staffFromRow(r: Record<string, unknown>): BrandStaff {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    name: str(r.name),
    role: str(r.role),
    email: r.email ? str(r.email) : undefined,
    phone: r.phone ? str(r.phone) : undefined,
    status: pick(r.status, STATUS, "active"),
    monthlyCost: num(r.monthly_cost),
    currency: pick(r.currency, CURRENCY, "USD"),
    avatar: str(r.avatar),
    notes: str(r.notes),
    // Aşağıdaki kolonlar migration uygulanmadan önce mevcut olmayabilir → 0/undefined.
    departmentId: r.department_id ? str(r.department_id) : undefined,
    baseSalary: num(r.base_salary),
    rentSupport: num(r.rent_support),
    mealAllowance: num(r.meal_allowance),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function staffToRow(s: BrandStaff) {
  return {
    id: s.id,
    brand_id: s.brandId,
    name: s.name,
    role: s.role,
    email: s.email ?? null,
    phone: s.phone ?? null,
    status: s.status,
    monthly_cost: s.monthlyCost,
    currency: s.currency,
    avatar: s.avatar,
    notes: s.notes,
    department_id: s.departmentId ?? null,
    base_salary: s.baseSalary ?? 0,
    rent_support: s.rentSupport ?? 0,
    meal_allowance: s.mealAllowance ?? 0,
  };
}
// Migration uygulanmadan önce yeni kolonlar olmayabilir; bu durumda geriye dönük
// uyum için yalnızca eski kolonlarla yazarız.
function staffToLegacyRow(s: BrandStaff) {
  const { department_id, base_salary, rent_support, meal_allowance, ...legacy } = staffToRow(s);
  void department_id; void base_salary; void rent_support; void meal_allowance;
  return legacy;
}
function isMissingColumnError(message: string): boolean {
  return /column .* does not exist|could not find the .* column|schema cache/i.test(message);
}

export async function fetchBrandStaff(brandIds: string[]): Promise<BrandStaff[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_staff")
    .select("*")
    .in("brand_id", brandIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`brand_staff: ${error.message}`);
  return (data ?? []).map((r) => staffFromRow(r as Record<string, unknown>));
}

export async function findBrandStaffById(id: string): Promise<BrandStaff | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_staff")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_staff: ${error.message}`);
  return data ? staffFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandStaff(s: BrandStaff): Promise<BrandStaff> {
  const admin = getSupabaseAdmin();
  let { data, error } = await admin
    .from("brand_staff")
    .upsert(staffToRow(s), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  // Yeni kolonlar (department_id/base_salary/...) henüz eklenmemişse eski şemayla tekrar dene.
  if (error && isMissingColumnError(error.message)) {
    ({ data, error } = await admin
      .from("brand_staff")
      .upsert(staffToLegacyRow(s), { onConflict: "id" })
      .select("*")
      .maybeSingle());
  }
  if (error) throw new Error(`brand_staff: ${error.message}`);
  if (!data) throw new Error("brand_staff: upsert sonuç dönmedi.");
  return staffFromRow(data as Record<string, unknown>);
}

export async function deleteBrandStaff(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_staff").delete().eq("id", id);
  if (error) throw new Error(`brand_staff: ${error.message}`);
}

// ── Tasks ──────────────────────────────────────────────────────────────────
function taskFromRow(r: Record<string, unknown>): BrandStaffTask {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    staffId: r.staff_id ? str(r.staff_id) : undefined,
    title: str(r.title),
    description: str(r.description),
    status: pick(r.status, TASK_STATUS, "todo"),
    priority: pick(r.priority, TASK_PRIORITY, "medium"),
    dueDate: r.due_date ? str(r.due_date) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function taskToRow(t: BrandStaffTask) {
  return {
    id: t.id,
    brand_id: t.brandId,
    staff_id: t.staffId ?? null,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.dueDate ?? null,
  };
}

export async function fetchBrandTasks(brandIds: string[]): Promise<BrandStaffTask[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_staff_tasks")
    .select("*")
    .in("brand_id", brandIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`brand_staff_tasks: ${error.message}`);
  return (data ?? []).map((r) => taskFromRow(r as Record<string, unknown>));
}

export async function upsertBrandTask(t: BrandStaffTask): Promise<BrandStaffTask> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_staff_tasks")
    .upsert(taskToRow(t), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_staff_tasks: ${error.message}`);
  if (!data) throw new Error("brand_staff_tasks: upsert sonuç dönmedi.");
  return taskFromRow(data as Record<string, unknown>);
}

export async function deleteBrandTask(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_staff_tasks").delete().eq("id", id);
  if (error) throw new Error(`brand_staff_tasks: ${error.message}`);
}

// ── Shifts ─────────────────────────────────────────────────────────────────
function shiftFromRow(r: Record<string, unknown>): BrandStaffShift {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    staffId: str(r.staff_id),
    shiftDate: str(r.shift_date),
    startTime: str(r.start_time, "09:00"),
    endTime: str(r.end_time, "18:00"),
    note: str(r.note),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function shiftToRow(s: BrandStaffShift) {
  return {
    id: s.id,
    brand_id: s.brandId,
    staff_id: s.staffId,
    shift_date: s.shiftDate,
    start_time: s.startTime,
    end_time: s.endTime,
    note: s.note,
  };
}

export async function fetchBrandShifts(brandIds: string[]): Promise<BrandStaffShift[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_staff_shifts")
    .select("*")
    .in("brand_id", brandIds)
    .order("shift_date", { ascending: true });
  if (error) throw new Error(`brand_staff_shifts: ${error.message}`);
  return (data ?? []).map((r) => shiftFromRow(r as Record<string, unknown>));
}

export async function upsertBrandShift(s: BrandStaffShift): Promise<BrandStaffShift> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_staff_shifts")
    .upsert(shiftToRow(s), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_staff_shifts: ${error.message}`);
  if (!data) throw new Error("brand_staff_shifts: upsert sonuç dönmedi.");
  return shiftFromRow(data as Record<string, unknown>);
}

export async function deleteBrandShift(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_staff_shifts").delete().eq("id", id);
  if (error) throw new Error(`brand_staff_shifts: ${error.message}`);
}

// ── Activity ───────────────────────────────────────────────────────────────
function activityFromRow(r: Record<string, unknown>): BrandStaffActivity {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    staffId: r.staff_id ? str(r.staff_id) : undefined,
    actorUserId: r.actor_user_id ? str(r.actor_user_id) : undefined,
    actorName: str(r.actor_name),
    type: str(r.type, "note"),
    detail: str(r.detail),
    createdAt: str(r.created_at),
  };
}

export async function fetchBrandActivity(
  brandIds: string[],
  staffId?: string
): Promise<BrandStaffActivity[]> {
  if (brandIds.length === 0) return [];
  let q = getSupabaseAdmin()
    .from("brand_staff_activity")
    .select("*")
    .in("brand_id", brandIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw new Error(`brand_staff_activity: ${error.message}`);
  return (data ?? []).map((r) => activityFromRow(r as Record<string, unknown>));
}

export async function insertBrandActivity(a: {
  brandId: string;
  staffId?: string;
  actorUserId?: string;
  actorName: string;
  type: string;
  detail: string;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_staff_activity").insert({
    id: `bsa-${crypto.randomUUID().slice(0, 12)}`,
    brand_id: a.brandId,
    staff_id: a.staffId ?? null,
    actor_user_id: a.actorUserId ?? null,
    actor_name: a.actorName,
    type: a.type,
    detail: a.detail,
  });
  if (error) throw new Error(`brand_staff_activity: ${error.message}`);
}
