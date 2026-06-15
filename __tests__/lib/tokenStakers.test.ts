import { describe, expect, it } from "@jest/globals";
import { normalizeTokenStakers } from "@/src/lib/tokenStakers";

describe("normalizeTokenStakers", () => {
  it("maps token-specific staker API rows to the leaderboard shape", () => {
    expect(
      normalizeTokenStakers([
        {
          holder_address: "0x70a02ba51b4af58e659ee9b4a8edd3b831d0240c",
          staked_balance: 1182795470.5456154,
          isStaker: true,
          lastUpdated: { _seconds: 1781459816, _nanoseconds: 388000000 },
          farcaster: {
            fid: 354795,
            username: "aaronv.eth",
            pfp_url:
              "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/5a1cdc5e-860b-4c94-09ab-2fde995bc500/original",
          },
        },
        {
          holder_address: "0x045acd980764824b9eb6f312f0a2cdd9f3183503",
          staked_balance: 0,
          isStaker: false,
        },
      ])
    ).toEqual([
      {
        address: "0x70a02ba51b4af58e659ee9b4a8edd3b831d0240c",
        units: "1182795470.5456154",
        percentage: 0,
        isConnected: true,
        fid: 354795,
        username: "aaronv.eth",
        display_name: "aaronv.eth",
        pfp_url:
          "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/5a1cdc5e-860b-4c94-09ab-2fde995bc500/original",
        createdAtTimestamp: "1781459816",
      },
    ]);
  });

  it("keeps the older flattened staker rows working", () => {
    expect(
      normalizeTokenStakers([
        {
          address: "0x1b1c7b8a93fcdf9145065ba3f1c9facbaa0b987f",
          units: "36791127",
          percentage: 0.12,
          isConnected: true,
          fid: 123,
          username: "malbek.eth",
          pfp_url: null,
        },
      ])
    ).toEqual([
      {
        address: "0x1b1c7b8a93fcdf9145065ba3f1c9facbaa0b987f",
        units: "36791127",
        percentage: 0.12,
        isConnected: true,
        fid: 123,
        username: "malbek.eth",
        display_name: undefined,
        pfp_url: null,
        createdAtTimestamp: "0",
      },
    ]);
  });
});
