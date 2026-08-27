# Fieldnote — Design & Architecture

## Problem

Field inspectors work on sites with poor or no network coverage. Most apps treat offline as an error state — a spinner, a "no connection" banner, a dead screen. Fieldnote treats the device as the source of truth: the phone's local database is the real data, and the server is something it _catches up with_ later, not something it depends on to function.

## Architecture

```
Screens (src/app/**)
   │  calls
   ▼
Repositories (src/repositories/*)
   │  calls
   ▼
Drizzle (src/db/schema.ts, src/db/client.ts)
   │
   ▼
SQLite (fieldnote.db, on-device)
                                          ↓ (Phase 3)
                                   Sync engine → Supabase
```

Every screen goes through a repository; every repository goes through Drizzle; nothing talks to SQLite directly except Drizzle itself. This is enforced as a project rule, not just a convention — see decision D-004.

## Decision log

### D-001: Device-generated UUIDs instead of server auto-increment

- **Date:** 2026-08-25
- **Decision:** every table's `id` is a UUID v4, created on the phone at the moment of insert (`src/lib/id.ts`, via `expo-crypto`).
- **Why:** an offline inspector must be able to create a record — an inspection, a project — with a permanent ID _right now_, with no server reachable. A server-issued auto-increment ID (1, 2, 3…) requires asking a server for the next number, which doesn't exist offline.
- **Trade-off:** UUIDs are 36 characters versus a few digits — larger keys, marginally slower indexes and a bigger database file at scale.
- **Rejected:** auto-increment (impossible offline); server-reserved ID blocks, where the phone pre-fetches a batch of IDs while online to hand out later (workable, but needs connectivity to refill and adds a whole subsystem for a problem UUIDs solve for free).

### D-002: Soft delete only — a `deletedAt` timestamp, never a real `DELETE`

- **Date:** 2026-08-25
- **Decision:** "deleting" a row sets `deletedAt` to the current time and leaves the row in place. Every read filters `isNull(table.deletedAt)`. Nothing in the app runs a real SQL `DELETE` against an entity table.
- **Why:** a hard delete offline can't be synced. If the row is simply gone, Phase 3's sync engine has no way to tell the server "this record used to exist and the user removed it" — the server never learns, and depending on sync direction the row could even reappear. A soft delete is itself the message that gets synced.
- **Trade-off:** every table grows forever (deleted rows are never purged in Phase 1); every read needs the `deletedAt IS NULL` filter, which is one more thing to remember and forget.
- **Rejected:** hard delete with a separate `tombstones` table recording what was deleted — functionally similar to soft delete but needs a second table and a join, for no real benefit at this scale.

### D-003: Timestamps as epoch milliseconds (INTEGER), never ISO strings

- **Date:** 2026-08-25
- **Decision:** every `*_at` column is `integer`, storing `Date.now()` — milliseconds since 1 January 1970.
- **Why:** comparing and sorting plain integers is trivial and unambiguous. ISO strings (`"2026-08-30T12:00:00Z"`) invite subtle bugs: string-sorting `"2026-8-9"` against `"2026-08-10"` gives the wrong order, and timezone-suffixed strings vary in format depending on where they were generated.
- **Trade-off:** a raw integer isn't human-readable in a database viewer — `src/lib/time.ts#formatTimestamp()` exists purely to convert one for display, and is never used for storage or comparison.
- **Rejected:** ISO 8601 strings (sorting/timezone footguns above); `Date` objects (SQLite has no native date type — Drizzle would still serialize it to one of the other two options anyway).

### D-004: The repository layer is the only code allowed to import Drizzle

- **Date:** 2026-08-25
- **Decision:** `src/repositories/*.ts` are the only files that import `db`, `schema`, or any `drizzle-orm` query builder. Screens (`src/app/**`) and components (`src/components/**`) call repository functions and never see a query.
- **Why:** Phase 3 needs every mutation to also write an outbox row. If ten screens wrote to the database directly, the same discipline would need to be re-applied ten times, and any screen missed becomes a change that silently never syncs — the worst kind of bug, because nothing _looks_ wrong. With one layer responsible, there is exactly one place to get it right.
- **Trade-off:** an extra function call and file for even the simplest read; can feel like ceremony for a one-off query.
- **Rejected:** letting screens query Drizzle directly with a "remember to add outbox writes" convention — relies on memory across dozens of call sites instead of a door that can't be skipped.

