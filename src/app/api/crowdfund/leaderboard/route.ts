import { NextResponse } from "next/server";

interface Contributor {
  address: string;
  amount: string;
  username: string;
  pfp_url: string;
  percentage?: number;
}

export async function GET() {
  try {
    console.log("Fetching contributors from external API...");
    // Add cache busting timestamp to external API call
    const timestamp = Date.now();
    const apiResponse = await fetch(
      `https://api.streme.fun/api/qr/members?t=${timestamp}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
    console.log("Contributors API response status:", apiResponse.status);

    if (apiResponse.ok) {
      const data: Contributor[] = await apiResponse.json();
      // console.log('Contributors data:', data);

      // Merge contributors with the same username
      const mergedContributors = mergeContributorsByUsername(data);

      // Calculate percentages
      const contributorsWithPercentages =
        calculatePercentages(mergedContributors);

      const response = NextResponse.json(contributorsWithPercentages);
      // Add cache-busting headers to prevent browser caching
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    } else {
      console.error("Contributors API failed with status:", apiResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch contributors" },
        { status: apiResponse.status }
      );
    }
  } catch (error) {
    console.error("Error fetching contributors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function mergeContributorsByUsername(
  contributors: Contributor[]
): Contributor[] {
  const mergedMap = new Map<string, Contributor>();

  contributors.forEach((contributor) => {
    const key = contributor.username || contributor.address;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      // Add amounts together (both are strings representing BigInt values)
      const existingAmount = BigInt(existing.amount);
      const newAmount = BigInt(contributor.amount);
      const totalAmount = existingAmount + newAmount;

      mergedMap.set(key, {
        ...existing,
        amount: totalAmount.toString(),
        // Keep the first address encountered, or prefer the one with username if merging by username
        address: contributor.username ? existing.address : contributor.address,
      });
    } else {
      mergedMap.set(key, { ...contributor });
    }
  });

  return Array.from(mergedMap.values());
}

function calculatePercentages(contributors: Contributor[]): Contributor[] {
  // Calculate total amount
  const totalAmount = contributors.reduce((sum, contributor) => {
    return sum + BigInt(contributor.amount);
  }, BigInt(0));

  // If no total, return as is
  if (totalAmount === BigInt(0)) {
    return contributors.map((c) => ({ ...c, percentage: 0 }));
  }

  // Calculate percentage for each contributor
  return contributors.map((contributor) => {
    const contributorAmount = BigInt(contributor.amount);
    const percentage =
      Number((contributorAmount * BigInt(10000)) / totalAmount) / 100; // Calculate with 2 decimal precision

    return {
      ...contributor,
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
    };
  });
}
