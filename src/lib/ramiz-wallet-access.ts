import type { AppUser } from "@/store/auth";
import type { SessionPayload } from "@/lib/session";
import {
  computeKasaOperatingMetrics,
  type KasaOperatingMetrics,
} from "@/lib/kasa-tron-metrics";
import type { Employee, Kasa, KasaTransaction } from "@/store/store";
import {
  canAccessPrim,
  isMainAdminSession,
} from "@/lib/user-guards";

export const RAMIZ_EMPLOYEE_ID = "emp-ramiz";
export const TRON_KASA_ID = "kasa-tron";

const RAMIZ_TRON_ADDRESS_FALLBACK = "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE";

/** Ramiz TRON cüzdanı — yalnızca Orkun, impersonation dahil değil. */
export function canViewRamizWallet(
  u: Pick<AppUser, "id" | "username" | "impersonatorId"> | null | undefined,
): boolean {
  return canAccessPrim(u);
}

export function canViewRamizWalletSession(
  session: SessionPayload | null | undefined,
): boolean {
  if (!session || session.impersonatorId) return false;
  return isMainAdminSession(session);
}

export function getRamizTronAddress(): string {
  return (
    process.env.TRON_KASA_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_TRON_KASA_ADDRESS?.trim() ||
    RAMIZ_TRON_ADDRESS_FALLBACK
  );
}

export function isRamizTronAddress(addr?: string | null): boolean {
  if (!addr?.trim()) return false;
  return addr.trim().toLowerCase() === getRamizTronAddress().toLowerCase();
}

export function isRamizKasa(k: Pick<Kasa, "id" | "tronAddress">): boolean {
  if (k.id === TRON_KASA_ID) return true;
  return isRamizTronAddress(k.tronAddress);
}

export function isRamizKasaTransaction(
  t: Pick<KasaTransaction, "kasaId" | "autoImported">,
): boolean {
  return t.kasaId === TRON_KASA_ID || Boolean(t.autoImported);
}

export function maskRamizCounterparty(value: string): string {
  if (!value?.trim()) return value;
  if (isRamizTronAddress(value)) return "TRON cüzdan";
  return value;
}

export function sanitizeKasaTransactionForViewer(
  t: KasaTransaction,
  canView: boolean,
): KasaTransaction {
  if (canView) return t;
  return {
    ...t,
    counterparty: maskRamizCounterparty(t.counterparty),
    notes: isRamizTronAddress(t.notes) ? "" : t.notes,
  };
}

export function filterKasasForRamizViewer(kasas: Kasa[], canView: boolean): Kasa[] {
  if (canView) return kasas;
  return kasas
    .filter((k) => !isRamizKasa(k))
    .map((k) => (k.tronAddress ? { ...k, tronAddress: undefined } : k));
}

export function filterKasaTransactionsForRamizViewer(
  txs: KasaTransaction[],
  canView: boolean,
): KasaTransaction[] {
  if (canView) return txs;
  return txs
    .filter((t) => !isRamizKasaTransaction(t))
    .map((t) => sanitizeKasaTransactionForViewer(t, false));
}

export function sanitizeEmployeesForRamizViewer(
  employees: Employee[],
  canView: boolean,
): Employee[] {
  if (canView) return employees;
  return employees.map((e) =>
    e.id === RAMIZ_EMPLOYEE_ID && e.walletAddress
      ? { ...e, walletAddress: "" }
      : e,
  );
}

export type RamizBootstrapSlice = {
  kasas?: Kasa[];
  kasaTransactions?: KasaTransaction[];
  employees?: Employee[];
  kasaMetrics?: KasaOperatingMetrics;
};

/** Bootstrap yanıtından Ramiz cüzdan verisini çıkarır (yetkisiz oturumlar). */
export function sanitizeBootstrapRamizWallet<T extends RamizBootstrapSlice>(
  payload: T,
  session: SessionPayload,
): T {
  if (canViewRamizWalletSession(session)) return payload;
  const kasas = payload.kasas ?? [];
  const kasaTransactions = payload.kasaTransactions ?? [];
  const kasaMetrics = computeKasaOperatingMetrics(kasas, kasaTransactions);
  return {
    ...payload,
    kasaMetrics,
    kasas: filterKasasForRamizViewer(kasas, false),
    kasaTransactions: filterKasaTransactionsForRamizViewer(
      kasaTransactions,
      false,
    ),
    employees: payload.employees
      ? sanitizeEmployeesForRamizViewer(payload.employees, false)
      : payload.employees,
  };
}
