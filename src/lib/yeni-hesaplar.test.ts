import { describe, expect, it } from "vitest";
import { detectPlatform } from "@/lib/social-api/platform-detect";
import {
  accountIdentityFromLink,
  isApiFetchedAccount,
  notesForYeniHesap,
  parseHesapTag,
  YENI_HESAPLAR,
  yeniHesapLinkId,
} from "@/lib/yeni-hesaplar";

describe("yeni hesaplar", () => {
  it("lists profile accounts with unique ids and Naz/Ponpon tags", () => {
    expect(YENI_HESAPLAR.length).toBeGreaterThanOrEqual(20);
    const ids = new Set(YENI_HESAPLAR.map(yeniHesapLinkId));
    expect(ids.size).toBe(YENI_HESAPLAR.length);
    expect(YENI_HESAPLAR.filter((a) => a.tag === "naz").map((a) => a.handle).sort()).toEqual(
      ["@erdemhesap1", "@handekorkusuz", "@keladamkomedi", "@lanetkel.toon"].sort()
    );
    expect(YENI_HESAPLAR.filter((a) => a.tag === "ponpon").map((a) => a.handle).sort()).toEqual(
      ["@lanetkelindunyasi", "@mehmet_47_07_", "@roblooxmeryeeemmm", "@sifabilgibirikim"].sort()
    );
    expect(notesForYeniHesap(YENI_HESAPLAR.find((a) => a.tag === "naz")!)).toBe("Naz");
    expect(parseHesapTag("Ponpon")).toBe("ponpon");
  });

  it("detects profiles as user or channel, not a single video", () => {
    for (const account of YENI_HESAPLAR) {
      const detected = detectPlatform(account.url, account.platform, account.handle);
      expect(detected, account.url).not.toBeNull();
      expect(detected?.kind).not.toBe("video");
    }
  });

  it("reads the account from the url, not a video id", () => {
    expect(
      accountIdentityFromLink({
        platform: "TikTok",
        handle: "7659484953373134087",
        url: "https://www.tiktok.com/@ramiznurcin/video/7659484953373134087",
      })
    ).toEqual({ platform: "TikTok", handle: "ramiznurcin" });
    expect(
      accountIdentityFromLink({
        platform: "YouTube",
        handle: "Lanetkelben",
        url: "https://www.youtube.com/shorts/hZkisAqRajs",
      })
    ).toEqual({ platform: "YouTube", handle: "lanetkelben" });
    expect(
      accountIdentityFromLink({
        platform: "TikTok",
        handle: "TikTok",
        url: "https://www.tiktok.com/@lanetkelbenim/video/1",
      })?.handle
    ).toBe("lanetkelbenim");
  });

  it("treats a successful API read as an active account", () => {
    expect(
      isApiFetchedAccount({
        status: "active",
        url: "https://www.youtube.com/@lanetkelreis",
        lastViews: 100,
        lastRefreshStatus: "ok",
        lastCheckedAt: "2026-10-08T12:00:00Z",
      })
    ).toBe(true);
    expect(
      isApiFetchedAccount({
        status: "active",
        url: "https://www.instagram.com/lanetvlog/",
        lastViews: null,
        lastRefreshStatus: "quota",
        lastCheckError: "429 rate limit",
      })
    ).toBe(false);
  });
});
