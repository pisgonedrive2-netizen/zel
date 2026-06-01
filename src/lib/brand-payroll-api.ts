import type { BrandDepartment, BrandPayrollItem } from "@/types/brand-personnel";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${fallback} (${res.status})`);
  return data;
}

// ── Departments ──────────────────────────────────────────────────────────────
export async function fetchDepartments(brandId?: string): Promise<BrandDepartment[]> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/departman${qs}`, { credentials: "include", cache: "no-store" });
  const data = await jsonOrThrow<{ departments?: BrandDepartment[] }>(res, "Departmanlar alınamadı");
  return data.departments ?? [];
}

export async function saveDepartment(input: Partial<BrandDepartment>): Promise<BrandDepartment> {
  const res = await fetch("/api/marka/departman", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ department: BrandDepartment }>(res, "Departman kaydedilemedi");
  return data.department;
}

export async function deleteDepartment(id: string): Promise<void> {
  const res = await fetch(`/api/marka/departman?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Departman silinemedi");
}

// ── Payroll items ──────────────────────────────────────────────────────────────
export async function fetchPayrollItems(brandId?: string, month?: string): Promise<BrandPayrollItem[]> {
  const params = new URLSearchParams();
  if (brandId) params.set("brandId", brandId);
  if (month) params.set("month", month);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/marka/bordro${qs}`, { credentials: "include", cache: "no-store" });
  const data = await jsonOrThrow<{ items?: BrandPayrollItem[] }>(res, "Bordro alınamadı");
  return data.items ?? [];
}

export async function savePayrollItem(input: Partial<BrandPayrollItem>): Promise<BrandPayrollItem> {
  const res = await fetch("/api/marka/bordro", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ item: BrandPayrollItem }>(res, "Bordro kalemi kaydedilemedi");
  return data.item;
}

export async function deletePayrollItem(id: string): Promise<void> {
  const res = await fetch(`/api/marka/bordro?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Bordro kalemi silinemedi");
}

/** Bir personelin belirli aydaki tüm bordro kalemlerini ödendi/bekliyor işaretler. */
export async function markStaffPayrollPaid(
  brandId: string,
  staffId: string,
  month: string,
  paid: boolean,
): Promise<void> {
  const res = await fetch("/api/marka/bordro", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "mark_paid", brandId, staffId, month, paid }),
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Ödeme durumu güncellenemedi");
}
