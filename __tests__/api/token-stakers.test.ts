import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { GET } from "@/src/app/api/token/[tokenAddress]/stakers/route";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("/api/token/[tokenAddress]/stakers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("proxies to the token-specific stakers endpoint and preserves cache busting", async () => {
    const stakers = [
      {
        holder_address: "0x70a02ba51b4af58e659ee9b4a8edd3b831d0240c",
        staked_balance: 1182795470.5456154,
        isStaker: true,
      },
    ];

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(stakers),
    } as Response);

    const request = new Request(
      "http://localhost:3000/api/token/0x02c910f37f98ae7338bae8ce0a54e8e15f4a9f3b/stakers?v=123"
    );
    const response = await GET(request, {
      params: Promise.resolve({
        tokenAddress: "0x02c910f37f98ae7338bae8ce0a54e8e15f4a9f3b",
      }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.streme.fun/api/token/0x02c910f37f98ae7338bae8ce0a54e8e15f4a9f3b/stakers?v=123",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Streme/1.0",
        },
      }
    );
    await expect(response.json()).resolves.toEqual(stakers);
  });
});
