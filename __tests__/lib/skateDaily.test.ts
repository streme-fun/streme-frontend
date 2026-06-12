import { describe, expect, it } from "@jest/globals";
import {
  dailyEndsAt,
  dailyKey,
  dailyName,
  dailySeed,
  formatTimeLeft,
  isDailyKey,
  prevDailyKey,
} from "@/src/lib/skateDaily";
import { buildDailyShareIntent, SKATE_SHARE_URL } from "@/src/lib/skateShare";

describe("skateDaily", () => {
  it("derives a stable UTC day key", () => {
    expect(dailyKey(new Date("2026-06-12T23:59:59Z"))).toBe("2026-06-12");
    expect(dailyKey(new Date("2026-06-13T00:00:01Z"))).toBe("2026-06-13");
    expect(isDailyKey("2026-06-12")).toBe(true);
    expect(isDailyKey("not-a-day")).toBe(false);
  });

  it("maps a day key to one deterministic 31-bit seed — the same line for everyone", () => {
    const a = dailySeed("2026-06-12");
    const b = dailySeed("2026-06-12");
    const c = dailySeed("2026-06-13");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(0x7fffffff);
  });

  it("names the line by weekday and closes it at the next UTC midnight", () => {
    expect(dailyName("2026-06-12")).toBe("FRIDAY FAKIE"); // 2026-06-12 is a Friday
    expect(prevDailyKey("2026-06-12")).toBe("2026-06-11");
    expect(dailyEndsAt("2026-06-12")).toBe(
      new Date("2026-06-13T00:00:00Z").getTime()
    );
  });

  it("formats the reset countdown", () => {
    const ends = new Date("2026-06-13T00:00:00Z").getTime();
    const now = new Date("2026-06-12T16:48:00Z").getTime();
    expect(formatTimeLeft(ends, now)).toBe("7h 12m");
    expect(formatTimeLeft(ends, ends + 1000)).toBe("0m");
  });
});

describe("buildDailyShareIntent", () => {
  it("stamps the day onto the share URL so the cast is a live dare", () => {
    const share = buildDailyShareIntent({
      score: 138328,
      day: "2026-06-12",
      name: "FRIDAY FAKIE",
      username: "lee",
      rank: 1,
      total: 7,
      streak: 3,
    });

    expect(share.shareUrl).toBe(
      `${SKATE_SHARE_URL}?d=2026-06-12&s=138328&by=lee&r=1&st=3`
    );
    expect(share.castText).toContain("DAILY LINE · FRIDAY FAKIE");
    expect(share.castText).toContain("#1 of 7");
    expect(share.castText).toContain("3-day streak");
    expect(share.castText).toContain(share.shareUrl);
  });

  it("omits rank and streak chips it cannot vouch for", () => {
    const share = buildDailyShareIntent({
      score: 5000,
      day: "2026-06-12",
      name: "FRIDAY FAKIE",
      streak: 1, // a 1-day streak is just "played today" — not worth bragging
    });

    expect(share.shareUrl).toBe(`${SKATE_SHARE_URL}?d=2026-06-12&s=5000`);
    expect(share.castText).not.toContain("streak");
    expect(share.castText).not.toContain("#");
  });
});
