import { describe, expect, it } from "vitest";
import { formatClipSubmissionMetrics } from "./display";

describe("formatClipSubmissionMetrics", () => {
  it("shows warn when last check failed without numbers", () => {
    const m = formatClipSubmissionMetrics({
      views: null,
      likes: null,
      comments: null,
      lastCheckedAt: "2026-10-01T00:00:00Z",
      lastCheckError: "429 Too Many Requests",
    });
    expect(m.tone).toBe("warn");
    expect(m.text).toContain("alınamadı");
  });

  it("marks stale numbers when error after prior fetch", () => {
    const m = formatClipSubmissionMetrics({
      views: 1200,
      likes: 10,
      comments: 2,
      lastCheckedAt: "2026-10-01T00:00:00Z",
      lastCheckError: "timeout",
    });
    expect(m.text).toContain("güncellenemedi");
    expect(m.tone).toBe("warn");
  });
});
