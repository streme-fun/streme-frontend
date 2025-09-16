export function ensureTxHash(
  value: unknown,
  context: string
): `0x${string}` {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  throw new Error(
    `${context} did not return a valid transaction hash. Received: ${String(value)}`
  );
}
