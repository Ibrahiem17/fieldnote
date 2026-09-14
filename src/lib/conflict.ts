// src/lib/conflict.ts
//
// Plan Section 5's rules (R1-R7), as one pure function shared by every
// entity type pull merges (projects, inspections, answers). No I/O here —
// this only decides WHAT should happen to each field; src/lib/syncPull.ts
// is what actually writes anything.

// 60 seconds (plan Section 5.1, R7) — not a comparison used to decide who
// WINS (that would mean trusting an unsynced local timestamp against the
// server's clock, exactly what docs/DESIGN.md D-017 rules out). It only
// decides whether two real, different, non-empty edits are close enough in
// time that guessing between them risks discarding something that
// mattered — the plan's own Example 3 ("Structural damage, urgent").
const CONFLICT_WINDOW_MS = 60_000;

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export type FieldResolution =
  | { field: string; action: "take-server"; value: unknown }
  | { field: string; action: "keep-local" }
  | { field: string; action: "manual"; localValue: unknown; serverValue: unknown };

export type ConflictResolution =
  // R4/R5 — an incoming tombstone beats a pending local EDIT, always.
  | { kind: "delete-wins" }
  // The reverse: this device's own pending change IS a delete — its own
  // deliberate action proceeds; nothing here decides anything else about it.
  | { kind: "own-delete-proceeds" }
  | { kind: "fields"; resolutions: FieldResolution[] };

/**
 * @param localRow           This device's current values for the entity
 *                            (already reflects any pending local edits —
 *                            they were written to SQLite immediately when
 *                            the user made them, long before syncing).
 * @param serverRow           The row just pulled from the server.
 * @param dirtyFields         Keys this device's own pending outbox entries
 *                            for this entity actually touched — everything
 *                            else is safe to take from the server outright.
 * @param hasPendingDelete    True if one of this entity's pending outbox
 *                            entries is itself a delete.
 * @param ignoreFields        Columns that are never a meaningful field-level
 *                            conflict on their own (id, timestamps, foreign
 *                            keys) — compared nowhere, resolved nowhere.
 */
export function resolveConflict(args: {
  localRow: Record<string, unknown>;
  serverRow: Record<string, unknown>;
  dirtyFields: Set<string>;
  hasPendingDelete: boolean;
  localPendingChangedAt: number;
  serverUpdatedAtMs: number;
  ignoreFields: string[];
}): ConflictResolution {
  const { localRow, serverRow, dirtyFields, hasPendingDelete, ignoreFields } = args;

  if (serverRow.deletedAt != null && !hasPendingDelete) {
    return { kind: "delete-wins" };
  }
  if (hasPendingDelete) {
    return { kind: "own-delete-proceeds" };
  }

  // If the pulled row's own server timestamp predates this device's local
  // edit, nothing has genuinely raced anything: this row simply hasn't
  // heard about the local edit yet, full stop. Every "difference" a dirty
  // field shows against it is expected and trivial — local is about to
  // push and settle it — never something to ask a person about. Without
  // this shortcut, EVERY dirty field would look "different from the
  // server" purely because the local edit hasn't arrived yet, which is
  // not a conflict at all.
  const serverPredatesLocalEdit = args.serverUpdatedAtMs < args.localPendingChangedAt;

  const closeInTime =
    !serverPredatesLocalEdit &&
    Math.abs(args.localPendingChangedAt - args.serverUpdatedAtMs) < CONFLICT_WINDOW_MS;
  const resolutions: FieldResolution[] = [];

  for (const field of Object.keys(serverRow)) {
    if (ignoreFields.includes(field)) continue;
    const serverValue = serverRow[field];

    // R1: this device never touched this field — the server's version is
    // safe to take outright. This is the common case and resolves silently.
    if (!dirtyFields.has(field)) {
      resolutions.push({ field, action: "take-server", value: serverValue });
      continue;
    }

    const localValue = localRow[field];
    if (localValue === serverValue || serverPredatesLocalEdit) {
      // Either both sides already agree, or the server row is simply
      // older than this device's own edit — in both cases there's nothing
      // to reconcile, local's pending value already stands.
      resolutions.push({ field, action: "keep-local" });
      continue;
    }

    const localEmpty = isEmpty(localValue);
    const serverEmpty = isEmpty(serverValue);

    // R2: one side empty, one side isn't — the real value wins regardless
    // of which side it came from.
    if (localEmpty && !serverEmpty) {
      resolutions.push({ field, action: "take-server", value: serverValue });
      continue;
    }
    if (!localEmpty && serverEmpty) {
      // Local already holds the real value and the server is empty —
      // nothing to change.
      resolutions.push({ field, action: "keep-local" });
      continue;
    }
    if (localEmpty && serverEmpty) {
      // Both empty — not actually a meaningful difference (this branch is
      // mostly a formality; `localValue === serverValue` above already
      // catches most cases, but "" and null are both "empty" without
      // being strictly `===` equal).
      resolutions.push({ field, action: "keep-local" });
      continue;
    }

    // Both sides hold real, different, non-empty values for a field this
    // device also edited.
    if (closeInTime) {
      // R7: close enough in time that guessing is risky — ask a person.
      resolutions.push({ field, action: "manual", localValue, serverValue });
    } else {
      // R3, adapted to this architecture: "newer server timestamp wins."
      // The local edit hasn't been pushed yet — it has no server timestamp
      // to compare. But it's about to push, immediately after this pull
      // (src/lib/sync.ts#runSync: push then pull — wait, pull runs SECOND;
      // the *next* sync's push is what will actually deliver this edit).
      // Once it does, it will receive a server timestamp newer than the
      // one already sitting in `serverRow` (which is, by definition, from
      // before this moment) — so keeping local's pending value is
      // equivalent to letting the genuinely newer change win, without
      // ever comparing an unsynced device clock against the server's.
      resolutions.push({ field, action: "keep-local" });
    }
  }

  return { kind: "fields", resolutions };
}
