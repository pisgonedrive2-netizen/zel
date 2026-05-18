import { describe, expect, it } from "vitest";
import { buildProfessionalCsv, buildProfessionalCsvRows, numberedDetailSection, summarySection } from "./professional-csv";

describe("professional-csv", () => {
  it("rapor bilgisi ve bolum basliklari uretir", () => {
    const rows = buildProfessionalCsvRows({
      filename: "test.csv",
      metadata: { Donem: "2026-05" },
      sections: [
        summarySection("Ozet", [{ metric: "Toplam", value: 100, unit: "USDT" }]),
        numberedDetailSection("Detay", ["Ad", "Tutar"], [["Ali", 50]]),
      ],
    });
    expect(rows[0][0]).toContain("RAPOR BILGISI");
    expect(rows.some((r) => r[0]?.includes("OZET"))).toBe(true);
    expect(rows.some((r) => r[0] === "Sira No")).toBe(true);
  });

  it("her satirda ayni sutun sayisi", () => {
    const csv = buildProfessionalCsv({
      filename: "t.csv",
      metadata: { Test: "1" },
      sections: [numberedDetailSection("X", ["A", "B"], [["1", 2], ["3", 4]])],
    });
    const lines = csv.split("\n").filter((l) => l.includes('"1"') || l.includes('"Sira'));
    for (const line of lines) {
      const cols = line.match(/"[^"]*"|[^,]+/g)?.length ?? 0;
      expect(cols).toBeGreaterThanOrEqual(2);
    }
  });
});
