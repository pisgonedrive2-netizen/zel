// Faz 3: Marka Personel & Takip tipleri (brand-scoped HR-lite)

export type StaffStatus = "active" | "passive" | "invited";
export type StaffCurrency = "USD" | "EUR" | "TRY";

export interface BrandStaff {
  id: string;
  brandId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  status: StaffStatus;
  monthlyCost: number;
  currency: StaffCurrency;
  avatar: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface BrandStaffTask {
  id: string;
  brandId: string;
  staffId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandStaffShift {
  id: string;
  brandId: string;
  staffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandStaffActivity {
  id: string;
  brandId: string;
  staffId?: string;
  actorUserId?: string;
  actorName: string;
  type: string;
  detail: string;
  createdAt: string;
}

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: "Aktif",
  passive: "Pasif",
  invited: "Davetli",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Yapılacak",
  in_progress: "Devam ediyor",
  done: "Tamamlandı",
  cancelled: "İptal",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};
