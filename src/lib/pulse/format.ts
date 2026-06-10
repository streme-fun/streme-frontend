// Compact number formatting shared by the pulse page, OG card, and casts.

export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000)
    return `$${trimTrailingZero((value / 1_000_000_000).toFixed(1))}B`;
  if (value >= 1_000_000)
    return `$${trimTrailingZero((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000)
    return `$${trimTrailingZero((value / 1_000).toFixed(1))}k`;
  if (value >= 1) return `$${Math.round(value)}`;
  return `$${value.toFixed(2)}`;
}

export function formatCountCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000)
    return `${trimTrailingZero((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${trimTrailingZero((value / 1_000).toFixed(1))}k`;
  return `${Math.round(value)}`;
}

export function formatPercentChange(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${trimTrailingZero(String(rounded))}%`;
}

export function formatAge(createdAt: number, now: number): string {
  const seconds = Math.max(0, now - createdAt);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function trimTrailingZero(value: string): string {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}
