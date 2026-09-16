// src/lib/backoff.ts
//
// Exponential backoff with jitter (plan Section 2.6) — kept as its own tiny,
// pure function. No I/O, no Supabase, no outbox, just numbers in and a
// number out. That's deliberate: getting this formula wrong is exactly the
// kind of mistake that stays invisible on one phone with a good connection
// and only shows up when fifty of them lose signal in the same tunnel and
// reconnect together (the "thundering herd" the plan's glossary names).

export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 5 * 60 * 1_000; // 5 minutes — plan's own example cap
export const MAX_ATTEMPTS = 8;

/**
 * attempts=0 -> ~1s, 1 -> ~2s, 2 -> ~4s, 3 -> ~8s ... doubling each time,
 * capped at MAX_DELAY_MS so a row that's failed many times waits minutes,
 * not hours. The result is then scaled to somewhere between 50% and 100%
 * of that value — the jitter — so many devices computing the exact same
 * delay from the exact same attempt count don't all retry in the same
 * instant and hit the server in synchronised waves.
 */
export function computeBackoffDelayMs(attempts: number): number {
  const raw = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
  const jittered = raw * (0.5 + Math.random() * 0.5);
  return Math.round(jittered);
}
