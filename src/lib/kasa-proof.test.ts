import { describe, expect, it } from "vitest";
import {
  parseContentExpenseIdFromKasaBlob,
  resolveKasaProof,
  stripICexpTags,
} from "./kasa-proof";
import type { ContentExpense } from "@/store/store";

const expense = {
  id: "495f615a-e920-413d-934d-85316fdbb9ed",
  kasaTxId: "ktx-1",
  screenshotUrl: "https://example.com/ramiz-ss.png",
} as ContentExpense;

describe("kasa-proof", () => {
  it("parses ICEXP tags from notes/proof", () => {
    expect(
      parseContentExpenseIdFromKasaBlob(
        "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      ),
    ).toBe("495f615a-e920-413d-934d-85316fdbb9ed");
    expect(
      parseContentExpenseIdFromKasaBlob(
        "ok [ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      ),
    ).toBe("495f615a-e920-413d-934d-85316fdbb9ed");
  });

  it("strips tags from notes for display", () => {
    expect(stripICexpTags("Ödendi [ICEXP:abc-123]")).toBe("Ödendi");
  });

  it("resolves screenshot from linked content expense when proof is ICEXP", () => {
    const r = resolveKasaProof(
      {
        id: "ktx-1",
        proof: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
        notes: "",
      },
      [expense],
    );
    expect(r.url).toBe("https://example.com/ramiz-ss.png");
    expect(r.source).toBe("expense");
  });

  it("resolves via notes tag + kasaTxId", () => {
    const r = resolveKasaProof(
      {
        id: "ktx-1",
        proof: "",
        notes: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      },
      [expense],
    );
    expect(r.url).toBe("https://example.com/ramiz-ss.png");
  });
});
