import { describe, expect, it } from "vitest";
import { aggregatePlayerEvents } from "./player-events-aggregate";
import type { BrandPlayerEvent } from "@/types/brand-igaming";

const ev = (
  partial: Partial<BrandPlayerEvent> & Pick<BrandPlayerEvent, "eventDate" | "eventType">
): BrandPlayerEvent => ({
  id: `e-${partial.eventDate}-${partial.eventType}`,
  brandId: "br-test",
  eventDate: partial.eventDate,
  eventType: partial.eventType,
  channel: "all",
  eventCount: partial.eventCount ?? 1,
  amount: partial.amount ?? 0,
  currency: "USD",
  source: "manual",
});

describe("aggregatePlayerEvents", () => {
  it("sums daily registration and deposit metrics", () => {
    const buckets = aggregatePlayerEvents(
      [
        ev({ eventDate: "2026-05-01", eventType: "registration", eventCount: 3 }),
        ev({ eventDate: "2026-05-01", eventType: "ftd", eventCount: 1 }),
        ev({ eventDate: "2026-05-02", eventType: "deposit", eventCount: 2, amount: 500 }),
      ],
      "daily"
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[0].registrations).toBe(3);
    expect(buckets[0].ftd).toBe(1);
    expect(buckets[1].depositAmount).toBe(500);
  });

  it("groups events into ISO week buckets", () => {
    const buckets = aggregatePlayerEvents(
      [
        ev({ eventDate: "2026-05-05", eventType: "registration", eventCount: 1 }),
        ev({ eventDate: "2026-05-07", eventType: "registration", eventCount: 2 }),
      ],
      "weekly"
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].registrations).toBe(3);
    expect(buckets[0].key).toBe("2026-05-04");
  });
});
