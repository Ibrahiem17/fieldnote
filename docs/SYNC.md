# Fieldnote — Sync Protocol

Written as it's built, day by day (Phase 3 plan Section 0.4.2) — not filled in
retroactively. Sections marked **Not yet built** are exactly that; nothing
below claims more than what's actually been written and verified.

## Status

| Day | Topic                                            | Status                                                                           |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | Backend, auth, RLS                               | **Done, live-verified**                                                          |
| 2   | Push and idempotency                             | **Done — server proven live; client drain unverified on device**                 |
| 3   | Retry, backoff, connectivity triggers, status UI | **Done — formula and classification proven live; triggers unverified on device** |
| 4   | Pull, cursors, tombstones                        | **Done — resurrection prevention proven live; local merge unverified on device** |
| 5   | Conflict resolution                              | Not yet built                                                                    |
| 6   | File upload, background execution                | Not yet built                                                                    |
| 7   | Test cases, final review                         | Not yet built                                                                    |

## 1. Authentication (Day 1)

**What it is:** email + password sign-in via Supabase Auth. On success,
Supabase issues a short-lived **access token** (a JWT, roughly an hour) and a
longer-lived **refresh token**. `src/lib/supabase.ts`'s client is configured
with `autoRefreshToken: true` — a token nearing expiry is silently exchanged
for a new one in the background; nothing in this app's own code manages that
timer.

**Where the session lives:** `src/lib/supabase.ts`'s storage adapter is
platform-conditional:

- iOS/Android: `expo-secure-store` — the phone's encrypted keychain.
- Web: `localStorage` — SecureStore has no working implementation on web at
  all (confirmed live: it crashed the app to a blank screen before this was
  fixed — see `docs/DESIGN.md` D-018). Web was never a target platform for
  this project anyway (D-010).

**Sign-out:** clears the Supabase session only. It does not, and structurally
cannot, touch local SQLite — `src/auth/AuthProvider.tsx#signOut` calls
nothing in `src/db` or `src/repositories` at all. Plan Section 3.1.3: "a
sign-out that clears the session but does not delete local data." Verified
live: signed out, the app returned to the login screen; local data was
never in the code path that ran.

**Live-verified, not assumed** (`docs/DESIGN.md` D-017/D-018 have the full
detail):

- Sign-up and sign-in against the real Supabase project both work.
- A session survives a full page reload (the web-preview equivalent of
  force-quit-and-reopen — plan TC-03).
- Row Level Security genuinely blocks cross-user reads and forged writes —
  tested by trying to break it with two real accounts, not by reading the
  policy SQL and assuming it's correct.

**Not yet verified:** token refresh actually happening mid-sync (TC-04) —
there's no sync yet for a token to expire during. Revisit once Day 2 exists.

## 2. Push protocol (Day 2)

