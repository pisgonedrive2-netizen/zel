export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskCategory = "general" | "onboarding" | "daily" | "reminder";

export interface InternalTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  assigneeEmployeeId: string | null;
  assigneeName: string;
  subjectEmployeeId: string | null;
  subjectName: string;
  createdBy: string;
  createdByName: string;
  dueDate: string | null;
  doneAt: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Yapılacak" },
  { value: "in_progress", label: "Devam ediyor" },
  { value: "review", label: "Kontrol" },
  { value: "done", label: "Tamamlandı" },
  { value: "blocked", label: "Engellendi" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Yüksek" },
  { value: "urgent", label: "Acil" },
];

export function taskFromRow(r: Record<string, unknown>): InternalTask {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    status: (String(r.status ?? "todo") as TaskStatus),
    priority: (String(r.priority ?? "normal") as TaskPriority),
    category: (String(r.category ?? "general") as TaskCategory),
    assigneeEmployeeId: r.assignee_employee_id ? String(r.assignee_employee_id) : null,
    assigneeName: String(r.assignee_name ?? ""),
    subjectEmployeeId: r.subject_employee_id ? String(r.subject_employee_id) : null,
    subjectName: String(r.subject_name ?? ""),
    createdBy: String(r.created_by ?? ""),
    createdByName: String(r.created_by_name ?? ""),
    dueDate: r.due_date ? String(r.due_date) : null,
    doneAt: r.done_at ? String(r.done_at) : null,
    orderIndex: Number(r.order_index ?? 0),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

/**
 * Yeni personel için varsayılan onboarding görev şablonu.
 * `offsetDays` işe giriş tarihine göre son tarih (takvim planı) üretir.
 */
export const ONBOARDING_TEMPLATE: { title: string; description: string; offsetDays: number; priority: TaskPriority }[] = [
  { title: "Sözleşme ve evrak", description: "Sözleşme imzası, kimlik ve banka bilgileri alınır.", offsetDays: 0, priority: "high" },
  { title: "Hesap & erişim kurulumu", description: "E-posta, panel kullanıcısı ve gerekli erişimler açılır.", offsetDays: 1, priority: "high" },
  { title: "Tanışma & ekip turu", description: "Ekip tanıştırması ve sorumlulukların anlatımı.", offsetDays: 1, priority: "normal" },
  { title: "Araç & yayın kurulumu", description: "Yayın/çekim ekipmanı ve yazılım kurulumu, deneme yayını.", offsetDays: 3, priority: "normal" },
  { title: "İlk içerik planı", description: "İlk hafta içerik takvimi ve hedeflerin belirlenmesi.", offsetDays: 5, priority: "normal" },
  { title: "İlk hafta değerlendirme", description: "İlk haftanın gözden geçirilmesi ve geri bildirim.", offsetDays: 7, priority: "low" },
  { title: "30 gün değerlendirme", description: "Performans ve uyum değerlendirmesi.", offsetDays: 30, priority: "low" },
];

/** Günlük hatırlatma şablonu satırları — `template: "daily"` ile toplu atanır. */
export type DailyTaskItem = {
  title: string;
  description?: string;
  assigneeEmployeeId?: string | null;
  assigneeName?: string;
  priority?: TaskPriority;
};
