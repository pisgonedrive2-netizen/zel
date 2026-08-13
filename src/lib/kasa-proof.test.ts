import { describe, expect, it } from "vitest";
import {
  extraProofForForm,
  listKasaProofs,
  parseContentExpenseIdFromKasaBlob,
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
  });

  it("strips tags from notes for display", () => {
    expect(stripICexpTags("Ödendi [ICEXP:abc-123]")).toBe("Ödendi");
  });

  it("shows expense screenshot when proof is only ICEXP", () => {
    const r = listKasaProofs(
      {
        id: "ktx-1",
        proof: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
        notes: "",
      },
      [expense],
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].href).toBe("https://example.com/ramiz-ss.png");
    expect(r.items[0].source).toBe("expense");
  });

  it("keeps Ramiz screenshot and extra kasa image as two items", () => {
    const r = listKasaProofs(
      {
        id: "ktx-1",
        proof: "https://cdn.example/dekont.png",
        notes: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      },
      [expense],
    );
    expect(r.items.map((i) => i.source)).toEqual(["expense", "kasa"]);
    expect(r.items[1].href).toBe("https://cdn.example/dekont.png");
  });

  it("never surfaces ICEXP as a visible proof item", () => {
    const r = listKasaProofs(
      {
        id: "ktx-1",
        proof: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
        notes: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      },
      [{ ...expense, screenshotUrl: undefined } as ContentExpense],
    );
    expect(r.items).toHaveLength(0);
    expect(stripICexpTags("[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]")).toBe("");
  });

  it("does not duplicate when proof was copied from expense screenshot", () => {
    const r = listKasaProofs(
      {
        id: "ktx-1",
        proof: "https://example.com/ramiz-ss.png",
        notes: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      },
      [expense],
    );
    expect(r.items).toHaveLength(1);
    expect(extraProofForForm(
      {
        id: "ktx-1",
        proof: "https://example.com/ramiz-ss.png",
        notes: "[ICEXP:495f615a-e920-413d-934d-85316fdbb9ed]",
      },
      [expense],
    )).toBe("");
  });
});
