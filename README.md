# Fieldnote

**An offline-first field inspection app for teams with no reliable connectivity on-site.**

![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-blue)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57-000020?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

Fieldnote lets an inspector create, fill out, and manage inspections entirely offline — every read and write goes straight to a local SQLite database on the device, with a sync layer designed in from day one (not bolted on later) for when connectivity returns.

Built by **Muhammad Ibrahiem** ([ZYNVEX-CERT-1271](https://github.com/Ibrahiem17)) for the **Zynvex Solutions** internship program.

---

## Table of contents

- [Status](#status)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Architecture principles](#architecture-principles)
- [Database schema](#database-schema)
- [Roadmap](#roadmap)
- [Known issues](#known-issues)
- [Documentation](#documentation)
- [License](#license)

## Status

**Phase 1 — Foundation, Navigation & Offline Data Layer.** Code-complete and verified by static checks (zero TypeScript/lint errors) and a full live pass through the web preview (navigation, filtering, validation, theming — see [`docs/TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md)). Verification on a physical device/emulator — the plan's actual definition of done — is still outstanding; tracked honestly as an open item, not glossed over. Phase 2 (dynamic forms, camera, GPS) is in progress on a separate branch.

## Features

- **Full offline CRUD** — create, edit, and (soft) delete inspections with zero network dependency; every mutation is recorded to an outbox table, ready for Phase 3's sync engine
- **Six-table relational schema** managed through Drizzle ORM migrations — projects, templates, inspections, answers, attachments, outbox
- **Strict repository layer** — screens never touch SQL or Drizzle directly; every database access goes through a typed repository function
- **Expo Router navigation** — a three-tab shell (Projects, Inspections, Settings) plus detail and create screens, all file-based
- **Light & dark theming** from a single design-token file, verified for contrast in both modes
- **Filterable, high-volume lists** — `FlashList`-backed inspection list with project/status filtering and empty states, seed-tested against 500 rows
- **Graceful web preview** — falls back to an in-memory mock store with a clear on-screen banner when the real database can't open in a browser sandbox, so the same real screens stay demoable everywhere (see [Known issues](#known-issues))
- **Documentation-first workflow** — every architectural decision, every meaningful line of code, and every concept in the app is written down (see [Documentation](#documentation))

## Tech stack

| Layer       | Technology                                                            |
| ----------- | --------------------------------------------------------------------- |
| Framework   | React Native + [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) |
| Language    | TypeScript (strict mode)                                              |
| Navigation  | Expo Router (file-based)                                              |
| Database    | SQLite (`expo-sqlite`) via [Drizzle ORM](https://orm.drizzle.team/)   |
| Lists       | Shopify `FlashList`                                                   |
| IDs         | UUID v4, generated on-device (`expo-crypto`)                          |
| Linting     | ESLint (flat config, `eslint-config-expo`)                            |
| Dev tooling | `patch-package`, a custom COI reverse proxy for the web preview       |

## Getting started

### Prerequisites

- Node.js 18+ and npm
- [Expo Go](https://expo.dev/go) on a physical phone, **or** Android Studio for an emulator, **or** a modern desktop browser for the web preview

### Installation

```bash
git clone https://github.com/Ibrahiem17/fieldnote.git
cd fieldnote
npm install
```

### Running it

```bash
npm start
```

Then press `a` for the Android emulator, `i` for iOS simulator (macOS only), or `w` for a plain web preview. For a web preview where the database actually has a chance of working, use `npm run web:coi` instead (see [Known issues](#known-issues) for what it fixes and what it can't).

To install a real dev build on a physical phone:

```bash
npm install -g eas-cli
eas init
eas build --profile development --platform android
```

## Available scripts

| Command               | What it does                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `npm start`           | Start the Expo dev server                                                                    |
| `npm run android`     | Start the dev server and open on a connected Android device/emulator                         |
| `npm run ios`         | Start the dev server and open on an iOS simulator (macOS only)                               |
| `npm run web:coi`     | Web preview through a proxy that adds the headers `expo-sqlite` web needs — see Known issues |
| `npm run typecheck`   | `tsc --noEmit` — must pass with zero errors before any commit                                |
| `npm run lint`        | ESLint over the whole project                                                                |
| `npm run db:generate` | Generate a new Drizzle migration after editing `src/db/schema.ts`                            |

## Project structure

```
src/
  app/                  # Expo Router screens — file path = URL path
    _layout.tsx         # root: theme + migration gate
    (tabs)/              # Projects / Inspections / Settings tab bar
    projects/[id].tsx
    inspections/[id].tsx
    inspections/new.tsx
  components/           # 7 themed UI primitives (Screen, Text, Button, Card, Input, EmptyState, Badge)
  theme/                # design tokens + ThemeProvider
  db/                   # Drizzle schema, SQLite client, migrator, seed script, mock store
  repositories/         # the only files allowed to query the database
  lib/                  # id generation, timestamps
drizzle/                # generated SQL migrations — committed, never hand-edited
patches/                # patch-package fixes applied to node_modules on install
docs/
  DESIGN.md                  # every decision that had a real alternative, and why
  UNDERSTANDING.md           # what the app does, in plain words, no code
  BABY.md                    # every meaningful line of code, explained symbol by symbol
  TEST-RESULTS-PHASE-1.md    # the formal Phase 1 test pass, case by case
  Fieldnote_Phase_1_Plan.md  # the full Phase 1 teaching plan
```

## Architecture principles

These rules are enforced by convention (and checked in code review), not by a linter — they're what keeps an offline-first, sync-ready app from quietly rotting as it grows:

1. **Repository layer only.** Screens and components call functions in `src/repositories/`; nothing outside that folder imports Drizzle or writes SQL.
2. **Soft delete, always.** No row is ever hard-deleted — a `deletedAt` timestamp is set instead, so a deletion that happened offline has something real to sync later.
3. **Outbox on every mutation.** Every create/update/delete runs inside one `db.transaction()` that also appends a matching `outbox` row — the queue Phase 3's sync engine will drain.
4. **Device-generated UUIDs.** IDs are UUID v4, generated on-device — never a server auto-increment, since there may be no server reachable when a row is created.
5. **Epoch-millisecond timestamps.** Every timestamp is a plain `INTEGER`, never an ISO date string — one less parsing ambiguity to carry through a sync pipeline.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full reasoning and the alternatives each of these rejected.

## Database schema

```
projects            templates             inspections
├─ id (uuid, pk)     ├─ id (uuid, pk)      ├─ id (uuid, pk)
├─ name              ├─ name               ├─ project_id ───┐
├─ client_name       ├─ version            ├─ template_id ──┼─┐
├─ address            ├─ schema_json        ├─ title          │ │
├─ latitude/longitude └─ + common columns   ├─ status          │ │
└─ + common columns                        ├─ inspector_name  │ │
                                             ├─ started/        │ │
                                             │  completed_at    │ │
                                             ├─ latitude/lng    │ │
                                             ├─ notes           │ │
                                             └─ + common columns│ │
                        (fk, unenforced) ────────────────────────┘
                        (fk, unenforced) ──────────────────────────┘

answers              attachments            outbox
├─ id (uuid, pk)      ├─ id (uuid, pk)      ├─ id (uuid, pk)
├─ inspection_id      ├─ inspection_id      ├─ entity_type
├─ field_key          ├─ field_key          ├─ entity_id
├─ value_text          ├─ local_uri          ├─ operation
├─ value_number        ├─ remote_url         ├─ payload_json
├─ value_json          ├─ mime_type          ├─ attempts
└─ + common columns    ├─ byte_size          ├─ last_error
                       ├─ width/height       ├─ next_attempt_at
                       └─ + common columns   └─ created_at

common columns (every table above except outbox):
  id · created_at · updated_at · deleted_at (nullable) · sync_status
```

`answers` and `attachments` exist now but are written to starting in Phase 2 — created early so Phase 2 doesn't need its own migration. See [`docs/DESIGN.md`](docs/DESIGN.md) for why each design choice was made.

## Roadmap

| Phase | Scope                                                       | Status                                     |
| ----- | ----------------------------------------------------------- | ------------------------------------------ |
| 1     | Foundation, navigation, offline data layer                  | Code-complete; device verification pending |
| 2     | Dynamic form engine, all field types, camera, GPS stamping  | In progress                                |
| 3     | Supabase sync, auth, conflict resolution, background upload | Planned                                    |
| 4     | PDF export, animation/gesture polish, automated tests, CI   | Planned                                    |

## Known issues

- **No physical-device or emulator test pass yet.** This build was developed and verified (typecheck, lint, a live web-preview pass) in a sandboxed environment without Android Studio or a physical device available. The formal Phase 1 test cases (Section 6.2 of the plan) still need to be executed on a real phone or Android emulator before Phase 1 can be marked done — see [`docs/TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md) for the full, case-by-case status.
- **Web preview may run in "preview mode" (sample data) instead of against a real database, depending on your browser** — see [`docs/DESIGN.md`](docs/DESIGN.md) D-008 through D-014 for the full trail. `npm run web:coi` fixes the `SharedArrayBuffer` requirement and patches an OPFS gap, but this project's own sandboxed dev environment hit a deeper browser-engine threading limitation with no code-level fix — confirmed by direct instrumentation, not guessed. Rather than leave that environment unable to render anything, every repository falls back to an in-memory mock store (`src/db/mockStore.ts`) when the real database can't open: the real screens and navigation render normally, with a persistent "Preview mode" banner, sample data instead of real data, and changes that don't survive a reload. This is very likely unnecessary in an up-to-date desktop Chrome/Edge. None of this touches Android or iOS — both use native on-device SQLite and were never affected. Web was never a target platform for this project.
- **`Alert.alert`'s confirmation dialogs don't fire on React Native Web** (confirmed against `react-native-web`'s own source, not assumed) — so the delete-inspection confirmation can only be exercised on a real device, not through any browser.
- EAS build / install-on-device has not been run yet (needs an Expo account and, ideally, a physical Android phone).

## Documentation

- [`docs/DESIGN.md`](docs/DESIGN.md) — every decision that had a real alternative, and why it went the way it did
- [`docs/UNDERSTANDING.md`](docs/UNDERSTANDING.md) — what the app does, in plain words, no code
- [`docs/BABY.md`](docs/BABY.md) — every meaningful line of code, explained symbol by symbol
- [`docs/TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md) — the formal Phase 1 test pass, case by case

## License

[MIT](LICENSE) © 2026 Muhammad Ibrahiem
