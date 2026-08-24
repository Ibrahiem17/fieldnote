// src/db/client.ts
//
// Opens the one SQLite file this app ever writes to, and wraps it with
// Drizzle so the rest of the app talks to it through typed queries instead
// of raw SQL strings. Every repository imports `db` from here — nothing
// outside this file (and the repositories) should import `expo-sqlite`
// directly (Section 2.8, and enforced as a rule in CLAUDE.md).

import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

// openDatabaseSync creates the file on first launch and reopens the same
// file on every later launch — this one line is the entire reason the app
// still has its data after a force-quit (Section 2.5).
export const expoDb = openDatabaseSync("fieldnote.db", { enableChangeListener: true });

// `schema` is passed in so `db.query.inspections.findMany(...)` etc. know
// the shape of every table and return typed rows, not `any`.
export const db = drizzle(expoDb, { schema });
