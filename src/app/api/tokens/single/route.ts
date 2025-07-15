import { fetchTokenFromStreme, enrichTokensWithData } from "@/src/lib/apiUtils";

// Helper function to retry with exponential backoff for network errors only
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
      
      // Don't retry for token-not-found errors
      if (lastError.message === "TOKEN_NOT_FOUND") {
        throw lastError;
      }

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

    // console.log(`[API] Fetching token data for: ${address}`);

    // Fetch single token with smart retry logic
    const token = await retryWithBackoff(async () => {
      try {
        const result = await fetchTokenFromStreme(address);
        if (result === null) {
          // Token doesn't exist - don't retry this
          throw new Error("TOKEN_NOT_FOUND");
        }
        return result;
      } catch (error) {
        // Re-throw network/service errors for retry, but not token-not-found
        if (error instanceof Error && error.message === "TOKEN_NOT_FOUND") {
          throw error; // Don't retry this
        }
        // Retry other errors (network issues, timeouts, etc.)
        throw new Error("Token service error");
      }
    }).catch((error) => {
      if (error instanceof Error && error.message === "TOKEN_NOT_FOUND") {
        return null; // Convert to null for 404 response
      }
      throw error; // Re-throw other errors
    });
    
    if (!token) {
      return Response.json({ error: "Token not found" }, { status: 404 });
    }

    // console.log(`[API] Successfully fetched token: ${token.name || "Unknown"}`);

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
