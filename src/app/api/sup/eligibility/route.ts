import { NextRequest, NextResponse } from "next/server";

interface EligibilityData {
  pointSystemId: number;
  pointSystemName: string;
  eligible: boolean;
  points: number;
  claimedAmount: number;
  needToClaim: boolean;
  gdaPoolAddress: string;
  estimatedFlowRate: string;
}

interface SupEligibilityResult {
  address: string;
  hasAllocations: boolean;
  claimNeeded: boolean;
  totalFlowRate: string;
  eligibility: EligibilityData[];
}

interface SupEligibilityResponse {
  results: SupEligibilityResult[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SUPERFLUID_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    const eligibilityUrl = `https://sup-eligibility-api.s.superfluid.dev/eligibility?addresses=${address}`;

    const response = await fetch(eligibilityUrl, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch eligibility data" },
        { status: response.status }
      );
    }

    const data: SupEligibilityResponse = await response.json();

    // Find the result for the requested address
    const userResult = data.results.find(
      (result) => result.address.toLowerCase() === address.toLowerCase()
    );

    if (!userResult) {
      return NextResponse.json(
        { error: "No eligibility data found for address" },
        { status: 404 }
      );
    }

    return NextResponse.json(userResult);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
