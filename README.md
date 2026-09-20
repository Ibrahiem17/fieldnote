# Fieldnote

**An offline-first field inspection app for teams with no reliable connectivity on-site.**

![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-blue)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57-000020?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-113%20passing-brightgreen)
![CI](https://github.com/Ibrahiem17/fieldnote/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

An inspector fills in a template-driven checklist — text, photos, a signature, a GPS stamp — with zero network coverage. Everything saves to the phone instantly. When connectivity returns, a hand-written sync engine drains an outbox queue, resolves conflicts field-by-field against a documented policy, and uploads photos in the background. A branded PDF report generates fully offline and shares through the native share sheet.

Built by **Muhammad Ibrahiem** ([ZYNVEX-CERT-1271](https://github.com/Ibrahiem17)) for the **Zynvex Solutions** internship program — four phases, 24 Aug – 20 Sep 2026.

**Install:** no production build exists yet — see [Known issues](#known-issues) for exactly why, and what's real instead (a real, currently-green CI pipeline).

---

## Table of contents

- [Status](#status)
- [Why it's interesting](#why-its-interesting)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Architecture principles](#architecture-principles)
- [Database schema](#database-schema)
- [Documentation](#documentation)
- [Known issues](#known-issues)
- [License](#license)

## Status

**All four phases complete**, each tagged (`phase-1-complete`, `phase-2`, `phase-3`, `phase-4`) and documented with a full, honest test-case pass. Nothing in this project claims to be verified without a real check behind it — where that check genuinely couldn't be run (almost always: no physical device, no emulator, or no external account an autonomous build session could create), it says so by name, in the same document, rather than staying silent about it.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation, navigation, offline SQLite data layer | Code-complete. Real-device verification began after Phase 4 (see `docs/TEST-RESULTS-DEVICE.md`) ([`TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md)). |
| 2 | Dynamic form engine, field types, camera, GPS | Code-complete. All ten of the plan's field types shipped (`date` was added last) and a third template — written with zero engine changes — now exists ([`TEST-RESULTS-PHASE-2.md`](docs/TEST-RESULTS-PHASE-2.md)). |
| 3 | Supabase sync engine, auth, RLS, conflict resolution, background upload | Complete and **live-verified against a real Supabase project** — 15/35 test cases, including all three the plan names as proving it worked (by scripts pushing hand-made rows; the real app-to-server path was first exercised on a phone after Phase 4 and found two gaps — see `docs/DESIGN.md` D-038) ([`TEST-RESULTS-PHASE-3.md`](docs/TEST-RESULTS-PHASE-3.md), [`SYNC.md`](docs/SYNC.md)). |
| 4 | PDF reports, performance, animation, accessibility, tests, CI, release | Complete, with an honest split: automated tests and CI are real and live-verified; PDF/sharing/performance/release need a device or an external account this environment never had ([`TEST-RESULTS-PHASE-4.md`](docs/TEST-RESULTS-PHASE-4.md)). |

## Why it's interesting

- **A hand-written sync engine**, not a library — outbox queue, idempotency keys, exponential backoff with jitter, cursor-based pull with resurrection prevention, dead-lettering. [`docs/SYNC.md`](docs/SYNC.md) is the single most technically detailed document in this repository.
- **Field-level conflict resolution with an explicit, tested policy** — different fields merge silently; the same field within a 60-second window is flagged for a person to decide; a delete always beats an older edit. `resolveConflict` is a pure function with 7 unit tests, one of which is a deliberately-broken-then-fixed proof that the tests actually catch a real regression.
- **Schema-driven forms** — a template is plain JSON; the form engine, validation, and conditional-field visibility all derive from it. Three templates ship; the third ("Site Safety Walk") was added with no change to the renderer, validator or report code — the plan's "zero code changes" claim, run and guarded by tests (`docs/DESIGN.md` D-040). Built-in templates are ensured at every startup, so a fresh install has them.
- **Background photo uploads on-device**, with a three-step atomic-per-attempt sequence (row → file bytes → `remote_url` follow-up) so a killed app mid-upload retries cleanly instead of leaving a lie behind.
- **A real, currently-green CI pipeline** ([workflow](.github/workflows/ci.yml)) — typecheck, lint, and 113 automated tests on every push, verified live by watching an actual run fail on a deliberate type error and recover.
- **What's deliberately not claimed:** measured performance numbers (Phase 4's own rules require real hardware to produce them honestly — none exists here, so `PERFORMANCE.md` says so instead of inventing any), and a shipped production build (needs a real Expo/Apple/Google account this build session could not create).

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | React Native + [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) |
| Language | TypeScript (strict mode) |
| Navigation | Expo Router (file-based) |
| Local database | SQLite (`expo-sqlite`) via [Drizzle ORM](https://orm.drizzle.team/) |
| Backend | [Supabase](https://supabase.com/) — Postgres, Auth, Row Level Security, Storage |
| Lists | Shopify `FlashList` |
| Animation / gesture | `react-native-reanimated` + `react-native-gesture-handler` |
| PDF | `expo-print` (HTML → PDF) + `expo-sharing` |
| Testing | Jest (plain `node` environment — see [Known issues](#known-issues) for why not `jest-expo`) |
| Crash reporting | `@sentry/react-native`, gated on a DSN this environment never had one to configure |
| CI | GitHub Actions |
| IDs | UUID v4, generated on-device (`expo-crypto`) |

## Getting started

### Prerequisites

- Node.js 24+ and npm
- [Expo Go](https://expo.dev/go) on a physical phone, **or** Android Studio for an emulator, **or** a modern desktop browser for the web preview
- A [Supabase](https://supabase.com/) project (free tier is enough) if you want sync/auth to actually work — the app runs fully offline without one, it just won't sync

### Installation

```bash
git clone https://github.com/Ibrahiem17/fieldnote.git
cd fieldnote
npm install
cp .env.example .env   # fill in your own Supabase project's URL/anon key
```

### Running it

```bash
npm start
```

Then press `a` for the Android emulator, `i` for iOS simulator (macOS only), or `w` for a plain web preview. For a web preview where the local database has the best chance of actually opening, use `npm run web:coi` instead (see [Known issues](#known-issues)).

## Available scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Start the dev server and open on a connected Android device/emulator |
| `npm run ios` | Start the dev server and open on an iOS simulator (macOS only) |
| `npm run web:coi` | Web preview through a proxy adding the headers `expo-sqlite` web needs |
| `npm run typecheck` | `tsc --noEmit` — must pass with zero errors before any commit |
| `npm run lint` | ESLint over the whole project |
| `npm test` | Jest — 113 tests: the sync engine, conflict resolution, backoff, validation, visibility, dates and number input, template ids and migrations, report HTML, and repository integration tests (projects, templates, answers) |
| `npm run db:generate` | Generate a new Drizzle migration after editing `src/db/schema.ts` |

## Project structure

```
src/
  app/                  # Expo Router screens — file path = URL path
    _layout.tsx         # root: Sentry init, gesture root, error boundary, auth gate, migrations
    (tabs)/              # Projects / Inspections / Settings tab bar
    projects/[id].tsx
    inspections/[id].tsx # detail, edit, generate report, swipe-to-delete
    inspections/new.tsx
  components/           # themed UI primitives + FormRenderer, PhotoViewer, ErrorBoundary, SignaturePad
  theme/                # design tokens + ThemeProvider
  db/                   # Drizzle schema, SQLite client, migrator, seed script, mock store
  repositories/         # the only files allowed to query the database
  lib/                  # sync engine, conflict resolution, backoff, validation, report generation,
                         # visibility rules, Sentry, id/time helpers — most of this project's real logic
  auth/                 # Supabase auth provider + login screen
drizzle/                # generated SQL migrations — committed, never hand-edited
supabase/migrations/    # the Postgres schema, RLS policies, sync_push RPC
patches/                # patch-package fixes applied to node_modules on install
.github/workflows/      # CI — typecheck, lint, test on every push
docs/
  SYNC.md                     # the sync protocol — push, pull, conflict policy, worked examples
  DESIGN.md                   # every decision that had a real alternative, and why (32 entries)
  UNDERSTANDING.md            # what the app does, in plain words, no code
  BABY.md                     # every meaningful line of code, explained symbol by symbol
  PERFORMANCE.md              # Day 3's honest record: blocked, and why, with two named hypotheses
  TEST-RESULTS-PHASE-{1,2,3,4}.md
```

## Architecture principles

Enforced by convention and code review, not a linter — the rules that keep an offline-first, sync-ready app from quietly rotting as it grows:

1. **Repository layer only.** Screens and components call functions in `src/repositories/`; nothing outside that folder imports Drizzle or writes SQL.
2. **Soft delete, always.** No row is ever hard-deleted — a `deletedAt` timestamp is set instead, so an offline deletion has something real to sync later.
3. **Outbox on every mutation.** Every create/update/delete runs inside one `db.transaction()` that also appends a matching `outbox` row.
4. **Device-generated UUIDs.** Never a server auto-increment — a row must be creatable with no server reachable.
5. **Epoch-millisecond timestamps**, never ISO strings — and **server timestamps only** for conflict resolution, never a device's own clock (the single rule most likely for a careless change to accidentally break — see `docs/SYNC.md` §2.8).
6. **One door per external service** — `src/lib/supabase.ts` is the only place `createClient()` is called; `src/lib/sentry.ts` is the only place the Sentry SDK is touched. A service either has exactly one entry point or it isn't done.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full reasoning and every alternative rejected along the way.

## Database schema

```
projects            templates             inspections
├─ id (uuid, pk)     ├─ id (uuid, pk)      ├─ id (uuid, pk)
├─ name              ├─ name               ├─ project_id ───┐
├─ client_name       ├─ version            ├─ template_id ──┼─┐
├─ address           ├─ schema_json        ├─ title          │ │
├─ latitude/longitude└─ + common columns   ├─ status          │ │
├─ notes                                    ├─ inspector_name  │ │
└─ + common columns                         ├─ started/        │ │
                                             │  completed_at    │ │
                                             ├─ latitude/lng    │ │
                                             ├─ notes           │ │
                                             └─ + common columns│ │
                        (fk, unenforced) ────────────────────────┘
                        (fk, unenforced) ──────────────────────────┘

answers              attachments            outbox              sync_state / conflicts
├─ id (uuid, pk)      ├─ id (uuid, pk)      ├─ id (uuid, pk)     (Phase 3 — the pull cursor
├─ inspection_id      ├─ inspection_id      ├─ entity_type       and flagged manual-resolution
├─ field_key          ├─ field_key          ├─ entity_id         rows; see docs/SYNC.md)
├─ value_text         ├─ local_uri (nullable)├─ operation
├─ value_number       ├─ remote_url         ├─ payload_json
├─ value_json         ├─ mime_type          ├─ attempts
└─ + common columns   ├─ byte_size          ├─ last_error
                      ├─ width/height       ├─ next_attempt_at
                      └─ + common columns   └─ created_at

common columns (every table above except outbox/sync_state/conflicts):
  id · created_at · updated_at · deleted_at (nullable) · sync_status
```

Mirrored on Supabase (`supabase/migrations/`) with `owner_id` and a trigger-set `server_updated_at` added to every owned table — the one timestamp conflict resolution is ever allowed to trust. See [`docs/DESIGN.md`](docs/DESIGN.md) and [`docs/SYNC.md`](docs/SYNC.md) for why.

## Documentation

- [`docs/SYNC.md`](docs/SYNC.md) — the sync protocol: push, pull, the conflict policy with worked examples, the four questions an interviewer would actually ask
- [`docs/DESIGN.md`](docs/DESIGN.md) — every decision that had a real alternative, and why it went the way it did (32 entries, D-001 through D-032)
- [`docs/UNDERSTANDING.md`](docs/UNDERSTANDING.md) — what the app does, in plain words, no code
- [`docs/BABY.md`](docs/BABY.md) — every meaningful line of code, explained symbol by symbol
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — the honest record of Day 3: blocked, why, and two named hypotheses for whoever eventually has a device
- [`docs/TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md) / [`-2`](docs/TEST-RESULTS-PHASE-2.md) / [`-3`](docs/TEST-RESULTS-PHASE-3.md) / [`-4`](docs/TEST-RESULTS-PHASE-4.md) — the formal test pass for each phase, case by case

## Known issues

Being honest about these is the point, not an afterthought — a documented limitation reads as maturity; a hidden one reads as carelessness when someone finds it.

- **No production build exists, and no install link exists.** `eas build` needs a real Expo account login and real Apple/Google signing credentials — none of which an autonomous build session can create on its own. `eas.json` and the version/build numbers a real build needs are in place; the build itself has never been run.
- **A physical device was only available after all four phases were built.** A Samsung A51 (Android 13) was first attached after Phase 4; the results are in [`docs/TEST-RESULTS-DEVICE.md`](docs/TEST-RESULTS-DEVICE.md). Verified on it so far: install and launch, session and data persistence across force-quit, camera capture and photo size, a real GPS fix, the location-denied path, signature capture, and a deep link with the app running. That first hands-on run found and fixed six real bugs that the web preview and automated tests could not see (see `docs/DESIGN.md` D-033–D-037). **Still not verified on a device:** airplane-mode sync end to end, the PDF report actually rendering and sharing, a deep link with the app fully closed, performance measurement, swipe/pinch gesture feel, and a screen-reader run. Earlier phases' `TEST-RESULTS` files still record those as blocked, because they were written before a device existed.
- **Seeded (dev-fixture) data never syncs.** "Reset & Reseed" writes no outbox entries by design, so seeded projects and the inspections inside them stay on the phone. Real projects come from the **New Project** screen (added after the first device run, `docs/DESIGN.md` D-039 — built and typechecked, first on-device run still pending).
- **Airplane-mode sync, end to end, is not yet verified.** After the D-038 fixes an app-created project reached Supabase (confirmed in the dashboard); the offline-create-then-reconnect inspection test was started and is pending a repeat.
- **Photo size is not hard-capped.** Photos are resized to a 1600 px long edge at JPEG quality 0.7, not compressed to a target size; the one photo measured after the fix was about 124 KB, but a very detailed scene could still exceed 300 KB.
- **GPS uses "balanced" accuracy** (measured about 100 m on the test phone), not high accuracy — adequate for stamping a site, not for sub-10 m needs.
- **No Sentry account exists**, so crash reporting is installed and wired (`src/lib/sentry.ts`) but has never sent a real report — gated on an unset `EXPO_PUBLIC_SENTRY_DSN`, a deliberate no-op rather than a silent gap.
- **`date` fields are typed, not picked.** All ten of the plan's field types now exist (`text`, `longtext`, `number`, `select`, `multiselect`, `boolean`, `date`, `photo`, `gps`, `signature`), and `visibleIf` supports `in`, `equals` and `notEmpty`. But a date is entered as digits (`YYYY-MM-DD`, hyphens inserted automatically) rather than through a native calendar, because a picker needs a new native module and therefore a new build (`docs/DESIGN.md` D-041). `rating` (mentioned in the Phase 4 plan) was never built.
- **A third template proving the form engine needs zero code changes for a new inspection type was never authored** — the plan's own explicit test for whether Phase 2 succeeded, still open.
- **Web preview may run in "preview mode" (sample data) instead of against a real database, depending on your browser** — see [`docs/DESIGN.md`](docs/DESIGN.md) D-008 through D-014. Every repository falls back to an in-memory mock store when the real database can't open, so the real screens still render with a persistent "Preview mode" banner. Android and iOS use native on-device SQLite and were never affected — web was never a target platform.
- **Runtime validation is hand-rolled, not Zod**, despite the original plan specifying Zod — a deliberate, working choice, just never written down until this project's own mid-Phase-4 audit caught the gap (`docs/DESIGN.md` D-027).

## License

[MIT](LICENSE) © 2026 Muhammad Ibrahiem
