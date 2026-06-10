// Shared display formatters for the Agent Floor surfaces (FeedItem,
// ResidentPanel) and Pulse. Pure functions, no React.

/** "just now" / "5m ago" / "3h ago" / "2d ago" from an epoch-ms timestamp. */
export function relativeTime(epochMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** "0x1234…abcd" — short values (≤12 chars) pass through untouched. */
export function truncateHex(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
