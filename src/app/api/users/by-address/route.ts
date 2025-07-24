import { NextRequest, NextResponse } from "next/server";
import { getNeynarClient } from "@/src/lib/neynar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  
  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  // Validate address format (basic check)
  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  try {
    const client = getNeynarClient();
    
    // Use Neynar's fetchBulkUsersByEthOrSolAddress method
    const response = await client.fetchBulkUsersByEthOrSolAddress({
      addresses: [address.toLowerCase()],
    });

    // Check if any users were found
    // Response structure: { [address]: User[] }
    const addressKey = address.toLowerCase();
    const usersForAddress = response[addressKey];
    
    if (!usersForAddress || usersForAddress.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "No Farcaster user found for this address" 
        },
        { status: 404 }
      );
    }

    // Get the first user (there should only be one per address)
    const user = usersForAddress[0];

    // Format the user data
    const userData = {
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      custody_address: user.custody_address,
      verified_addresses: user.verified_addresses,
      follower_count: user.follower_count,
      following_count: user.following_count,
    };

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error("Error fetching user by address:", error);
    
    // Handle specific error cases
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "No Farcaster user found for this address" 
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch user data" 
      },
      { status: 500 }
    );
  }
}