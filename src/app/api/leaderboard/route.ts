interface Identity {
  walletAddress: string;
  identityType: string;
  identifier: string;
  displayName: string;
  profileImageUrl?: string;
}

interface LeaderboardEntry {
  address: string;
  identities: {
    Farcaster?: Identity;
    ENS?: Identity;
    Lens?: Identity;
    Basename?: Identity;
    "Talent Passport"?: Identity;
  };
}

export async function GET() {
  try {
    const headers = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // Cache for 5 minutes
    };

    console.log("Fetching leaderboard data from Streme API...");

    const response = await fetch("https://api.streme.fun/api/spr/leaderboard", {
      headers: {
        "User-Agent": "Streme-Fun-App/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Streme API error: ${response.status} ${response.statusText}`
      );
    }

    const data: LeaderboardEntry[] = await response.json();

    console.log(`Successfully fetched ${data.length} leaderboard entries`);

    return Response.json(
      {
        data,
        timestamp: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return Response.json(
      {
        error: "Failed to fetch leaderboard data",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
