import type { BrandLink, Employee } from "@/store/store";

/**
 * Kişisel IG / YT / TT achievement taraması yapılmaz (iş çıkışı).
 * Hesap satırları dursa bile cron ve «Kontrol et» bunları atlar.
 */
export const PERSONAL_ACCOUNT_SYNC_EXCLUDED_IDS = ["emp-lucy", "emp-acelya"] as const;

const personalAccountSyncExcluded = new Set<string>(PERSONAL_ACCOUNT_SYNC_EXCLUDED_IDS);

export function allowsPersonalAccountSync(employeeId: string): boolean {
  return Boolean(employeeId) && !personalAccountSyncExcluded.has(employeeId);
}

/** Aktif yayıncı / moderatör (bordro roster). */
export function isActiveRosterEmployee(emp: Employee | undefined | null): boolean {
  if (!emp) return false;
  if (emp.status !== "active") return false;
  return emp.kind === "streamer" || emp.kind === "moderator";
}

export function activeRosterEmployees(employees: Employee[]): Employee[] {
  return employees.filter((e) => isActiveRosterEmployee(e));
}

export function activeRosterIdSet(employees: Employee[]): Set<string> {
  return new Set(activeRosterEmployees(employees).map((e) => e.id));
}

/**
 * Link sahiplerinden yalnızca aktif roster üyelerini say.
 * Pasif (Lucy/Acelya vb.) eski ownerId’ler sayıya girmez.
 */
export function countActiveLinkOwners(
  links: BrandLink[],
  employees: Employee[]
): number {
  const active = activeRosterIdSet(employees);
  const owners = new Set<string>();
  for (const l of links) {
    if (!l.ownerId) continue;
    if (active.has(l.ownerId)) owners.add(l.ownerId);
  }
  return owners.size;
}

/** Tek marka / liste için aktif owner id’leri. */
export function activeOwnerIdsOnLinks(
  links: BrandLink[],
  employees: Employee[]
): string[] {
  const active = activeRosterIdSet(employees);
  const owners = new Set<string>();
  for (const l of links) {
    if (!l.ownerId) continue;
    if (active.has(l.ownerId)) owners.add(l.ownerId);
  }
  return [...owners];
}
