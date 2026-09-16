// src/lib/sentry.ts
//
// Phase 4, Day 6. One place that touches @sentry/react-native, matching
// this codebase's "one door" pattern for every other external service
// (src/lib/supabase.ts is the same idea for Supabase). `initSentry()` is
// called once, from src/app/_layout.tsx; `reportError` is what
// src/components/ErrorBoundary.tsx calls instead of importing the SDK
// itself.
//
// Gated on EXPO_PUBLIC_SENTRY_DSN (same pattern .env.example already
// establishes for the two Supabase keys) rather than always calling
// Sentry.init(...) unconditionally: this project has no real Sentry
// account or DSN (creating one needs a real account signup this sandbox
// can't do), so with the variable unset — its permanent state here —
// Sentry.init() is simply never called at all. That's a deliberate,
// honest "not configured," not a silent no-op dressed up as "it's
// working."

import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Source maps are uploaded as part of an EAS/Sentry-integrated build
    // (plan Section 3.6.1) — this sandbox can't run that build at all
    // (docs/DESIGN.md has the full reasoning), so a stack trace from
    // this environment would never be readable regardless of this flag.
    // Left on because it's the correct setting for a REAL build, once one
    // exists — not because it does anything meaningful here.
    tracesSampleRate: 1.0,
  });
}

/** Called from ErrorBoundary.componentDidCatch — a no-op when no DSN is
 * configured, exactly like initSentry() above. */
export function reportError(error: Error): void {
  if (!dsn) return;
  Sentry.captureException(error);
}
