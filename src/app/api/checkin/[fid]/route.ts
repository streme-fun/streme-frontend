import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/src/lib/siwf-auth";

interface CheckinStatusResponse {
  fid: number;
  checkedInToday: boolean;
  lastCheckinDate?: string;
  totalCheckins: number;
  currentStreak: number;
  dropHistory: Array<{
    date: string;
    amount: string;
    txHash?: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;

    // Validate FID
    if (!fid || isNaN(parseInt(fid))) {
      return NextResponse.json(
        { error: "Invalid FID" },
        { status: 400 }
      );
    }

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const verified = verifySessionToken(token);

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Ensure user can only access their own check-in data
    if (verified.fid !== parseInt(fid)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Forward the request to the external API
    const response = await fetch(`https://api.streme.fun/api/checkin/${fid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Checkin status API error for FID ${fid}:`, errorText);
      return NextResponse.json(
        { error: "Failed to fetch checkin status" },
        { status: response.status }
      );
    }

    const data: CheckinStatusResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in checkin FID route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}