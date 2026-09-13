# Fieldnote — Sync Protocol

Written as it's built, day by day (Phase 3 plan Section 0.4.2) — not filled in
retroactively. Sections marked **Not yet built** are exactly that; nothing
below claims more than what's actually been written and verified.

## Status

| Day | Topic                                            | Status                  |
| --- | ------------------------------------------------ | ----------------------- |
| 1   | Backend, auth, RLS                               | **Done, live-verified** |
| 2   | Push and idempotency                             | Not yet built           |
| 3   | Retry, backoff, connectivity triggers, status UI | Not yet built           |
| 4   | Pull, cursors, tombstones                        | Not yet built           |
| 5   | Conflict resolution                              | Not yet built           |
| 6   | File upload, background execution                | Not yet built           |
| 7   | Test cases, final review                         | Not yet built           |

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

## 2. Push protocol

**Not yet built.** Will cover: request shape, the `Idempotency-Key` header,
`sync_idempotency_keys` (already created in the Day 1 migration, unused
until Day 2), ordering (parents before children), and the response-status
table from the plan's Section 4.1.

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
