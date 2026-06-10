import { describe, expect, it } from "@jest/globals";
import {
  buildSurfShareIntent,
  SURF_DISPLAY_URL,
  SURF_SHARE_URL,
} from "@/src/lib/surfShare";

describe("buildSurfShareIntent", () => {
  it("shares the surf route", () => {
    const share = buildSurfShareIntent({
      distance: 420,
      bubbles: 7,
      username: "lee",
    });

    expect(share.shareUrl).toBe(`${SURF_SHARE_URL}?d=420&by=lee`);
    expect(share.castText).toContain(share.shareUrl);
    expect(SURF_DISPLAY_URL).toBe("streme.fun/surf");
  });

  it("uses the confirmed leaderboard best for leaderboard shares", () => {
    const share = buildSurfShareIntent({
      distance: 125,
      bubbles: 2,
      username: "lee",
      rankResult: { best: 900, rank: 4, total: 80, improved: false },
    });

    expect(share.shareUrl).toBe(`${SURF_SHARE_URL}?d=900&by=lee&r=4`);
    expect(share.castText).toContain("#4 of 80");
    expect(share.castText).toContain("900m ride");
  });

  it("keeps a beaten challenge card matched to the just-finished run", () => {
    const share = buildSurfShareIntent({
      distance: 640,
      bubbles: 8,
      username: "lee",
      challenge: { distance: 500, by: "alice" },
      challengeBeaten: true,
      rankResult: { best: 1200, rank: 2, total: 80, improved: false },
    });

    expect(share.shareUrl).toBe(`${SURF_SHARE_URL}?d=640&by=lee`);
    expect(share.castText).toContain("@alice's 500m challenge");
    expect(share.castText).toContain("rode 640m");
    expect(share.castText).not.toContain("#2");
  });

  it("includes rank on a challenge share only when rank belongs to that score", () => {
    const share = buildSurfShareIntent({
      distance: 1200,
      bubbles: 20,
      username: "lee",
      challenge: { distance: 500, by: "alice" },
      challengeBeaten: true,
      rankResult: { best: 1200, rank: 2, total: 80, improved: true },
    });

    expect(share.shareUrl).toBe(`${SURF_SHARE_URL}?d=1200&by=lee&r=2`);
    expect(share.castText).toContain("Now #2 on the leaderboard");
  });
});
