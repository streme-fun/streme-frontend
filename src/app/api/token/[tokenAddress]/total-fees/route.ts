import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// Uniswap V3 pool ABI fragment for feeGrowthGlobal0X128 and feeGrowthGlobal1X128
const UNISWAP_V3_POOL_ABI = [
  "function feeGrowthGlobal0X128() external view returns (uint256)",
  "function feeGrowthGlobal1X128() external view returns (uint256)",
];

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tokenAddress: string }> }
) {
  const { tokenAddress } = await context.params;
  const { searchParams } = new URL(req.url);
  const poolAddress = searchParams.get("pool");

  if (!tokenAddress || !poolAddress) {
    return NextResponse.json(
      { error: "Missing token or pool address" },
      { status: 400 }
    );
  }

  try {
    // Validate pool address format
    if (!ethers.isAddress(poolAddress)) {
      return NextResponse.json(
        { error: "Invalid pool address format" },
        { status: 400 }
      );
    }

    // Use public RPC (Base mainnet)
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const pool = new ethers.Contract(
      poolAddress,
      UNISWAP_V3_POOL_ABI,
      provider
    );

    // Check if the contract exists by getting its code
    const code = await provider.getCode(poolAddress);
    if (code === "0x") {
      return NextResponse.json(
        { error: "Pool contract not found at the specified address" },
        { status: 404 }
      );
    }

    const [feeGrowth0, feeGrowth1] = await Promise.all([
      pool.feeGrowthGlobal0X128(),
      pool.feeGrowthGlobal1X128(),
    ]);

    // Q128.128 constant as BigInt
    const Q128 = 2n ** 128n;
    const feeGrowth0Big = BigInt(feeGrowth0.toString());
    const feeGrowth1Big = BigInt(feeGrowth1.toString());
    const feeGrowth0Float = Number(feeGrowth0Big) / Number(Q128);
    const feeGrowth1Float = Number(feeGrowth1Big) / Number(Q128);

    return NextResponse.json({
      feeGrowthGlobal0X128: feeGrowth0.toString(),
      feeGrowthGlobal1X128: feeGrowth1.toString(),
      feeGrowthGlobal0: feeGrowth0Float,
      feeGrowthGlobal1: feeGrowth1Float,
    });
  } catch (error) {
    console.error("Error fetching total fees:", {
      tokenAddress,
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle specific ethers errors
    if (error instanceof Error) {
      if (
        error.message.includes("missing revert data") ||
        error.message.includes("CALL_EXCEPTION")
      ) {
        return NextResponse.json(
          {
            error:
              "Contract is not a valid Uniswap V3 pool or does not implement required functions",
          },
          { status: 422 }
        );
      }
      if (error.message.includes("call revert exception")) {
        return NextResponse.json(
          { error: "Pool contract does not support the required interface" },
          { status: 422 }
        );
      }
      if (
        error.message.includes("network") ||
        error.message.includes("timeout")
      ) {
        return NextResponse.json(
          { error: "Network error while fetching pool data" },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch total fees" },
      { status: 500 }
    );
  }
}
