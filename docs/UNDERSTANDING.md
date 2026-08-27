# Understanding Fieldnote

## What this app is

An app for people whose job is to inspect things — buildings, sites, equipment — often in places with no internet. They fill in a checklist, take photos, record where they were. It saves on the phone. When they get signal again, it uploads itself. Phase 1 builds the foundation everything else stands on: nothing a user would call a "feature" yet, just the plumbing.

## The database on the phone

**What it is:** SQLite is a small, complete database living inside the app on the phone — like a filing cabinet the app carries around in its own backpack, rather than one it has to phone up a distant office and ask about.

**Why:** the inspector has no internet. If the app had to ask a server for every screen's data, it wouldn't work at all in the field. So the phone holds the _real_ copy of the data; a server copy comes later, in Phase 3.

**Why not just a box of saved settings (AsyncStorage):** that's fine for "dark mode: on," but useless for "show me every incomplete inspection for this project, newest first." Real questions like that need a real database that can filter and sort, not a pile of sticky notes.

## Why every record gets a random ID made on the phone

**Plain words:** every project and every inspection needs a unique name-tag so nothing gets confused with anything else. Normally a server hands these out in order — 1, 2, 3. But our inspector has no signal, so there's no one there to hand one out. Instead, the phone invents a tag so long and so random that it will essentially never collide with a tag any other phone invents.

## Why deleting doesn't really delete

**Plain words:** when you delete an inspection, the app doesn't erase it. It ticks a box on that row saying "deleted on this date," and hides it from every list you look at.

**Why:** if the row were truly wiped while offline, the server would never find out that inspection had existed and then vanished — from the server's point of view, nothing happened, so on the next sync the inspection could come right back. The tick-box is a note we carry forward, ready to send later, that says "this one is gone." That's a job for Phase 3 — Phase 1 just makes sure the note gets written now, so nothing has to be rebuilt later.

## The outbox

**Analogy:** a tray of letters waiting to be posted. Every time something changes — a new inspection, an edited title, a delete — a note describing that change drops into the tray, at the exact same moment as the change itself. Nothing empties the tray yet; that's Phase 3's postman. Phase 1 fills it in advance so there's work waiting for him.

**Why build the tray now, when no postman exists yet:** because every single place in the app that changes data has to remember to drop a note in the tray. If that habit isn't built in from day one, someone (future us) will eventually add a way to change data that forgets the note — and that change will simply never make it to the server, with nothing on screen ever looking wrong.

## Why only one part of the app is allowed to touch the database

**Analogy:** one desk in the office may open the filing cabinet. Everyone else who needs something from it asks that desk. If the rule for using the cabinet ever changes — say, "from now on, always leave a note when you take something out" — there's exactly one desk to retrain, not everyone in the building.

**Plain words:** screens (what you see and tap) never talk to the database directly. They ask a small set of "repository" functions — `listInspections`, `createInspection`, and so on — to do it for them. Those functions are the only code in the whole app that knows SQLite exists.

## Why the app waits with a spinner before showing anything

**Plain words:** the very first time the app opens on a phone (or after an update), the database file might be missing a table or column the new version of the app expects. Before any screen is allowed to show up, the app quietly brings the database up to date — this is called "running migrations." Only once that's finished does the app let you see anything, so no screen ever tries to ask a table a question before that table exists.

## Why the seed data is 500 rows and not 5

**Plain words:** a list of five inspections looks fast no matter how the code is written — there just isn't enough there to be slow. Filling the database with 500 fake inspections up front means any real slowness shows up immediately, on a normal phone, while it's still cheap to fix — instead of showing up for the first time months later when a real inspector has piled up hundreds of real ones.

## Why light and dark mode both matter from day one

**Plain words:** the phone's system setting can be light or dark, and the app has to look correct — readable text, no white writing hiding on a white background — in both, because the user's phone might be in either at any moment. Building both from the start (one file of colours, per Section — `tokens.ts`) means there's never a scramble later to retrofit a second look onto components that only ever expected one.

## The second migration — proving an upgrade doesn't erase anything

**Plain words:** the first migration built the database's tables from nothing — easy, because there was nothing there to lose. The real test is the _second_ migration: adding a new field (a `notes` field on projects) to an app that a device already has real, seeded data sitting inside. If that upgrade were done wrong, it could wipe the table clean and start over, silently deleting every project and inspection an inspector had already saved.

**What was actually done:** the new field was added in a way that doesn't demand anything from rows that existed before it — it's allowed to simply be empty for them, rather than requiring every old row be rewritten with a value it never had. That's _why_ it's allowed to be empty: it's the difference between "grow the filing cabinet by adding a drawer" and "empty the whole cabinet onto the floor and refile everything."

**Being honest about what's not yet confirmed:** having the growing-a-drawer _kind_ of migration is not the same as having _proven_, on a real phone, that a device with real saved data survives having this update installed over it. That check still needs an actual device — it's recorded as still outstanding in `docs/TEST-RESULTS-PHASE-1.md` rather than assumed to be fine because the code looks right.

## What Phase 1 deliberately does not do

No cameras, no GPS, no photos, no forms with different field types, no internet calls of any kind, no PDF export. All of that is real, and all of it is planned — just not yet. Phase 1's only job is: can an inspector create, edit and delete an inspection with zero internet connection, and still see exactly what they left when they come back? Everything else is a later phase building on top of that "yes."

## Why the web preview needed its own little proxy

**Plain words:** the app's phone database only fully works, in a web browser, if that browser has unlocked a fairly advanced capability that most browsers keep switched off by default, for safety reasons. Turning it on requires the app's server to send back two specific labels with every page it delivers, saying "yes, I understand the risks, unlock it for me." Our dev server doesn't send those labels by default, and — this took real digging to find — the one obvious place to add them turned out not to work, because a _different_ part of the same dev server hands out the actual page before that fix ever gets a chance to run.

**What fixed it:** instead of trying to edit the dev server from the inside, a small helper program was added that sits _in front of_ it — every request to the app goes through this helper first, which quietly stamps both labels onto the reply before passing it on to the browser, no matter which part of the dev server actually produced that reply.

**Why this doesn't mean the web preview fully works now:** even with both labels correctly in place, the phone-database library still needs the browser itself to support one more specific, fairly new capability for actually reading and writing files efficiently — and not every browser has it yet. Confirmed directly: the sandboxed browser used for building this project doesn't. A normal, up-to-date desktop browser very likely does. Either way, this only ever affected the web preview used for double-checking screens during development — the real app, on an actual phone, was never touched by any of this.