### D-005: `outbox` does not carry the common `createdAt/updatedAt/deletedAt/syncStatus` columns

- **Date:** 2026-08-25
- **Decision:** unlike every entity table, `outbox` has its own distinct column set (Section 4.2.6 of the Phase 1 plan) rather than sharing `commonColumns()`.
- **Why:** an outbox row is a to-do note, not a syncable entity in its own right — it is never itself updated, soft-deleted, or given a sync status. Giving it those columns would be four columns that are always meaningless.
- **Trade-off:** one table shaped differently from the other five, which is one more thing to remember when reading `schema.ts`.
- **Rejected:** reusing `commonColumns()` for consistency's sake — consistency that documents a lie (that outbox rows can be "updated" or "deleted") is worse than an documented exception.

### D-006: `.sql` migrations imported at build time via `babel-plugin-inline-import`, not read at runtime

- **Date:** 2026-08-25
- **Decision:** `drizzle-kit generate` (driver `expo`) produces raw `.sql` files plus a `drizzle/migrations.js` loader that imports them directly (`import m0000 from './0000_init.sql'`). `metro.config.js` adds `sql` to Metro's `sourceExts`; `babel.config.js` adds the `inline-import` plugin so each `.sql` file's _raw text_ is inlined as a JS string at bundle time.
- **Why:** a phone app can't `fs.readFile()` a `.sql` file at runtime the way a Node script could — everything the app needs must be bundled in. Verified directly: without the Babel plugin, Metro's default JS transformer tries to parse raw SQL as JavaScript and fails immediately with a syntax error (`Missing semicolon`, pointing at the `CREATE TABLE` keyword) — this is exactly the failure Section 3.4.3 of the Phase 1 plan warned this integration is fragile enough to hit.
- **Trade-off:** two config files (`babel.config.js`, `metro.config.js`) whose only job is this wiring, and both must exist together — either alone still fails to bundle.
- **Rejected:** hand-writing migration SQL as JS template strings directly (works, but throws away `drizzle-kit generate`'s automatic diffing between schema versions — see Section 2.7 on why migrations matter at all).

### D-007: A second migration, `projects.notes`, to prove upgrades don't destroy data

- **Date:** 2026-08-25
- **Decision:** added a nullable `notes` column to `projects` and ran `npm run db:generate`, producing `drizzle/0001_add_project_notes.sql` (`ALTER TABLE projects ADD notes text;`) alongside the existing `0000_init.sql`.
- **Why this exists as its own decision, not just "a column got added":** Section 3.4.4 of the Phase 1 plan is explicit that one migration proves nothing — an empty database "migrates" fine no matter what. Only a _second_ migration, applied to a database that already has real rows in it, proves the upgrade path itself doesn't wipe or corrupt existing data. The column chosen (`projects.notes`) is deliberately nullable, so every row seeded under `0000_init` — before this column existed — still satisfies the new schema with no backfill step required.
- **Trade-off / honest limitation:** this decision and the migration file exist; what it's meant to _prove_ — that installing an app containing `0001` over a device that already ran `0000` and has real data leaves that data intact — has not yet been verified on an actual device in this session (no Android Studio or physical phone available in this environment). See `docs/TEST-RESULTS-PHASE-1.md`, TC-10, which is intentionally still marked **Not yet run**, not upgraded to a pass on the strength of the migration file existing alone.
- **Rejected:** picking a column with no real use (a throwaway `debugField`) purely to exercise the migration machinery — `notes` was chosen instead because it's a real, small, genuinely useful addition (projects had no notes field; inspections already did), so the migration also does something worth keeping rather than being pure ceremony.

### D-008: A reverse proxy in front of Metro's web dev server, to make `expo-sqlite` web actually loadable — dev tooling only, not the shipped app

- **Date:** 2026-08-27
- **Decision:** `npm run web` now goes through `scripts/dev-web-coi-proxy.js` (`npm run web:coi`, wired as the default web launch config) — a small Node script that runs `expo start --web` as a child process and sits a reverse proxy in front of it, adding `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to every response that passes through.
- **Why this is needed at all:** `expo-sqlite`'s web backend runs SQLite compiled to WebAssembly inside a Web Worker, and that requires `SharedArrayBuffer` to share memory between the page and the worker. Browsers only grant a working `SharedArrayBuffer` to a page that is "cross-origin isolated," which requires those two headers on the actual HTML document response — not just on the JS bundle.
- **Why not just add the headers from `metro.config.js`'s `server.enhanceMiddleware` (the obvious first attempt):** tried it first, and verified directly why it fails: `enhanceMiddleware` only wraps Metro's own middleware, and the root `/` document for `expo start --web` is generated by a different part of Expo's dev server that runs _before_ that hook and fully handles the response itself. Headers set inside `enhanceMiddleware` reliably land on JS bundle requests (confirmed via a debug log) but never once reached the actual page — `self.crossOriginIsolated` stayed `false` no matter what. A reverse proxy sits at the HTTP layer _outside_ Expo's server entirely, so it stamps every response regardless of which internal handler produced it.
- **What this does and doesn't fix, being honest about it:** the proxy genuinely solves the `SharedArrayBuffer` problem — confirmed directly (`crossOriginIsolated: true`, `typeof SharedArrayBuffer === "function"`) after switching to it. It does not, by itself, make `expo-sqlite` web fully work in every browser — see D-009 and D-010, which go further into what was found past this point.
- **Trade-off:** a new dev dependency (`http-proxy`), a new script, and one more moving part in the dev workflow (`web:coi` runs two processes — Metro plus the proxy — instead of one) — all of it strictly for a target platform (web) that was never this project's actual deliverable.

### D-009: Patched `expo-sqlite` web (via `patch-package`) to fall back to an in-memory VFS when a browser lacks `createSyncAccessHandle`

- **Date:** 2026-08-27
- **Decision:** `patches/expo-sqlite+57.0.1.patch` changes `node_modules/expo-sqlite/web/worker.ts` so that, before creating its persistent storage backend (`AccessHandlePoolVFS`), it feature-detects `FileSystemFileHandle.prototype.createSyncAccessHandle` — an OPFS API not every browser implements. If present, behavior is unchanged (real, persistent, OPFS-backed storage). If absent, it registers a plain in-memory `MemoryVFS` (already bundled with `expo-sqlite`, used elsewhere for `:memory:` databases) as the persistent VFS instead, logging a clear warning that data won't survive a reload in that browser. `npm run postinstall` runs `patch-package` automatically, so the patch reapplies after any fresh `npm install` without manual steps.
- **Why patch a third-party package at all, when D-006 rejected something similar for the SQL-migration loader:** that rejection was about avoiding a _worse_ solution to a problem that already had a clean one (Babel plugin). This is different: `expo-sqlite` genuinely has no built-in escape hatch for a browser missing this one specific API — without a patch, every database in a browser like that fails outright rather than degrading. `patch-package` keeps the change small, reviewable in a plain diff, and automatically reapplied — not a silent, unmaintainable fork.
- **What this fixes, precisely:** browsers that support real multi-threaded `SharedArrayBuffer`/`Atomics` sharing (the mechanism D-008's proxy unlocks) but happen not to implement the newer, narrower OPFS sync-access-handle API yet.
- **What this does NOT fix — see D-010:** this patch turned out not to be the reason the sandboxed environment this project was built in still couldn't run the database on web. That's a separate, deeper issue.
- **Trade-off:** one more moving part (a patch file + postinstall step) that needs revisiting on every `expo-sqlite` upgrade — `patch-package` will fail loudly (not silently) if the patch no longer applies cleanly, which is the point.
- **Rejected:** leaving the eager, unconditional `AccessHandlePoolVFS` initialization as-is and just documenting the limitation — rejected because the fix here is small, safe (identical behavior in browsers that support the API), and turns a hard crash into a graceful, clearly-logged degradation for the browsers it does help.

### D-010: The web preview's real, unfixable-from-here blocker is a browser threading gap, not OPFS — diagnosed directly, not guessed

- **Date:** 2026-08-27
- **Decision:** no code change — this is a documented finding, reached by instrumenting `expo-sqlite`'s worker with temporary diagnostic messages (added, verified, then fully removed — never shipped) to see past the generic `"Sync operation timeout"` error. The instrumentation proved: the worker receives the `open` message, successfully initializes wa-sqlite, and successfully returns a result (`handleMessageImpl resolved`) — but the main thread's `Atomics.load()` spin-loop (in `drizzle-orm`'s and `expo-sqlite`'s synchronous worker-call mechanism, `invokeWorkerSync`) never observes the worker's `Atomics.store()` that should signal completion, and eventually gives up.
- **Why this means D-009's OPFS patch, while real and worth keeping, wasn't the actual blocker here:** the timeout happens on _every_ database call, not specifically ones touching persistent storage — and the diagnostic trace shows the worker's actual SQLite work completing fine. The only step that fails is two threads observing the same `SharedArrayBuffer` as truly shared memory, which is a JavaScript-engine-level threading capability, not something any `expo-sqlite`, Drizzle, or Fieldnote code controls.
- **Why this can't be worked around from here:** `drizzle-orm/expo-sqlite`'s entire query execution path (`prepareSync`/`executeSync` — confirmed by reading `session.cjs`) is built on this synchronous worker call. There is no async alternative wired into the Drizzle driver to fall back to — the mismatch would need to be fixed in the browser engine itself, not in application code.
- **Why this very likely won't affect a real desktop browser:** genuine cross-thread `SharedArrayBuffer` sharing is old, foundational, near-universally-correct functionality in any standard Chromium or Firefox build — unlike OPFS's `createSyncAccessHandle`, which is newer and genuinely inconsistent across browsers. Its failure here is far more likely to be specific to this project's sandboxed/embedded preview browser than a general web-platform limitation. `npm run web:coi` has a real chance of working end-to-end in an ordinary up-to-date desktop Chrome or Edge — untested here, since only the sandboxed browser was available while building this.
- **What this changes about D-008's claim:** D-008 originally attributed the remaining gap to the OPFS API specifically. That was a real, verified finding (D-009 fixes it), but not, in the end, the operative cause of the failure in this environment — recorded here rather than quietly edited away, so the actual debugging path stays visible.

### D-013: Repositories fall back to an in-memory mock store when the real database can't open — dev/preview tooling only

- **Date:** 2026-08-27
- **Decision:** `src/db/client.ts` now opens the database inside a `try/catch` instead of letting a failure crash at module load. On failure it sets `dbInitError` and leaves `db` as `null`; `isDbAvailable()`/`requireDb()` are the two functions everything else uses to ask about that state. Every repository (`projects.ts`, `inspections.ts`, `templates.ts`, `outbox.ts`, `seed.ts`) checks `isDbAvailable()` first and, when false, delegates to `src/db/mockStore.ts` — a small, self-contained, in-memory implementation of the same read/create/edit/delete operations, seeded with a handful of realistic rows. `src/app/_layout.tsx` renders the exact same navigation and screens either way, adding only a persistent banner in the fallback case.
- **Why this exists at all:** D-010 established that this project's sandboxed web preview cannot open a real database — a genuine, confirmed browser limitation, not an app bug. Without something to fall back to, that specific environment could not render a single real screen, which defeats the entire purpose of using it to sanity-check UI changes as the app grows. Every other target (Android, iOS, a normal browser) is completely unaffected — `dbInitError` stays `null` there, and every line of this behaves exactly as it did before this decision.
- **Why the fallback lives in the repository layer and not as a separate hand-built mock screen:** a separate mockup screen would need to be manually kept in sync with every real screen change, forever, and would silently go stale — exactly the failure mode a project this document-driven is trying to avoid. Falling back at the data layer means the _real_ screens, routes, and components render — unmodified, automatically staying current as the app grows — with only where their data comes from changing.
- **Why this doesn't call it a day and just fake everything:** mutations that would need a real device to make sense (`updateProject`, `softDeleteProject` — Phase 1 doesn't even expose these in the UI) throw a clear "not available in preview mode" error rather than silently pretending to work. The Settings screen's outbox count reports `0` in this mode rather than a fabricated number, because there genuinely is no outbox — mock mutations don't queue anything to sync, since there's nothing real to sync.
- **Trade-off:** a second, parallel (if much smaller) implementation of each repository's data operations to keep in mind — `src/db/mockStore.ts` is deliberately kept tiny and clearly commented as non-authoritative so this doesn't become "which one is right" confusion later. Also: this can mask a real bug that only manifests against actual SQLite — the banner exists specifically so nobody mistakes preview-mode behavior for a verified real-database result.
- **Rejected:** hand-building a separate, static "preview" screen tree using mock data directly in JSX (goes stale as the app grows — see above); swallowing the error and showing a permanent loading spinner (technically honest, but defeats the entire reason this was requested — being able to see screens as they're built); disabling the whole idea and only ever testing on-device (correct for final verification, but leaves zero way to sanity-check UI changes in this sandboxed environment specifically).
