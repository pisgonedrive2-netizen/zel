import { describe, expect, it } from "vitest";
import { pickPublishedAtIso } from "./published-at";

describe("pickPublishedAtIso", () => {
  it("reads ISO string fields", () => {
    expect(pickPublishedAtIso({ taken_at: "2026-05-28T10:00:00Z" })).toContain("2026-05-28");
  });

  it("reads unix seconds", () => {
    const iso = pickPublishedAtIso({ taken_at: 1716890400 });
    expect(iso).toBeTruthy();
  });
});
