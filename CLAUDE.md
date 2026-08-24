@AGENTS.md

# Fieldnote

Offline-first field inspection app. React Native (Expo SDK 57), TypeScript strict, Expo Router, SQLite via Drizzle ORM.

## Commands

- `npm start` — dev server (press `a` for Android emulator, `w` for web preview)
- `npm run typecheck` — `tsc --noEmit`; must pass with zero errors before any commit
- `npm run lint` — ESLint (flat config, `eslint-config-expo`)
- `npm run db:generate` — generate a Drizzle migration after editing `src/db/schema.ts`

## Architecture rules — do not break these

- Screens call repositories (`src/repositories/*`). Repositories call Drizzle. Never skip a layer — no Drizzle or SQL imports inside `src/app/` or `src/components/`.
- Every mutation (create/update/soft-delete) runs inside one `db.transaction()` and appends a matching `outbox` row via `appendOutboxEntry()`. Never write to an entity table without also writing its outbox note in the same transaction.
- Reads always filter `isNull(table.deletedAt)`. Never hard-delete a row — soft delete only (`deletedAt` timestamp).
- IDs are UUID v4 from `src/lib/id.ts` (`expo-crypto`), generated on device. Never a server auto-increment.
- Timestamps are epoch milliseconds (`INTEGER`, via `src/lib/time.ts#now()`), never ISO date strings.
- Path alias `@/*` maps to `src/*` — use it instead of relative `../../..` chains.
- Migrations: after any `src/db/schema.ts` change, run `npm run db:generate` and commit the new file(s) under `drizzle/`. Never hand-edit a generated `.sql` migration.
- The `.sql`-import wiring (`babel.config.js` + `metro.config.js`) is load-bearing for migrations to work at all — don't remove either without understanding why both exist (see comments in each file).

## Current phase

**Phase 1 (started 24 Aug 2026): foundation, navigation, offline data layer.**

In scope: project setup, navigation, theme, SQLite + Drizzle schema/migrations, repository layer, seed script, Projects & Inspections lists, inspection create/edit/(soft)delete — all fully offline.

Out of scope — say so and stop if asked to build these, they belong to a later phase:
- Dynamic form rendering / field types, camera, photos, GPS → Phase 2
- Supabase, auth, any network call, sync logic, retry, conflicts → Phase 3
- PDF export, animations/gestures polish, automated tests, CI → Phase 4

## Documentation protocol — mandatory

After ANY code change, before moving on:

1. Add a line-by-line explanation of the new code to `docs/BABY.md`, explaining every symbol as if to a complete beginner.
2. If it's a new capability, add a plain-words entry to `docs/UNDERSTANDING.md` — no jargon, no code.
3. If a decision had real alternatives, add an entry to `docs/DESIGN.md` with the trade-off and what was rejected.
4. If a new convention was set, add it to this file.

Remind the user if they try to move on without this.

## Teaching mode

The user is learning React Native and mobile development through this project — the app is the by-product, the skill is the point. Explain reasoning before writing code. When asked for something, give options and trade-offs first, not just the implementation. Never let a non-trivial change land without the user being able to explain it back.
