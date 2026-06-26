import type { AppUser } from "@/store/auth";
import type { SessionPayload } from "@/lib/session";
import type { Employee, Kasa, KasaTransaction } from "@/store/store";
import {
  isMainAdmin,
  isMainAdminSession,
  MAIN_ADMIN_ID,
  MAIN_ADMIN_USERNAME,
} from "@/lib/user-guards";

/** Ramiz TRON cüzdanını görebilen ikinci yönetici. */
export const RAMIZ_WALLET_VIEWER_USERNAME = "ediz";
export const RAMIZ_WALLET_VIEWER_ID = "u-ediz";
export const RAMIZ_EMPLOYEE_ID = "emp-ramiz";
export const TRON_KASA_ID = "kasa-tron";

const RAMIZ_TRON_ADDRESS_FALLBACK = "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE";

export function isEdiz(u: Pick<AppUser, "id" | "username"> | null | undefined): boolean {
  if (!u) return false;
  return (
    u.id === RAMIZ_WALLET_VIEWER_ID ||
    u.username.toLowerCase().trim() === RAMIZ_WALLET_VIEWER_USERNAME
  );
}

function impersonatorMayViewRamizWallet(
  impersonatorId?: string,
  impersonatorName?: string,
): boolean {
  if (impersonatorId === MAIN_ADMIN_ID) return true;
  if (impersonatorId === RAMIZ_WALLET_VIEWER_ID) return true;
  const name = impersonatorName?.toLowerCase().trim();
  return name === MAIN_ADMIN_USERNAME || name === RAMIZ_WALLET_VIEWER_USERNAME;
}

/** Ramiz TRON cüzdanı ve otomatik transferleri — yalnızca Orkun ve Ediz. */
export function canViewRamizWallet(
  u: Pick<AppUser, "id" | "username" | "impersonatorId" | "impersonatorName"> | null | undefined,
): boolean {
  if (!u) return false;
  if (isMainAdmin(u) || isEdiz(u)) return true;
  return impersonatorMayViewRamizWallet(u.impersonatorId, u.impersonatorName);
}

export function canViewRamizWalletSession(
  session: SessionPayload | null | undefined,
): boolean {
  if (!session) return false;
  if (isMainAdminSession(session)) return true;
  if (
    session.userId === RAMIZ_WALLET_VIEWER_ID ||
    session.username.toLowerCase().trim() === RAMIZ_WALLET_VIEWER_USERNAME
  ) {
    return true;
  }
  return impersonatorMayViewRamizWallet(session.impersonatorId, session.impersonatorName);
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
};

/** Bootstrap yanıtından Ramiz cüzdan verisini çıkarır (yetkisiz oturumlar). */
export function sanitizeBootstrapRamizWallet<T extends RamizBootstrapSlice>(
  payload: T,
  session: SessionPayload,
): T {
  if (canViewRamizWalletSession(session)) return payload;
  return {
    ...payload,
    kasas: filterKasasForRamizViewer(payload.kasas ?? [], false),
    kasaTransactions: filterKasaTransactionsForRamizViewer(
      payload.kasaTransactions ?? [],
      false,
    ),
    employees: payload.employees
      ? sanitizeEmployeesForRamizViewer(payload.employees, false)
      : payload.employees,
  };
}
