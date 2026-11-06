import { describe, expect, it } from "vitest";
import { mergeEmployeeAdvanceOnSync } from "./employee-sync-merge";
import type { Employee } from "@/store/store";

const base = (over: Partial<Employee>): Employee => ({
  id: "emp-x",
  name: "Test",
  role: "r",
  department: "d",
  baseSalary: 2000,
  rentSupport: 0,
  initialAdvance: 2500,
  paymentDay: "1-5",
  payrollStartMonth: "2026-01",
  startDate: "2026-01-01",
  status: "active",
  walletAddress: "",
  avatar: "",
  notes: "",
  kind: "streamer",
  advanceMonthlyCut: 100,
  advanceRepayStartMonth: "2026-10",
  ...over,
});

describe("mergeEmployeeAdvanceOnSync", () => {
  it("keeps client when server has no override tags", () => {
    const client = base({ initialAdvance: 2600 });
    const server = base({ initialAdvance: 2500 });
    expect(mergeEmployeeAdvanceOnSync(client, server).initialAdvance).toBe(2600);
  });

  it("prefers server when client stale initialAdvance and server has override", () => {
    const client = base({
      initialAdvance: 2600,
      notes: "[adv-plan:cut=100;start=2026-10]",
    });
    const server = base({
      initialAdvance: 2500,
      notes: "[adv-plan:cut=100;start=2026-10]\n[adv-override:2026-10=400]",
    });
    const merged = mergeEmployeeAdvanceOnSync(client, server);
    expect(merged.initialAdvance).toBe(2500);
    expect(merged.notes).toContain("adv-override:2026-10=400");
  });
});
