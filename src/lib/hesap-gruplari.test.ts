import { describe, expect, it } from "vitest";
import type { BrandLink } from "@/store/store";
import { mediaEmbedUrl, mediaKeyFromUrl, parseMediaRef } from "@/lib/media-ref";
import { UNKNOWN_HANDLE, filterAccounts, groupAccounts, linkInTab, sortAccounts } from "@/lib/hesap-gruplari";

function link(p: Partial<BrandLink> & { id: string; url: string }): BrandLink {
  return {
    brandId: "br-gala",
    platform: "YouTube",
    handle: "",
    ownerId: null,
    status: "active",
    notes: "",
    lastViews: 0,
    createdAt: "2026-01-01",
    ...p,
  } as BrandLink;
}

describe("media ref", () => {
  it("parses video links and rejects profiles", () => {
    expect(parseMediaRef("https://youtube.com/shorts/lsk5wAFGGpo")).toMatchObject({
      platform: "youtube",
      id: "lsk5wAFGGpo",
      portrait: true,
    });
    expect(parseMediaRef("https://www.instagram.com/lanetkelben/reel/DcTHQhvsoMp/")?.id).toBe("DcTHQhvsoMp");
    expect(parseMediaRef("https://vt.tiktok.com/ZSxSwWNjw/")).toMatchObject({ shortLink: true });
    expect(parseMediaRef("https://www.youtube.com/@lanetkelben")).toBeNull();
    expect(parseMediaRef("https://www.instagram.com/lanetvlog/")).toBeNull();
  });

  it("builds embeds and stable keys", () => {
    const tt = parseMediaRef("https://www.tiktok.com/@a/video/7659484953373134087?lang=tr")!;
    expect(mediaEmbedUrl(tt)).toBe("https://www.tiktok.com/embed/v2/7659484953373134087");
    expect(mediaEmbedUrl(parseMediaRef("https://vt.tiktok.com/ZSx/")!)).toBeNull();
    expect(mediaKeyFromUrl("https://youtu.be/lsk5wAFGGpo")).toBe(mediaKeyFromUrl("https://youtube.com/watch?v=lsk5wAFGGpo"));
  });
});

describe("hesap grupları", () => {
  const links = [
    link({ id: "a", url: "https://youtube.com/shorts/aaaaaaaaaaa", handle: "lanetkelben", lastViews: 100 }),
    link({ id: "b", url: "https://youtube.com/shorts/bbbbbbbbbbb", handle: "lanetkelben", lastViews: 50, status: "inactive" }),
    link({
      id: "c",
      url: "https://www.tiktok.com/@lanetkelbenim/video/123456789",
      platform: "TikTok",
      lastViews: 70,
      lastRefreshStatus: "ok",
      lastCheckedAt: "2026-10-08T10:00:00Z",
    }),
    link({ id: "d", url: "https://vt.tiktok.com/ZSx/", platform: "TikTok", handle: "TikTok", lastViews: 5 }),
    link({
      id: "e",
      url: "https://www.instagram.com/lanetvlog/",
      platform: "Instagram",
      brandId: "br-yeni-hesaplar",
      lastViews: 900,
      lastRefreshStatus: "ok",
      lastCheckedAt: "2026-10-08T10:00:00Z",
    }),
  ];

  it("splits links into old, api-active and new tabs", () => {
    expect(links.filter((l) => linkInTab(l, "eski")).map((l) => l.id)).toEqual(["a", "b", "c", "d"]);
    expect(links.filter((l) => linkInTab(l, "aktif")).map((l) => l.id)).toEqual(["c", "e"]);
    expect(links.filter((l) => linkInTab(l, "yeni")).map((l) => l.id)).toEqual(["e"]);
  });

  it("groups videos per account and keeps profile metric separate", () => {
    const groups = groupAccounts(links, "eski", "2026-10", [], "2026-10");
    const yt = groups.find((g) => g.key === "youtube|lanetkelben")!;
    expect(yt.videos.map((v) => v.link.id)).toEqual(["a", "b"]);
    expect(yt.videoViews).toBe(150);
    expect(groups.find((g) => g.handle === UNKNOWN_HANDLE)?.videos).toHaveLength(1);

    const yeni = groupAccounts(links, "yeni", "2026-10", [], "2026-10")[0];
    expect(yeni).toMatchObject({ handle: "lanetvlog", profileMetric: 900, views: 900, isNew: true });
  });

  it("counts a video tracked under two brands once", () => {
    const twice = [
      link({ id: "x1", url: "https://youtube.com/shorts/aaaaaaaaaaa", handle: "lanetkelben", lastViews: 100, brandId: "br-gala" }),
      link({ id: "x2", url: "https://www.youtube.com/shorts/aaaaaaaaaaa?feature=share", handle: "lanetkelben", lastViews: 120, brandId: "br-hit" }),
    ];
    const g = groupAccounts(twice, "eski", "2026-10", [], "2026-10")[0];
    expect(g.videos).toHaveLength(1);
    expect(g.videoViews).toBe(120);
    expect(g.videos[0].brandIds).toEqual(["br-gala", "br-hit"]);
  });

  it("filters and sorts with unknown accounts last", () => {
    const groups = groupAccounts(links, "eski", "2026-10", [], "2026-10");
    const sorted = sortAccounts(groups, "views");
    expect(sorted[0].handle).toBe("lanetkelben");
    expect(sorted.at(-1)?.handle).toBe(UNKNOWN_HANDLE);
    expect(filterAccounts(groups, "@lanetkelbenim", "all").map((g) => g.family)).toEqual(["tiktok"]);
    expect(filterAccounts(groups, "", "youtube")).toHaveLength(1);
  });
});
