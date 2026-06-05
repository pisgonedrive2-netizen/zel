import type { SessionPayload } from "@/lib/session";
import { appendBrandAuditLog } from "@/lib/db/brand-igaming-repo";

export function newBrandAuditId(): string {
  return `bal-${crypto.randomUUID().slice(0, 12)}`;
}

/** Marka kapsamlı audit log — best effort, API akışını kesmez. */
export async function writeBrandIgamingAudit(
  session: SessionPayload | null,
  brandId: string,
  action: string,
  opts?: {
    entityType?: string;
    entityId?: string;
    detail?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await appendBrandAuditLog({
      id: newBrandAuditId(),
      brandId,
      actorId: session?.userId,
      actorName: session?.name,
      action,
      entityType: opts?.entityType,
      entityId: opts?.entityId,
      detail: opts?.detail ?? "",
      metadata: opts?.metadata,
    });
  } catch {
    /* audit opsiyonel */
  }
}
