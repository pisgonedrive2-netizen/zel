import { parseAdvanceOverridesFromNotes } from "@/lib/advance-repay";
import type { Employee } from "@/store/store";

/**
 * Admin tam senkronizasyonunda istemci (localStorage) eski `initialAdvance` /
 * notes ile sunucudaki Orkun düzeltmelerini ezmesin.
 */
export function mergeEmployeeAdvanceOnSync(
  client: Employee,
  server: Employee,
): Employee {
  const serverNotes = server.notes ?? "";
  const serverOverrides = parseAdvanceOverridesFromNotes(serverNotes);
  if (serverOverrides.size === 0) return client;

  const clientNotes = client.notes ?? "";
  const clientOverrides = parseAdvanceOverridesFromNotes(clientNotes);
  const clientMissingServerOverride = [...serverOverrides.keys()].some(
    (m) => !clientOverrides.has(m),
  );

  const advanceDrift =
    client.initialAdvance !== server.initialAdvance &&
    (clientMissingServerOverride || client.initialAdvance > server.initialAdvance);

  if (!advanceDrift && serverNotes === clientNotes) return client;

  if (advanceDrift || (clientMissingServerOverride && serverNotes !== clientNotes)) {
    return {
      ...client,
      initialAdvance: server.initialAdvance,
      notes: serverNotes,
      advanceMonthlyCut: server.advanceMonthlyCut,
      advanceRepayStartMonth: server.advanceRepayStartMonth,
    };
  }
  return client;
}
