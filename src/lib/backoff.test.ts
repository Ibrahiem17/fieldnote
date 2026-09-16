// src/lib/backoff.test.ts
//
// Phase 4, Day 5. `computeBackoffDelayMs` is deliberately random (jitter,
// plan Section 2.6) — a single call can't be tested for an exact number.
// Every test here either compares many calls at once, or checks a bound
// (never above the cap) rather than an exact value.

import { computeBackoffDelayMs, BASE_DELAY_MS, MAX_DELAY_MS } from "./backoff";

test("delay grows with attempts (compared as floors across many calls, since jitter makes any single call noisy)", () => {
  // Jitter scales a call down to as little as 50% of its raw value — so a
  // single computeBackoffDelayMs(2) COULD legitimately land below a single
  // computeBackoffDelayMs(1) by chance. Taking the minimum across many
  // calls at each attempt count removes that noise: the minimum possible
  // value at attempt N is what actually has to grow, attempt over attempt.
  const SAMPLES = 200;
  function minAt(attempts: number): number {
    let min = Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      min = Math.min(min, computeBackoffDelayMs(attempts));
    }
    return min;
  }

  const min0 = minAt(0);
  const min1 = minAt(1);
  const min2 = minAt(2);
  const min3 = minAt(3);

  expect(min0).toBeLessThan(min1);
  expect(min1).toBeLessThan(min2);
  expect(min2).toBeLessThan(min3);
});

test("delay never exceeds MAX_DELAY_MS, even at a very high attempt count", () => {
  for (let i = 0; i < 200; i++) {
    // attempts=20 -> BASE_DELAY_MS * 2**20 is far past MAX_DELAY_MS, so the
    // cap is the only thing that could possibly be true here.
    expect(computeBackoffDelayMs(20)).toBeLessThanOrEqual(MAX_DELAY_MS);
  }
});

test("jitter actually varies the result — not a fixed value every time", () => {
  const values = new Set<number>();
  for (let i = 0; i < 50; i++) {
    values.add(computeBackoffDelayMs(5));
  }
  // If jitter weren't applied at all, every one of these 50 calls would
  // return the exact same number, and this set would have size 1.
  expect(values.size).toBeGreaterThan(1);
});

test("jitter keeps the result within the documented 50-100% band for a fixed attempt count", () => {
  const attempts = 3;
  const raw = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
  for (let i = 0; i < 200; i++) {
    const value = computeBackoffDelayMs(attempts);
    expect(value).toBeGreaterThanOrEqual(Math.round(raw * 0.5) - 1); // -1: rounding tolerance
    expect(value).toBeLessThanOrEqual(raw);
  }
});
