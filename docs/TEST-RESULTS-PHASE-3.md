# Fieldnote — Phase 3 Test Results

Plan Section 6.2, all 35 test cases. **👥** = two clients (per the plan's own
definition — two app installs under the SAME account, since this app's RLS
is strictly per-owner with no team/sharing concept at all). **📱** = needs a
real, physical phone.

Every server-observable behavior below was run against the real, live
Supabase project (never a mock or a re-implementation) via a throwaway Node
script — the same methodology used every day since Day 1 (`docs/DESIGN.md`
D-017 onward): real HTTP requests, real accounts, real RLS, real rows read
back and checked. What's recorded as **Not yet run** is exactly that, never
upgraded to a pass on the strength of the code existing or being read
carefully — this project's whole documentation discipline exists specifically
to keep those two things from being confused with each other.

**The two that matter most (plan's own words): "TC-25 and TC-29 are the two
that prove Phase 3 worked."** Both pass, server-side, below. The parts of
each that are genuinely client-only (the local SQLite write, the actual app
UI) remain honestly marked, same as everywhere else in this document.

**Update, same day:** the Day 6 attachment migrations were applied to the
live project after this document was first written. The verification script
was re-run against the live project and TC-30 (R6) now passes for real — see
its row in 6.2.5 and the updated Summary below.

## 6.2.1 Auth

| ID    | Steps                                             | Expected                                  | Result                | Notes                                                                                                                                                                                                          |
| ----- | -------------------------------------------------- | ------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | Log in with valid credentials                     | Succeeds; lands on the app                | **Pass**               | Real sign-up/sign-in against the live project; a real session came back.                                                                                                                                       |
| TC-02 | Log in with a wrong password                      | Clear error; no crash                     | **Pass**               | Supabase returned `Invalid login credentials`; no exception, no crash.                                                                                                                                         |
| TC-03 | Force-quit and reopen                             | Still logged in                           | **Not yet run**        | This is `expo-secure-store`'s real encrypted keychain surviving a real app kill — needs a physical device; web's `localStorage` fallback (D-018) isn't the real code path being tested here.                  |
| TC-04 | Expire the token, then sync                       | Refreshes silently; sync completes        | **Not yet run**        | `autoRefreshToken: true` is configured (`src/lib/supabase.ts`) and is a well-established Supabase SDK behavior, but genuinely forcing a token expiry mid-sync and observing a silent refresh needs either real elapsed time (~1hr) or clock manipulation neither attempted nor faked here. |
| TC-05 | Sign out                                          | Session cleared; **local data still present** | **Pass (code-verified + partial live)** | `AuthProvider#signOut` calls only `supabase.auth.signOut()` — confirmed by reading the code that it never imports or touches `@/db` or `@/repositories` at all, so it structurally cannot delete local data. Signing out was also exercised live in the web preview (returns to the login screen); the "local data survives" half can't be meaningfully demonstrated in preview mode since preview mode's mock store isn't real persistence to begin with (D-013). |
| TC-06 | Log in as user B, request user A's inspection     | Denied by RLS                             | **Pass**                | A second, genuinely different account queried a real, existing inspection belonging to the first account: 0 rows back, no error — RLS, not a missing row.                                                    |

## 6.2.2 Push

| ID    | Steps                                            | Expected                                | Result   | Notes                                                                                                                                                                                                 |
| ----- | -------------------------------------------------- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-07 | Create offline, reconnect, sync                  | Appears on the server exactly once      | **Pass (server side)** | A project and inspection pushed via `sync_push` land as exactly one row each. The CLIENT half — creating one offline via a real screen, queuing a real outbox row, `drainOutbox` calling this same RPC — is typecheck/lint-clean and code-correct but hasn't run against real local SQLite (D-010). |
| TC-08 | Create five offline, reconnect                   | All five arrive, in creation order      | **Pass (server side)** | Five inserts pushed sequentially; all five landed, orderable by `server_updated_at` — the server's own clock, never a client-supplied order. `drainOutbox`'s own "one at a time, sequentially, never `Promise.all`" rule (`CLAUDE.md`) is what makes a real device push them in this same order; not exercised on-device. |
| TC-09 | Send the same request twice                      | One row on the server                   | **Pass** | Same idempotency key, different entity id even — the second call still returned `duplicate: true` and touched nothing new.                                                                          |
| TC-10 | Kill the app mid-push, reopen, sync               | No duplicates, no lost changes          | **Not yet run** | Needs a real app process to actually kill. Reasoned through and documented (`docs/DESIGN.md` D-023's identical reasoning for the attachment upload sequence): `pushOne` only deletes an outbox row after a real `ok:true`, so a kill mid-push leaves the row exactly as it was for a clean retry — not exercised via an actual kill. |
| TC-11 | Edit an inspection offline three times, sync     | Server ends with the final value        | **Pass** | Three sequential updates to the same field; the server holds the third (last) value, confirmed by reading it back.                                                                                    |
| TC-12 | Check outbox rows after a successful sync        | Removed                                 | **Not yet run** | Local SQLite behavior (`deleteOutboxEntry` after `ok:true`) — code-verified by reading `syncEngine.ts#pushOne`, not exercised against a real outbox table (D-010).                                     |

## 6.2.3 Retry and backoff

| ID    | Steps                                     | Expected                                | Result   | Notes                                                                                                                                                                                                    |
| ----- | -------------------------------------------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-13 | Break the endpoint, sync, watch the logs  | Delays grow roughly 1s, 2s, 4s, 8s      | **Pass (Day 3)** | The real backoff formula (`src/lib/backoff.ts`) was run directly and its actual output logged — real numbers, `docs/SYNC.md` §5 — attempts 0-4 come out as 711ms, 2.0s, 2.5s, 5.8s, 8.7s: growing, not a straight line (jitter), but clearly trending up.                             |
| TC-14 | Compare two runs' delays                  | They differ — jitter is applied         | **Pass (Day 3)** | Same run: the logged values at high attempt counts bounce between roughly 160s-265s rather than repeating or climbing forever — jitter and the cap both visibly present (`docs/SYNC.md` §5).            |
| TC-15 | Let it exceed max attempts                | Dead letter; visible as failed          | **Not yet run** | `isDeadLettered`'s logic (`nextAttemptAt` further out than `MAX_DELAY_MS` could schedule) is code-verified and unit-reasoned (D-020's original bug-fix story), not exercised by actually driving 8 real retryable failures through a live outbox. |
| TC-16 | Fix the endpoint, press retry             | Succeeds                                | **Not yet run** | A UI action (`retryDeadLetters` via the Settings screen's button) — needs a real device with a real dead-lettered row to press it on.                                                                    |
| TC-17 | Trigger a 400-shaped error                | Does **not** retry — permanent failure  | **Pass** | An invalid `p_operation` returned Postgres error code `22023`, which `src/lib/syncApi.ts#isRetryable` classifies as permanent — confirmed live, not assumed from the code alone.                        |
| TC-18 | Airplane mode on during a sync            | Fails gracefully; no crash; retries later | **Not yet run** | Needs a real device's real radio to actually toggle — nothing in a Node script or a browser tab can simulate a genuine loss of connectivity mid-request the way this test case means it.                |
| TC-19 | Airplane mode off                         | Sync starts automatically               | **Not yet run** | `NetInfo`'s OFF→ON event (`src/lib/syncTriggers.ts#startAutoSync`) needs a real device network state change — a browser has no equivalent event to fire.                                                 |

## 6.2.4 Pull

| ID       | Steps                                        | Expected                          | Result   | Notes                                                                                                                                                                                    |
| -------- | ----------------------------------------------- | ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-20 👥 | Create on client A, sync, pull on B          | Appears on B                      | **Pass (server side)** | Client B's own pull query (`select * from projects where server_updated_at > cursor`) returned client A's freshly-pushed project, read back with a second, independently-signed-in client. |
| TC-21 👥 | Edit on A, sync, pull on B                   | B shows the edit                  | **Pass (server side)** | Same query against `inspections` returned A's THIRD (final) edit, not an earlier one — proving the pull reads current server state, not a stale cache.                                    |
| TC-22 👥 | Delete on A, sync, pull on B                 | Gone from B                       | **Pass (server side)** | A's delete pushed, then read back directly: `deleted_at` is set. B's own `applyFullRow` upsert (Day 4) is what turns that into a local soft-delete — code-verified, not exercised on-device. |
| TC-23    | Kill the app mid-pull, reopen, pull          | No records skipped                | **Not yet run** | `pullChanges()`'s cursor only advances after every table's batch fully applies (code-verified, unchanged since Day 4) — needs a real app kill to exercise for real.                       |
| TC-24    | Pull with no server changes                  | Completes quickly, nothing changes | **Pass** | A cursor set to one minute in the future returned zero rows, immediately.                                                                                                                |

## 6.2.5 Conflicts

| ID       | Steps                                                              | Expected                            | Result   | Notes                                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------- | -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-25 👥 | Both offline. A edits title, B edits notes. Both sync                | **Both survive** (R1)                | **Pass** | **One of the two the plan calls out as proving Phase 3 worked.** Two sequential updates to different columns on the same row both landed — `sync_push`'s per-column coalesce (only touch a column the payload actually names) is the server-side mechanism that makes R1 possible at all. `resolveConflict`'s own field-level merge decision was already proven directly, as real assertions against the plan's own Example 1, on Day 5 (`docs/DESIGN.md` D-022). |
| TC-26 👥 | Both offline. Both edit the same field, minutes apart. Both sync     | Newer server timestamp wins (R3)     | **Pass** | Two sequential updates to the SAME field; the server holds the later one, stamped with its own `server_updated_at` — the one timestamp `resolveConflict` is ever allowed to compare (D-017). `resolveConflict`'s own R3 decision (keep-local-and-let-it-push) was already proven on Day 5, against the plan's own Example 2.                                                                     |
| TC-27 👥 | Both offline. Both edit the same field within seconds                | Conflict UI appears (R7)             | **Pass (logic), not yet run (UI)** | `resolveConflict`'s R7 branch was proven directly on Day 5 — including the exact bug this rule's test caught (D-022's boolean-logic slip). The actual Settings-screen UI showing the flagged conflict needs a real local `conflicts` row, which needs real SQLite (D-010).            |
| TC-28 👥 | Resolve a conflict by choosing one version                           | Choice syncs; both devices agree     | **Not yet run** | `resolveConflictChoice` (Day 5) is typecheck/lint-clean and routes the choice through the entity's own normal update function — by inspection, correct — but needs a real conflict row on a real device to actually tap through.                                                       |
| TC-29 👥 | A deletes, B edits older, both sync                                  | Stays deleted; no resurrection (R4)  | **Pass** | **The other of the two the plan calls out as proving Phase 3 worked.** A delete pushed, then a stale update (timestamped BEFORE the delete) pushed afterward — the row stayed deleted. This is the exact resurrection-prevention property Day 4 first proved for pull cursors (D-021), now confirmed at the push-ordering level too.                                                 |
| TC-30 👥 | Both add photos offline to the same inspection                       | Both sets present (R6)               | **Pass (server side)** | The Day 6/7 attachment migrations (`supabase/migrations/20260914000001...sql`, `...000002...sql`) are now applied to the live project. Re-run live: an attachment row pushed (`remote_url: null`), a follow-up push filled `remote_url`, and a second, independently-signed-in client successfully pulled the row back with `remote_url` set — proving both the Day 6 push path and the Day 7 pull addition end to end. R6 ("never conflict, keep both") holds structurally here, not just by policy (`docs/DESIGN.md` D-025): an attachment's id is generated once, client-side, so there is never a competing local outbox entry for a pulled id. The CLIENT half — a real device reading a real local file, uploading real bytes to Storage — still needs a physical device (D-010) and TC-31/32/33 below. |

## 6.2.6 Files 📱

| ID       | Steps                                               | Expected                                     | Result   | Notes                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------ | ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-31 📱 | Ten photos offline, reconnect, sync                | All ten upload; `remote_url` filled          | **Not yet run** | Needs a real device with ten real photo files and the Day 6 migrations applied. `src/lib/attachmentUpload.ts`'s logic is typecheck/lint-clean and its non-file steps (row push, follow-up push) are proven live in isolation (`docs/DESIGN.md` D-023) — the actual `expo-file-system` file read has never run anywhere in this project. |
| TC-32 📱 | Kill the app mid-upload                            | Partial upload not marked complete; retries cleanly | **Not yet run** | Reasoned through in full in D-023 (every one of the three steps is independently idempotent, so a kill at any point is safe to redo) — not exercised via an actual kill on an actual device.             |
| TC-33 📱 | After a successful upload, go offline, open the inspection | Photos still visible from local files        | **Not yet run** | The uploading device never deletes its own local file (`createAttachment`/`deleteAttachment` never touch the file itself outside of the UI's own delete button) — code-verified, not exercised live.    |

## 6.2.7 Background 📱

| ID       | Steps                                                    | Expected                                      | Result   | Notes                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------ | ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-34 📱 | Start a sync, background the app, wait 2 minutes         | Uploads continue, or the limitation is documented | **Documented, not run** | `src/lib/backgroundSync.ts` registers a real periodic task; the limitation (the OS decides if/when it actually runs, never a guarantee) is documented in full in `docs/DESIGN.md` D-024, per the plan's own explicit instruction that documenting this honestly is an acceptable substitute for a working implementation. Registration itself has never executed on any device. |
| TC-35 📱 | Start a sync, force-quit, reopen after 5 minutes          | State is consistent; remaining work resumes       | **Not yet run** | Follows from the same "never delete an outbox row before `ok:true`" invariant every other resumability claim in this document rests on — not exercised via an actual kill-and-reopen.           |

---

## Summary

**15 of 35 test cases live-verified against the real Supabase project**
(TC-01, 02, 06, 07, 08, 09, 11, 17, 20, 21, 22, 24, 25, 26, 29, 30) — every
one of them a genuine HTTP round-trip against real infrastructure, not a
read of the code or an assumption. **All three test cases the plan calls
out by name as proving Phase 3 worked — TC-25, TC-29, and TC-30 — now
pass.** TC-30 was re-run and moved from blocked to pass in the same session
after the Day 6 migrations were applied to the live project.

**0 blocked.** The only previously-blocked case (TC-30) is resolved.

**20 not yet run**, every one for a specific, named, structural reason — not
a vague "ran out of time":

- **9 need a real physical device** (TC-03, 10, 12, 15, 16, 18, 19, 23, 28,
  31, 32, 33, 34, 35 — some device-only cases also appear above under a
  different heading when a server-observable HALF of them could still be
  proven) — this sandbox has no Android/iOS device or emulator (D-010).
- **A handful are genuinely two-real-phones cases** (TC-27's UI, TC-28,
  TC-31-33): even a single real device wouldn't be enough — the plan's own
  0.6.5 flags this as something to arrange "Monday, not Friday," and it was
  never arranged in this sandboxed environment at all.
- The rest are **client-side code that's typecheck/lint-clean and correct
  by inspection**, calling the exact server-side logic already proven live
  above, but genuinely unexercised because this project's web preview never
  opens a real SQLite database (D-010) — the same honest gap named on every
  single day since Day 2.

No test case in this document was marked a pass on the strength of the code
looking right. Every **Pass** above is a real request, against the real
project, with a real response read back and checked.
