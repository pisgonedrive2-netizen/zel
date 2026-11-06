import { describe, expect, it } from "vitest";
import {
  filterAuditVisibleToViewer,
  isMainAdminAuditActor,
} from "@/store/audit-log";

describe("Orkun audit privacy", () => {
  const orkunEntry = {
    actorId: "u-admin",
    actorName: "Orkun",
    action: "user_updated" as const,
  };
  const edizEntry = {
    actorId: "u-ediz",
    actorName: "Ediz",
    action: "user_updated" as const,
  };

  it("detects main admin actor by id or name", () => {
    expect(isMainAdminAuditActor(orkunEntry)).toBe(true);
    expect(isMainAdminAuditActor({ actorId: "x", actorName: "orkun" })).toBe(true);
    expect(isMainAdminAuditActor(edizEntry)).toBe(false);
  });

  it("Orkun sees all entries; others never see Orkun", () => {
    const rows = [orkunEntry, edizEntry];
    expect(
      filterAuditVisibleToViewer(rows, { id: "u-admin", username: "orkun" }),
    ).toHaveLength(2);
    expect(
      filterAuditVisibleToViewer(rows, { id: "u-ediz", username: "ediz" }),
    ).toEqual([edizEntry]);
    expect(filterAuditVisibleToViewer(rows, null)).toEqual([edizEntry]);
  });
});
