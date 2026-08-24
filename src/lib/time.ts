// src/lib/time.ts
//
// Every timestamp in this app is a plain integer: milliseconds since
// 1 Jan 1970 ("epoch milliseconds"). Never an ISO string like
// "2026-08-30T12:00:00Z". See DESIGN.md, decision D-003, for why.

/** The current time, as the integer every `*_at` column expects. */
export function now(): number {
  return Date.now();
}

/** Formats an epoch-millisecond timestamp for display only — never for storage or comparison. */
export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}
