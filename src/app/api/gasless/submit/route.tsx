import { type NextRequest } from "next/server";
import { isHex } from "viem";

// Validate gasless submit request body
function validateGaslessSubmitBody(body: unknown): { valid: true; data: GaslessSubmitRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const { trade, signature, approval, approvalSignature, chainId } = body as Record<string, unknown>;

  // Required fields
  if (!trade || typeof trade !== "object") {
    return { valid: false, error: "Missing or invalid 'trade' field" };
  }

  if (!signature || typeof signature !== "string" || !isHex(signature)) {
    return { valid: false, error: "Missing or invalid 'signature' field (must be hex string)" };
  }

  // Chain ID is required and must be a valid number
  if (chainId === undefined || (typeof chainId !== "number" && typeof chainId !== "string")) {
    return { valid: false, error: "Missing or invalid 'chainId' field" };
  }

  // Optional approval fields - if present, must be valid
  if (approval !== undefined && typeof approval !== "object") {
    return { valid: false, error: "Invalid 'approval' field (must be object)" };
  }

  if (approvalSignature !== undefined && (typeof approvalSignature !== "string" || !isHex(approvalSignature))) {
    return { valid: false, error: "Invalid 'approvalSignature' field (must be hex string)" };
  }

  return { valid: true, data: body as GaslessSubmitRequest };
}

interface GaslessSubmitRequest {
  trade: Record<string, unknown>;
  signature: string;
  chainId: number | string;
  approval?: Record<string, unknown>;
  approvalSignature?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validateGaslessSubmitBody(body);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const res = await fetch(`https://api.0x.org/gasless/submit`, {
      method: "POST",
      headers: {
        "0x-api-key": process.env.ZEROX_API_KEY as string,
        "0x-version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("0x Gasless API submit error:", res.status);
      return Response.json(
        { error: `0x Gasless API error: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error(
      "Gasless submit API error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { error: "Failed to submit gasless transaction" },
      { status: 500 }
    );
  }
}
