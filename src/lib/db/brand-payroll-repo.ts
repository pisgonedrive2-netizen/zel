import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BrandDepartment,
  BrandPayrollComponentPayment,
  BrandPayrollItem,
  PayrollComponentKey,
  PayrollItemType,
  StaffCurrency,
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

const CURRENCY: readonly StaffCurrency[] = ["USD", "EUR", "TRY"];
const PAYROLL_TYPES: readonly PayrollItemType[] = [
  "advance", "bonus", "deduction", "rent", "meal", "other",
];
const PAYROLL_COMPONENTS: readonly PayrollComponentKey[] = [
  "base_salary", "rent", "meal",
];

// ── Departments ──────────────────────────────────────────────────────────────
function departmentFromRow(r: Record<string, unknown>): BrandDepartment {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    name: str(r.name),
    description: str(r.description),
    leadStaffId: r.lead_staff_id ? str(r.lead_staff_id) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function departmentToRow(d: BrandDepartment) {
  return {
    id: d.id,
    brand_id: d.brandId,
    name: d.name,
    description: d.description,
    lead_staff_id: d.leadStaffId ?? null,
  };
}

export async function fetchBrandDepartments(brandIds: string[]): Promise<BrandDepartment[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("brand_departments")
    .select("*")
    .in("brand_id", brandIds)
    .order("name", { ascending: true });
  if (error) {
    // Migration uygulanmadıysa tablo olmayabilir → boş liste (sayfa çökmesin).
    if (/relation .* does not exist|does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(`brand_departments: ${error.message}`);
  }
  return (data ?? []).map((r) => departmentFromRow(r as Record<string, unknown>));
}

export async function findBrandDepartmentById(id: string): Promise<BrandDepartment | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_departments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_departments: ${error.message}`);
  return data ? departmentFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandDepartment(d: BrandDepartment): Promise<BrandDepartment> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_departments")
    .upsert(departmentToRow(d), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_departments: ${error.message}`);
  if (!data) throw new Error("brand_departments: upsert sonuç dönmedi.");
  return departmentFromRow(data as Record<string, unknown>);
}

export async function deleteBrandDepartment(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  // Bu departmana atanmış personeli serbest bırak (department_id = null).
  await admin.from("brand_staff").update({ department_id: null }).eq("department_id", id).then(
    () => {},
    () => {},
  );
  const { error } = await admin.from("brand_departments").delete().eq("id", id);
  if (error) throw new Error(`brand_departments: ${error.message}`);
}

// ── Payroll items ──────────────────────────────────────────────────────────────
function payrollFromRow(r: Record<string, unknown>): BrandPayrollItem {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    staffId: str(r.staff_id),
    month: str(r.month),
    type: pick(r.type, PAYROLL_TYPES, "other"),
    amount: num(r.amount),
    currency: pick(r.currency, CURRENCY, "USD"),
    description: str(r.description),
    paid: r.paid === true || r.paid === "true",
    paidDate: r.paid_date ? str(r.paid_date) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function payrollToRow(p: BrandPayrollItem) {
  return {
    id: p.id,
    brand_id: p.brandId,
    staff_id: p.staffId,
    month: p.month,
    type: p.type,
    amount: p.amount,
    currency: p.currency,
    description: p.description,
    paid: p.paid,
    paid_date: p.paidDate ?? null,
  };
}

export async function fetchBrandPayrollItems(
  brandIds: string[],
  month?: string,
): Promise<BrandPayrollItem[]> {
  if (brandIds.length === 0) return [];
  let q = getSupabaseAdmin()
    .from("brand_payroll_items")
    .select("*")
    .in("brand_id", brandIds)
    .order("created_at", { ascending: true });
  if (month) q = q.eq("month", month);
  const { data, error } = await q;
  if (error) {
    if (/relation .* does not exist|does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(`brand_payroll_items: ${error.message}`);
  }
  return (data ?? []).map((r) => payrollFromRow(r as Record<string, unknown>));
}

export async function findBrandPayrollItemById(id: string): Promise<BrandPayrollItem | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_payroll_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_payroll_items: ${error.message}`);
  return data ? payrollFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandPayrollItem(p: BrandPayrollItem): Promise<BrandPayrollItem> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_payroll_items")
    .upsert(payrollToRow(p), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_payroll_items: ${error.message}`);
  if (!data) throw new Error("brand_payroll_items: upsert sonuç dönmedi.");
  return payrollFromRow(data as Record<string, unknown>);
}

export async function deleteBrandPayrollItem(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_payroll_items").delete().eq("id", id);
  if (error) throw new Error(`brand_payroll_items: ${error.message}`);
}

/** Bir personelin belirli aydaki tüm kalemlerini ödendi/bekliyor olarak işaretler. */
export async function setStaffMonthPaid(
  brandId: string,
  staffId: string,
  month: string,
  paid: boolean,
  paidDate: string | null,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("brand_payroll_items")
    .update({ paid, paid_date: paid ? paidDate : null })
    .eq("brand_id", brandId)
    .eq("staff_id", staffId)
    .eq("month", month);
  if (error) throw new Error(`brand_payroll_items: ${error.message}`);
}

// ── Sabit bileşen ödemeleri (baz / kira / yemek) ─────────────────────────────
function componentFromRow(r: Record<string, unknown>): BrandPayrollComponentPayment {
  return {
    brandId: str(r.brand_id),
    staffId: str(r.staff_id),
    month: str(r.month),
    component: pick(r.component, PAYROLL_COMPONENTS, "base_salary"),
    paid: r.paid === true || r.paid === "true",
    paidDate: r.paid_date ? str(r.paid_date) : undefined,
  };
}

export async function fetchBrandPayrollComponentPayments(
  brandIds: string[],
  month?: string,
): Promise<BrandPayrollComponentPayment[]> {
  if (brandIds.length === 0) return [];
  let q = getSupabaseAdmin()
    .from("brand_payroll_component_payments")
    .select("*")
    .in("brand_id", brandIds);
  if (month) q = q.eq("month", month);
  const { data, error } = await q;
  if (error) {
    if (/relation .* does not exist|does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(`brand_payroll_component_payments: ${error.message}`);
  }
  return (data ?? []).map((r) => componentFromRow(r as Record<string, unknown>));
}

export async function upsertBrandPayrollComponentPayment(
  p: BrandPayrollComponentPayment,
): Promise<BrandPayrollComponentPayment> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_payroll_component_payments")
    .upsert(
      {
        brand_id: p.brandId,
        staff_id: p.staffId,
        month: p.month,
        component: p.component,
        paid: p.paid,
        paid_date: p.paidDate ?? null,
      },
      { onConflict: "brand_id,staff_id,month,component" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_payroll_component_payments: ${error.message}`);
  if (!data) throw new Error("brand_payroll_component_payments: upsert sonuç dönmedi.");
  return componentFromRow(data as Record<string, unknown>);
}
