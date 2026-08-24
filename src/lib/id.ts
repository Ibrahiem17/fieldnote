// src/lib/id.ts
//
// One function, used everywhere a new row needs an ID. Centralising it means
// if the ID strategy ever changes, there is exactly one line to edit.

import { randomUUID } from "expo-crypto";

/**
 * Generates a UUID v4 on the device itself — no server round trip.
 *
 * Why this matters: an inspector offline in a basement still needs to
 * create a permanent, collision-proof ID for a new inspection right now.
 * A server-issued auto-increment ID (1, 2, 3…) requires a server to hand
 * out the next number, which doesn't exist offline. A random ID long
 * enough (2^122 possibilities) will never collide with one generated on
 * a different phone. See DESIGN.md, decision D-001.
 */
export function newId(): string {
  return randomUUID();
}
