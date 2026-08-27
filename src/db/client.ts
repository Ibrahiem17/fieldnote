// src/db/client.ts
//
// Opens the one SQLite file this app ever writes to, and wraps it with
// Drizzle so the rest of the app talks to it through typed queries instead
// of raw SQL strings. Every repository imports `db` from here — nothing
// outside this file (and the repositories) should import `expo-sqlite`
// directly (Section 2.8, and enforced as a project rule).

import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

type ExpoDb = ReturnType<typeof openDatabaseSync>;
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export let expoDb: ExpoDb | null = null;
export let db: DrizzleDb | null = null;

/**
 * Set only if opening the database threw. On every real target — Android,
 * iOS, and any browser with working `SharedArrayBuffer`/OPFS support — this
 * stays `null` and nothing here changes behavior at all.
 *
 * Why this exists (D-013 in docs/DESIGN.md): this project's own sandboxed
 * web preview cannot open a real database at all — a confirmed browser
 * threading limitation (D-010), not an app bug, and not fixable from here.
 * Without this, that one broken environment couldn't show a single screen,
 * ever, which defeats the entire point of a preview. Repositories check
 * this flag and fall back to `src/db/mockStore.ts` when it's set — see
 * that file for what "fallback" actually means and does not mean.
 */
export let dbInitError: Error | null = null;

try {
  // openDatabaseSync creates the file on first launch and reopens the same
  // file on every later launch — this one line is the entire reason the app
  // still has its data after a force-quit (Section 2.5).
  expoDb = openDatabaseSync("fieldnote.db", { enableChangeListener: true });
  // `schema` is passed in so `db.query.inspections.findMany(...)` etc. know
  // the shape of every table and return typed rows, not `any`.
  db = drizzle(expoDb, { schema });
} catch (e) {
  dbInitError = e instanceof Error ? e : new Error(String(e));
  console.warn(
    "[Fieldnote] Could not open the on-device database — falling back to " +
      "preview mode with sample, non-persistent data (see docs/DESIGN.md D-013). " +
      "This is expected only in this project's sandboxed web preview; " +
      "Android, iOS, and a normal browser are unaffected.",
    dbInitError,
  );
}

/** True once `db` failed to open — repositories use this to switch to mock data. */
export function isDbAvailable(): boolean {
  return db !== null;
}

/**
 * Returns the real `db`, guaranteed non-null. Only call this after already
 * checking `isDbAvailable()` (or inside a branch reached only when it's
 * true) — repositories use this instead of sprinkling `db!` everywhere, so
 * there's exactly one place that asserts it's safe to do so.
 */
export function requireDb(): DrizzleDb {
  if (!db) {
    throw new Error(
      "requireDb() called while the database is unavailable — check isDbAvailable() first.",
    );
  }
  return db;
}
