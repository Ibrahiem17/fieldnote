# Fieldnote

Offline-first field inspection & reporting app. React Native (Expo SDK 57), TypeScript strict, Expo Router, SQLite via Drizzle ORM.

Built by Muhammad Ibrahiem (ZYNVEX-CERT-1271) for the Zynvex Solutions Batch 3 internship. See [`docs/Fieldnote_Phase_1_Plan.md`](docs/Fieldnote_Phase_1_Plan.md) for the full teaching plan this build follows.

**Current phase: Phase 1 — Foundation, Navigation & Offline Data Layer.**

## What's here

- Expo Router navigation: three tabs (Projects, Inspections, Settings) plus project/inspection detail and create screens
- SQLite database via Drizzle ORM — six tables, migrations, a typed repository layer
- Full offline CRUD for inspections: create, edit, (soft) delete — all through the repository layer, all recorded to an outbox table for Phase 3's sync engine
- Seven themed UI primitives, light/dark mode from one token file
- A dev-only reset-and-reseed tool (Settings tab) that fills the database with 8 projects, 3 templates and 500 inspections

## Running it

```bash
npm install
npm start
```

Then press `a` for the Android emulator, `i` for iOS simulator (macOS only), or `w` for a web preview (see **Known issues** below — web can't run the real database yet).

To install a real dev build on a physical phone (required for Phase 1's definition of done — see plan Section 1.2):

```bash
npm install -g eas-cli
eas init
eas build --profile development --platform android
```

### Other commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` — must pass with zero errors |
| `npm run lint` | ESLint over the whole project |
| `npm run db:generate` | Generate a new Drizzle migration after editing `src/db/schema.ts` |

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
  db/                   # Drizzle schema, SQLite client, migrator, seed script
  repositories/         # the only files allowed to query the database
  lib/                  # id generation, timestamps
drizzle/                # generated SQL migrations — committed, never hand-edited
docs/
  DESIGN.md             # decisions & why, with trade-offs
  UNDERSTANDING.md       # what the app does, in plain words, no code
  BABY.md                 # every meaningful line of code, explained symbol by symbol
  Fieldnote_Phase_1_Plan.md   # the full Phase 1 teaching plan
```

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

## Known issues

- **No physical-device or emulator test pass yet.** This build was developed and verified (typecheck, lint, Metro bundling) in a sandboxed environment without Android Studio or a physical device available. The formal Phase 1 test cases (Section 6.2 of the plan) still need to be executed on a real phone or Android emulator per Section 0.6.5 before Phase 1 can be marked done — see [`docs/TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md) for status.
- **Web preview cannot open the database.** `npm run web` bundles and boots the app, but `expo-sqlite`'s web backend needs `SharedArrayBuffer` (browser cross-origin isolation headers), which the local preview doesn't provide. This only affects the web target — Android and iOS use native on-device SQLite and are unaffected. Web was never a target platform for this project; it was used here only to verify the JS bundles and boots without errors.
- EAS build / install-on-device has not been run (needs an Expo account and, ideally, a physical Android phone).

## Documentation

- [`docs/DESIGN.md`](docs/DESIGN.md) — every decision that had a real alternative, and why it went the way it did
- [`docs/UNDERSTANDING.md`](docs/UNDERSTANDING.md) — what the app does, in plain words, no code
- [`docs/BABY.md`](docs/BABY.md) — every meaningful line of code, explained symbol by symbol
- [`docs/TEST-RESULTS-PHASE-1.md`](docs/TEST-RESULTS-PHASE-1.md) — the formal Phase 1 test pass
