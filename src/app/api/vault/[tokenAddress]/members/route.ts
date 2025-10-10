import { NextRequest, NextResponse } from "next/server";

interface VaultData {
  admin: string;
  pool: string;
}

interface PoolMember {
  account: { id: string };
  units: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params;
    const { searchParams } = new URL(request.url);
    const adminAddress = searchParams.get("admin");

    if (!adminAddress) {
      return NextResponse.json(
        { error: "Admin address is required" },
        { status: 400 }
      );
    }

    // Fetch token data to get vault pool address
    const tokenResponse = await fetch(
      `https://api.streme.fun/token/${tokenAddress.toLowerCase()}`
    );

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch token data" },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.vaults || tokenData.vaults.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // Find the vault for this admin
    const vault = (tokenData.vaults as VaultData[]).find(
      (v) => v.admin.toLowerCase() === adminAddress.toLowerCase()
    );

    if (!vault || !vault.pool) {
      return NextResponse.json({ members: [] });
    }

    // Fetch pool members from Superfluid subgraph
    const query = `
      query VaultMembers {
        pool(id: "${vault.pool.toLowerCase()}") {
          poolMembers {
            account {
              id
            }
            units
          }
        }
      }
    `;

    const subgraphResponse = await fetch(
      "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      }
    );

    if (!subgraphResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch pool members" },
        { status: subgraphResponse.status }
      );
    }

    const data = await subgraphResponse.json();

    if (!data.data?.pool?.poolMembers) {
      return NextResponse.json({ members: [] });
    }

    const members = (data.data.pool.poolMembers as PoolMember[])
      .filter((m) => m.units !== "0")
      .map((m) => ({
        address: m.account.id,
        units: m.units,
      }));

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching vault members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