**The request:** not HTTP-headers-and-JSON-body over a hand-rolled server (the
plan's literal Section 4.1 shape) — this project's backend IS Supabase, so
push is one Postgres function, called as an RPC:

```ts
supabase.rpc("sync_push", {
  p_idempotency_key: entry.id, // the outbox row's own UUID — see below
  p_entity_type: entry.entityType, // "project" | "inspection" | "answer"
  p_entity_id: entry.entityId,
  p_operation: entry.operation, // "insert" | "update" | "delete"
  p_payload: JSON.parse(entry.payloadJson),
});
```

`src/lib/syncApi.ts#pushOutboxEntry` is the only place in the app that calls
this. Supabase attaches the caller's own auth token automatically — there is
no separate "attach the token" step to write.

**The idempotency key is the outbox row's own `id`.** It's already a
device-generated UUID (Phase 1, D-001), already uniquely names this one
pending change, and never needs to be generated a second time — see
`docs/DESIGN.md` D-019 for the full reasoning.

**Server-side (`supabase/migrations/20260913000003_sync_push.sql`):**
`sync_push` checks `sync_idempotency_keys` for that key first. Found → return
the recorded response unchanged, `duplicate: true`, and touch nothing else.
Not found → apply the insert/update/delete (deriving `owner_id` from
`auth.uid()`, never from the payload — a client can't claim to write someone
else's row) and record the response, all inside the one transaction a single
function call already gets.

**Response cases, as actually implemented (not the plan's literal HTTP
status-code table, since there's no HTTP layer of our own to return one):**

| Result                                        | What the client sees                                                 | What it means                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `{ ok: true, duplicate: false }`              | Applied for the first time                                           | Delete the outbox row, mark the entity `synced`                                                                    |
| `{ ok: true, duplicate: true }`               | Already applied earlier                                              | Same as above — a duplicate is a success, not a special case                                                       |
| `error.code = '42501'`/`'22023'`/`'28000'`    | Permanent — RLS/grant rejected it, a bad parameter, or not signed in | Classified `retryable: false` (`syncApi.ts#isRetryable`); Day 3 will dead-letter these instead of retrying forever |
| `error.code = '23503'` (foreign key)          | Usually a child pushed before its parent finished                    | Classified `retryable: true` — resolves itself once the parent syncs                                               |
| anything else (network failure, timeout, 5xx) | Temporary                                                            | `retryable: true`                                                                                                  |

**Ordering: parents before children.** `src/repositories/outbox.ts#listPendingOutboxEntries`
returns rows oldest-first, and `src/lib/syncEngine.ts#drainOutbox` pushes them
one at a time, never in parallel — a project's own insert is always created
(and therefore always queued) before any inspection created under it, so
oldest-first is sufficient on its own to guarantee the parent lands first.
Live-verified: pushing an inspection whose project had already been pushed
succeeded; the identical push against a project id that was never pushed
failed with Postgres `23503`, exactly as the ordering rule predicts should
happen if it were ever violated.

**What's live-verified versus what isn't (see `docs/DESIGN.md` D-019 for the
full detail):** the RPC itself — idempotency, partial updates, FK ordering —
was proven against the real backend with a throwaway script. The client-side
drain loop and the Settings screen's "Sync Now" button call this exact,
proven RPC and are typecheck/lint clean, but have not been exercised end to
end, because this web preview's real SQLite (and therefore its real outbox
table) never opens at all (D-010) — there is nothing to drain here. That
round trip needs a physical device, same as every other on-device gap this
project has been honest about from Phase 1 onward.

## 3. Pull protocol (Day 4)

**The request:** three plain reads, not an RPC (unlike push — see
`docs/DESIGN.md` D-021 for why the two chose differently), one per synced
table:

```ts
supabase
  .from("inspections")
  .select("*")
  .gt("server_updated_at", cursor) // an ISO-8601 string, straight from Postgres
  .order("server_updated_at", { ascending: true });
```

**The cursor** is "the server timestamp of the newest change already
pulled" — stored in a new local table, `sync_state` (`src/db/schema.ts`,
migration `0002`), as the literal ISO-8601 string Postgres returned, never
converted to this project's usual epoch-ms shape. It advances on the
**server's** clock only (`server_updated_at`, D-017) — a device's own
`updated_at` is fine to display, never to decide what's "already seen."
Before any pull has ever run, the cursor defaults to the Unix epoch —
everything looks new.

**Merging:** for each pulled row, oldest first —

1. Does this entity have a pending outbox entry (an unsynced local edit)?
   **Yes** → leave it alone. Completely. Not a partial merge, not "take the
   newer field" — Day 5 owns that decision, and guessing at it a day early
   would very likely need rebuilding once the real policy exists.
2. **No** → upsert it into local SQLite (`applyPulledProject`/
   `applyPulledInspection`/`applyPulledAnswer` — insert if this device has
   never seen the row, update if it has), stamped `syncStatus: "synced"`,
   no outbox entry written (it would just queue the row to be pushed
   straight back to where it came from).

**The cursor only advances once every table's rows in this run have
applied successfully** — computed as the newest `server_updated_at` seen
across all three tables, written once at the very end. A crash partway
through leaves the cursor exactly where it was; the next pull re-fetches
the same rows, and re-applying them is harmless (it's an upsert either
way), so nothing is silently skipped.

**Tombstones and the resurrection bug — live-verified, not just reasoned
about (full detail: `docs/DESIGN.md` D-021):** a deleted row comes down
exactly like any other pulled row — same query, same shape — just with
`deleted_at` populated instead of null; there is no separate tombstone
table or special pull path. The classic failure mode (plan Section 2.7):
Device A deletes a row and syncs; Device B, offline, made an older edit and
pushes it later — does B's push resurrect the row? A throwaway script
proved it does not, against the real backend: after A's delete set
`deleted_at`, pushing B's stale field-only update (the exact payload shape
`updateInspection` produces — no `deletedAt` key at all) left `deleted_at`
untouched, and a pull run immediately after still saw the tombstone intact.
This works because `sync_push`'s update branch (D-019) only ever writes
`deleted_at` when a payload explicitly carries that key — an ordinary
field edit structurally cannot clear it, so this specific bug was already
prevented before Day 4 started; Day 4 confirmed it live rather than taking
that on faith.

**What's live-verified versus what isn't:** the query shape, the
resurrection-prevention property, and a tombstone surviving a stale
concurrent update were all run for real. The actual local merge — writing
a pulled row into SQLite, and correctly leaving a row alone when it has a
pending outbox entry — has not been exercised end to end, because this web
preview's real SQLite never opens (D-010): there's no real local row for
either code path to touch.

