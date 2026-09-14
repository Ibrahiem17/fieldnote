// src/lib/syncEngine.ts
//
// Drains the outbox: pushes every currently-due row, oldest first, one at a
// time. Day 2 only handled the happy path; Day 3 adds what happens when a
// push fails — exponential backoff with jitter (src/lib/backoff.ts),
// classifying whether a failure is worth retrying at all (src/lib/syncApi.ts),
// and giving up ("dead-lettering") after too many attempts rather than
// retrying forever. No pull (Day 4), no conflict handling (Day 5) — see
// docs/SYNC.md's status table.

import {
  listPendingOutboxEntries,
  listAllOutboxEntries,
  deleteOutboxEntry,
  recordOutboxFailure,
  resetOutboxEntryForRetry,
} from "@/repositories/outbox";
import { setProjectSyncStatus } from "@/repositories/projects";
import { setInspectionSyncStatus } from "@/repositories/inspections";
import { setAnswerSyncStatus } from "@/repositories/answers";
import { pushOutboxEntry } from "./syncApi";
import { computeBackoffDelayMs, MAX_ATTEMPTS, MAX_DELAY_MS } from "./backoff";
import { now } from "./time";
import type { OutboxEntry, SyncStatus } from "@/db/schema";

export type DrainResult = {
  synced: number;
  failed: number;
  errors: { entityType: string; entityId: string; error: string }[];
};

export type OutboxSummary = {
  /** Due now or waiting out a backoff delay — will retry on its own. */
  pending: number;
  /** Given up after MAX_ATTEMPTS, or a permanent error — needs a manual retry. */
  deadLettered: number;
};

// Which repository function stamps a given entity type's `syncStatus`. No
// `template` entry — templates are never created by this app (Phase 2's
// CLAUDE.md rule), so an outbox row for one should never exist in practice.
const setSyncStatusByEntityType: Partial<
  Record<OutboxEntry["entityType"], (id: string, status: SyncStatus) => Promise<void>>
> = {
  project: setProjectSyncStatus,
  inspection: setInspectionSyncStatus,
  answer: setAnswerSyncStatus,
};

// A sentinel "come back much later" time for a dead-lettered row, so it's
// naturally excluded from `listPendingOutboxEntries`'s `nextAttemptAt <=
// now()` check without needing a separate "is this dead?" column. One
// year out is arbitrary but effectively "never, until a human intervenes."
const DEAD_LETTER_NEXT_ATTEMPT = () => now() + 365 * 24 * 60 * 60 * 1000;

/**
 * The one place that decides "is this row actually dead-lettered?" from
 * what's stored, so `getOutboxSummary` and `retryDeadLetters` can never
 * disagree with each other about which rows they mean. Deliberately keyed
 * on `nextAttemptAt` being further out than any real backoff delay could
 * ever schedule (`MAX_DELAY_MS`, five minutes) — not on `attempts`, which
 * would misclassify a *permanent* failure dead-lettered on its very first
 * attempt (attempts=1) as still "pending" just because it hasn't yet
 * reached `MAX_ATTEMPTS`.
 */
function isDeadLettered(entry: OutboxEntry): boolean {
  return entry.nextAttemptAt !== null && entry.nextAttemptAt > now() + MAX_DELAY_MS;
}

/**
 * Drains every currently-due outbox row, one at a time, in order — never in
 * parallel, since a child entity's push reaching the server before its
 * parent's would fail a foreign-key check (plan Section 2.4/4.3).
 */
export async function drainOutbox(): Promise<DrainResult> {
  const pending = await listPendingOutboxEntries();
  const result: DrainResult = { synced: 0, failed: 0, errors: [] };

  for (const entry of pending) {
    const outcome = await pushOne(entry);
    if (outcome.ok) {
      result.synced += 1;
    } else {
      result.failed += 1;
      result.errors.push({
        entityType: entry.entityType,
        entityId: entry.entityId,
        error: outcome.error,
      });
    }
  }

  return result;
}

async function pushOne(entry: OutboxEntry): Promise<{ ok: true } | { ok: false; error: string }> {
  const setStatus = setSyncStatusByEntityType[entry.entityType];

  // "syncing" — a real, visible state while the request is actually in
  // flight, not just a private implementation detail. This is what the
  // Day 3 status UI can show as "in progress" rather than jumping straight
  // from "pending" to "synced" with nothing in between.
  if (setStatus) await setStatus(entry.entityId, "syncing");

  const pushResult = await pushOutboxEntry(entry);

  if (!pushResult.ok) {
    const attemptsAfterThis = entry.attempts + 1;
    // A permanent error (RLS/grant rejection, bad parameter, not signed in)
    // is dead-lettered immediately — no amount of retrying fixes a request
    // that's simply wrong. A retryable one only dead-letters after
    // MAX_ATTEMPTS; until then it gets a fresh backoff-with-jitter delay.
    const isDead = !pushResult.retryable || attemptsAfterThis >= MAX_ATTEMPTS;
    const nextAttemptAt = isDead
      ? DEAD_LETTER_NEXT_ATTEMPT()
      : now() + computeBackoffDelayMs(entry.attempts);

    await recordOutboxFailure(entry.id, pushResult.error, nextAttemptAt);
    if (setStatus) await setStatus(entry.entityId, isDead ? "failed" : "pending");

    return { ok: false, error: pushResult.error };
  }

  if (setStatus) await setStatus(entry.entityId, "synced");
  // Only reached on real success — deleting the outbox row is the queue
  // saying "this note has been delivered," never done before the server
  // actually confirmed it.
  await deleteOutboxEntry(entry.id);
  return { ok: true };
}

/**
 * The Settings screen's "N pending, N failed" summary (plan Section 3.3.4).
 * Reads every outbox row (not just due ones) and classifies each by the
 * same rule `pushOne` uses to decide dead-letter status, so the count on
 * screen always agrees with what the drain loop would actually do.
 */
export async function getOutboxSummary(): Promise<OutboxSummary> {
  const all = await listAllOutboxEntries();
  const deadLettered = all.filter(isDeadLettered).length;
  return { pending: all.length - deadLettered, deadLettered };
}

/**
 * The manual "Retry Failed" action: resets every dead-lettered row back to
 * due-now with a clean attempt count, then drains immediately. Plan TC-16:
 * "Fix the endpoint, press retry, watch it succeed."
 */
export async function retryDeadLetters(): Promise<DrainResult> {
  const all = await listAllOutboxEntries();
  const deadRows = all.filter(isDeadLettered);
  for (const entry of deadRows) {
    await resetOutboxEntryForRetry(entry.id);
  }
  return drainOutbox();
}
