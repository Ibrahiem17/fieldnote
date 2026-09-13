# Fieldnote — Sync Protocol

Written as it's built, day by day (Phase 3 plan Section 0.4.2) — not filled in
retroactively. Sections marked **Not yet built** are exactly that; nothing
below claims more than what's actually been written and verified.

## Status

| Day | Topic                                            | Status                                                           |
| --- | ------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | Backend, auth, RLS                               | **Done, live-verified**                                          |
| 2   | Push and idempotency                             | **Done — server proven live; client drain unverified on device** |
| 3   | Retry, backoff, connectivity triggers, status UI | Not yet built                                                    |
| 4   | Pull, cursors, tombstones                        | Not yet built                                                    |
| 5   | Conflict resolution                              | Not yet built                                                    |
| 6   | File upload, background execution                | Not yet built                                                    |
| 7   | Test cases, final review                         | Not yet built                                                    |

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

## 3. Pull protocol

**Not yet built.** Will cover: the `last_synced_at` cursor, why it advances
on the **server's** timestamp (`server_updated_at`, D-017) and never a
device's own clock, and how a batch's cursor only advances after the whole
batch is applied (so a crash mid-merge can't silently skip rows).

## 4. Conflict policy

**Not yet built.** Will state the rules from plan Section 5 (R1–R7) with
worked examples once Day 5 actually implements detection and merging —
writing the policy before the code that enforces it exists would be a set of
promises, not a specification of what the app does.

## 5. Failure handling

**Not yet built** beyond what Day 1 already covers above (token refresh).
Will cover: no network, server error, token expired mid-sync, app killed
mid-sync, once Day 2/3 exist to fail in those ways.

## 6. `sync_status` state diagram

**Not yet built** — the column already exists on every local table
(Phase 1), but nothing drives it yet. Comes with Day 2's push logic.