**Ordering — push before pull (plan Section 4.3):** `src/lib/sync.ts#runSync()`
is the one place that runs both, in that order, and it's what the manual
"Sync Now" button and the automatic connectivity/foreground triggers both
call now — never `drainOutbox()`/`pullChanges()` directly from a screen or
trigger. Pushing first means this device's own pending changes reach the
server before it asks "what's new?" — otherwise a pull could bring down a
now-stale server version of something this device was about to overwrite
anyway, on every single sync, for no reason.

## 4. Conflict policy

**Not yet built.** Will state the rules from plan Section 5 (R1–R7) with
worked examples once Day 5 actually implements detection and merging —
writing the policy before the code that enforces it exists would be a set of
promises, not a specification of what the app does.

## 5. Failure handling (Day 3)

**Classification (`src/lib/syncApi.ts#isRetryable`):** every push failure is
either retryable or permanent, decided from the Postgres/PostgREST error
code `sync_push` (D-019) returns:

| Code          | Meaning                                              | Treated as                                                                                                                                            |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `42501`       | RLS or a missing grant rejected the request          | Permanent — dead-letter immediately                                                                                                                   |
| `22023`       | Bad parameter (an unknown `entity_type`/`operation`) | Permanent — this is a code bug, not a network blip                                                                                                    |
| `28000`       | Not signed in                                        | Permanent                                                                                                                                             |
| `23503`       | Foreign-key violation                                | **Retryable** — almost always means a child (an inspection) reached the server before its parent (the project); resolves itself once the parent syncs |
| anything else | Network failure, timeout, a 500                      | Retryable                                                                                                                                             |

**Backoff (`src/lib/backoff.ts`):** a retryable failure gets a fresh delay,
`min(1000ms * 2^attempts, 300_000ms)`, then scaled to 50–100% of that value
for jitter (plan Section 2.6 — spreads many devices' retries apart so they
don't all hit the server in the same instant after, say, a shared outage
ends). Logged directly, not through the app, for one real run:

```
attempts=0 -> 711ms      attempts=4 -> 8.7s      attempts=8  -> 193s
attempts=1 -> 2.0s       attempts=5 -> 22.1s     attempts=9  -> 265s (capped region)
attempts=2 -> 2.5s       attempts=6 -> 60.7s     attempts=10 -> 222s
attempts=3 -> 5.8s       attempts=7 -> 92.1s     attempts=11 -> 163s
```

Growth is visible through the early attempts, and the cap plus jitter both
show up once attempts get large — later values bounce around under 300s
rather than climbing forever or repeating identically.

**Dead-lettering:** after `MAX_ATTEMPTS` (8) retryable failures, or
immediately for a permanent one, a row stops being retried automatically —
`nextAttemptAt` is set far enough in the future (`src/lib/syncEngine.ts`'s
`isDeadLettered`, D-020) that the drain loop's own "is this due yet?" filter
naturally excludes it. The row is not deleted and nothing is lost; it sits
visibly in the outbox until a human acts on it. The Settings screen's "N
failed" count and "Retry Failed" button (plan TC-16) are that action —
retrying resets `attempts` to 0 and `nextAttemptAt` to now, giving the row a
genuinely fresh attempt rather than instantly re-dead-lettering.

**Connectivity and foreground triggers (`src/lib/syncTriggers.ts`):** an
automatic drain fires when `NetInfo` reports the OFF→ON transition (not
every network event — a Wi-Fi/cellular handoff isn't a reconnection) and
when `AppState` reports the app becoming active again, on top of the manual
"Sync Now" button. A module-level guard prevents two triggers firing close
together from starting overlapping drains.

**What's live-verified versus what isn't:** the backoff formula and the
error-code classification table above were both proven directly — the
formula by running it and reading real numbers back (above), the
classification by Day 2's live script confirming `sync_push` actually
returns `23503` for the missing-parent case it's built to detect. What
hasn't been exercised end to end, for the same reason as every Day 2/3
client-side gap: `NetInfo`/`AppState` firing and actually triggering a real
drain against a real outbox needs a physical device — this web preview has
no real SQLite (D-010) and no real "airplane mode off" event to produce.

## 6. `sync_status` state diagram

```
local ──push──▶ syncing ──ok────────────▶ synced
                  │
                  ├──retryable─────────▶ pending ──(backoff elapses)──▶ syncing
                  ├──permanent, or
                  │  max attempts───────▶ failed  ──(manual "Retry Failed")──▶ syncing
                  └──(Day 5) 409────────▶ conflict ──resolved──▶ pending
```

Matches the plan's own Section 4.4 diagram, with one addition: `failed`
(dead-lettered) only ever moves again through the deliberate, manual "Retry
Failed" action (`src/lib/syncEngine.ts#retryDeadLetters`) — never on its
own, since a dead letter existing at all means something needs a human's
attention, not another silent automatic attempt.
