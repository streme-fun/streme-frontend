import { fetchTokenFromStreme, enrichTokensWithData } from "@/src/lib/apiUtils";

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(
        `[API] Retry attempt ${
          attempt + 1
        } failed, waiting ${delay}ms before retry:`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      console.error("[API] Address is required");
      return Response.json({ error: "Address is required" }, { status: 400 });
    }

    console.log(`[API] Fetching token data for: ${address}`);

    // Fetch single token with retry logic
    const token = await retryWithBackoff(async () => {
      const result = await fetchTokenFromStreme(address);
      if (!result) {
        throw new Error("Token not found or service unavailable");
      }
      return result;
    });

    console.log(`[API] Successfully fetched token: ${token.name || "Unknown"}`);

    // Enrich token with data using only Streme API market data
    const enrichedToken = await enrichTokensWithData([token]);

    return Response.json({ data: enrichedToken[0] });
  } catch (error) {
    console.error("[API] Error fetching token:", error);

    // Determine appropriate status code based on error type
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("not found")) {
      return Response.json({ error: "Token not found" }, { status: 404 });
    }

    if (
      errorMessage.includes("service unavailable") ||
      errorMessage.includes("503")
    ) {
      return Response.json(
        {
          error:
            "External service temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    // For network timeouts, connection issues, etc.
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("network") ||
      errorMessage.includes("fetch")
    ) {
      return Response.json(
        {
          error:
            "External service temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    return Response.json({ error: "Failed to fetch token" }, { status: 500 });
  }
}
