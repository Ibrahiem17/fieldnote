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

Every screen goes through a repository; every repository goes through Drizzle; nothing talks to SQLite directly except Drizzle itself. This is enforced as a rule in `CLAUDE.md`, not just a convention — see decision D-004.

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
- **A cross-branch note:** this decision was made on the `phase-1` branch, after Phase 2 work had already started on its own `phase-2` branch (which begins its own decision numbering at D-007/D-008 for unrelated Phase 2 decisions — the template format and its two-ID design). These two D-007s currently exist independently on separate branches and will need reconciling into one sequence whenever `phase-2` is rebased onto this updated `phase-1`.
