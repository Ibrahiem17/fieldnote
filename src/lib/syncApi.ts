// src/lib/syncApi.ts
//
// The one place that talks to Supabase's push endpoint (`sync_push`, a
// Postgres RPC function — supabase/migrations/20260913000003_sync_push.sql).
// Nothing else in the app calls `supabase.rpc(...)` directly — this file
// owns that, the same "one door" pattern already used for the local
// database (src/db/client.ts) and for auth (src/lib/supabase.ts).

import { supabase } from "./supabase";
import type { OutboxEntry } from "@/db/schema";

export type PushResult =
  { ok: true; duplicate: boolean } | { ok: false; retryable: boolean; error: string };

/**
 * Day 6: the raw RPC call, pulled out of `pushOutboxEntry` below so
 * `src/lib/attachmentUpload.ts` can call `sync_push` a SECOND time for the
 * same outbox entry — the "the file landed, here's remote_url" follow-up
 * push — without needing a fake `OutboxEntry` to hand `pushOutboxEntry`.
 * Both callers still go through this one function, so there is still only
 * one place in the app that calls `supabase.rpc("sync_push", ...)`.
 */
export async function pushRowOnly(
  idempotencyKey: string,
  entityType: OutboxEntry["entityType"],
  entityId: string,
  operation: OutboxEntry["operation"],
  payload: unknown,
): Promise<PushResult> {
  const { data, error } = await supabase.rpc("sync_push", {
    p_idempotency_key: idempotencyKey,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_operation: operation,
    p_payload: payload,
  });

  if (error) {
    return { ok: false, retryable: isRetryable(error), error: error.message };
  }

  return { ok: true, duplicate: Boolean((data as { duplicate?: boolean } | null)?.duplicate) };
}

/**
 * Pushes one outbox row. The outbox row's own `id` — already a
 * device-generated UUID (Phase 1, D-001) — doubles as its idempotency key:
 * it already uniquely identifies "this one specific change," which is
 * exactly what an idempotency key needs to be (plan Section 2.5). No
 * second ID to generate, and nothing that could ever drift out of sync
 * with the row it's supposed to identify.
 */
export async function pushOutboxEntry(entry: OutboxEntry): Promise<PushResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(entry.payloadJson);
  } catch (e) {
    // A malformed payload will never succeed no matter how many times it's
    // retried — a permanent failure, not a network hiccup.
    return { ok: false, retryable: false, error: `Corrupt outbox payload: ${String(e)}` };
  }

  return pushRowOnly(entry.id, entry.entityType, entry.entityId, entry.operation, payload);
}

/**
 * Error classification (plan Section 2.6): some failures are worth
 * retrying (no network, the server having a bad moment); some never are (a
 * request that's simply wrong will still be wrong on attempt fifty). Day 2
 * only needs this classification to *exist* — Day 3 is what actually acts
 * on it with backoff and a dead letter.
 */
function isRetryable(error: { code?: string; message: string }): boolean {
  // Postgres/PostgREST error codes this app can be certain are permanent:
  //  - 42501 insufficient_privilege — RLS or a missing grant rejected this
  //    exact request; retrying it unchanged changes nothing.
  //  - 22023 invalid_parameter_value — sync_push's own "unknown
  //    entity_type/operation" guard; a code bug, not a network blip.
  //  - 28000 invalid_authorization — not signed in.
  const permanentCodes = new Set(["42501", "22023", "28000"]);
  if (error.code && permanentCodes.has(error.code)) return false;

  // Everything else is treated as retryable — including a foreign-key
  // violation (23503). That one looks permanent but usually isn't here: it
  // most often means a child row (an inspection) reached the server before
  // its parent (the project) did, which resolves itself the next time the
  // outbox drains in order. Being wrong in the "retry" direction costs one
  // wasted attempt later; being wrong in the "give up" direction silently
  // drops a real change — the worse mistake of the two.
  return true;
}
