import type {
  BrandStaff,
  BrandStaffActivity,
  BrandStaffShift,
  BrandStaffTask,
  BrandStaffAttendance,
  BrandStaffAnnouncement,
  AttendanceAction,
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

export async function saveDailyBrandTasks(input: {
  brandId: string;
  text: string;
  staffId?: string;
  dueDate?: string;
  notify?: boolean;
}): Promise<{ created: number }> {
  const res = await fetch("/api/marka/takip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "daily-bulk" }),
  });
  const data = await jsonOrThrow<{ created?: number }>(res, "Günlük plan atanamadı");
  return { created: data.created ?? 0 };
}

export async function deleteTracking(kind: "task" | "shift", id: string): Promise<void> {
  const res = await fetch(`/api/marka/takip?kind=${kind}&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Silme başarısız");
}

// ── Mesai / Puantaj ──────────────────────────────────────────────────────────
export async function fetchAttendance(
  brandId?: string,
  opts?: { from?: string; to?: string; staffId?: string }
): Promise<BrandStaffAttendance[]> {
  const qs = new URLSearchParams();
  if (brandId) qs.set("brandId", brandId);
  if (opts?.from) qs.set("from", opts.from);
  if (opts?.to) qs.set("to", opts.to);
  if (opts?.staffId) qs.set("staffId", opts.staffId);
  const res = await fetch(`/api/marka/mesai?${qs.toString()}`, { credentials: "include", cache: "no-store" });
  const data = await jsonOrThrow<{ attendance?: BrandStaffAttendance[] }>(res, "Mesai verisi alınamadı");
  return data.attendance ?? [];
}

export async function attendanceAction(input: {
  brandId: string;
  staffId: string;
  action: AttendanceAction;
  workDate?: string;
}): Promise<BrandStaffAttendance> {
  const res = await fetch("/api/marka/mesai", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ attendance: BrandStaffAttendance }>(res, "Mesai işlemi başarısız");
  return data.attendance;
}

export async function saveAttendanceManual(input: {
  brandId: string;
  staffId: string;
  workDate?: string;
  checkIn?: string;
  checkOut?: string;
  breakMinutes?: number;
  note?: string;
}): Promise<BrandStaffAttendance> {
  const res = await fetch("/api/marka/mesai", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ attendance: BrandStaffAttendance }>(res, "Mesai kaydedilemedi");
  return data.attendance;
}

export async function deleteAttendance(id: string): Promise<void> {
  const res = await fetch(`/api/marka/mesai?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Mesai silinemedi");
}

// ── Personel duyuruları ──────────────────────────────────────────────────────
export async function fetchAnnouncements(brandId?: string): Promise<BrandStaffAnnouncement[]> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/duyuru${qs}`, { credentials: "include", cache: "no-store" });
  const data = await jsonOrThrow<{ announcements?: BrandStaffAnnouncement[] }>(res, "Duyurular alınamadı");
  return data.announcements ?? [];
}

export async function saveAnnouncement(input: Partial<BrandStaffAnnouncement> & { brandId: string }): Promise<BrandStaffAnnouncement> {
  const res = await fetch("/api/marka/duyuru", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ announcement: BrandStaffAnnouncement }>(res, "Duyuru kaydedilemedi");
  return data.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const res = await fetch(`/api/marka/duyuru?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Duyuru silinemedi");
}
