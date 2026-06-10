import { describe, expect, it } from "vitest";
import {
  formatApiHealthSummary,
  linkMaintenanceConcern,
  worstApiChipStatus,
  worstApiHealthStatus,
} from "./health-summary";

describe("health-summary", () => {
  it("does not flag a few stale links as maintenance concern", () => {
    expect(
      linkMaintenanceConcern({ tracked: 20, linksWithError: 0, staleTrackedLinks: 4 })
    ).toBe(false);
  });

  it("chip stays ok when ping ok but links are stale", () => {
    expect(
      worstApiChipStatus([
        {
          platform: "youtube",
          label: "YouTube",
          batchSizePerRun: 5,
          health: {
            status: "ok",
            connectivityStatus: "ok",
            staleTrackedLinks: 40,
            linksWithError: 0,
          },
        },
      ])
    ).toBe("ok");
  });

  it("chip stays ok when ping ok but links have errors", () => {
    expect(
      worstApiChipStatus([
        {
          platform: "instagram",
          label: "Instagram",
          batchSizePerRun: 5,
          health: {
            status: "warn",
            connectivityStatus: "ok",
            linksWithError: 54,
          },
        },
      ])
    ).toBe("ok");
  });

  it("chip warns on persistent link errors only in legacy panel status", () => {
    expect(
      worstApiHealthStatus([
        {
          platform: "youtube",
          label: "YouTube",
          batchSizePerRun: 5,
          health: { status: "warn", connectivityStatus: "ok", staleTrackedLinks: 20 },
        },
      ])
    ).toBe("warn");
  });

  it("formats chip ok with link error hint", () => {
    const summary = formatApiHealthSummary(
      [
        {
          platform: "instagram",
          label: "Instagram",
          batchSizePerRun: 5,
          health: { status: "warn", connectivityStatus: "ok", linksWithError: 54 },
        },
      ],
      "ok",
      { chip: true }
    );
    expect(summary).toContain("link hatası");
  });
});
