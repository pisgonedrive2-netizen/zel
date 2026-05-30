import type {
  BrandStaff,
  BrandStaffActivity,
  BrandStaffShift,
  BrandStaffTask,
} from "@/types/brand-personnel";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${fallback} (${res.status})`);
  return data;
}

export async function fetchStaff(brandId?: string): Promise<BrandStaff[]> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/personel${qs}`, { credentials: "include", cache: "no-store" });
  const data = await jsonOrThrow<{ staff?: BrandStaff[] }>(res, "Personel alınamadı");
  return data.staff ?? [];
}

export async function saveStaff(input: Partial<BrandStaff>): Promise<BrandStaff> {
  const res = await fetch("/api/marka/personel", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ staff: BrandStaff }>(res, "Personel kaydedilemedi");
  return data.staff;
}

export async function deleteStaff(id: string): Promise<void> {
  const res = await fetch(`/api/marka/personel/${id}`, { method: "DELETE", credentials: "include" });
  await jsonOrThrow<{ ok: boolean }>(res, "Personel silinemedi");
}

export interface StaffDetail {
  staff: BrandStaff;
  activity: BrandStaffActivity[];
  tasks: BrandStaffTask[];
  shifts: BrandStaffShift[];
}

export async function fetchStaffDetail(id: string): Promise<StaffDetail> {
  const res = await fetch(`/api/marka/personel/${id}`, { credentials: "include", cache: "no-store" });
  return jsonOrThrow<StaffDetail>(res, "Personel detayı alınamadı");
}

export async function fetchTracking(
  brandId?: string
): Promise<{ tasks: BrandStaffTask[]; shifts: BrandStaffShift[] }> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/takip${qs}`, { credentials: "include", cache: "no-store" });
  return jsonOrThrow<{ tasks: BrandStaffTask[]; shifts: BrandStaffShift[] }>(res, "Takip verisi alınamadı");
}

export async function saveTask(input: Partial<BrandStaffTask>): Promise<BrandStaffTask> {
  const res = await fetch("/api/marka/takip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "task" }),
  });
  const data = await jsonOrThrow<{ task: BrandStaffTask }>(res, "Görev kaydedilemedi");
  return data.task;
}

export async function saveShift(input: Partial<BrandStaffShift>): Promise<BrandStaffShift> {
  const res = await fetch("/api/marka/takip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "shift" }),
  });
  const data = await jsonOrThrow<{ shift: BrandStaffShift }>(res, "Vardiya kaydedilemedi");
  return data.shift;
}

export async function deleteTracking(kind: "task" | "shift", id: string): Promise<void> {
  const res = await fetch(`/api/marka/takip?kind=${kind}&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Silme başarısız");
}
