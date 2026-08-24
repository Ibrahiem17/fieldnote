# Understanding Fieldnote

## What this app is

An app for people whose job is to inspect things — buildings, sites, equipment — often in places with no internet. They fill in a checklist, take photos, record where they were. It saves on the phone. When they get signal again, it uploads itself. Phase 1 builds the foundation everything else stands on: nothing a user would call a "feature" yet, just the plumbing.

## The database on the phone

**What it is:** SQLite is a small, complete database living inside the app on the phone — like a filing cabinet the app carries around in its own backpack, rather than one it has to phone up a distant office and ask about.

**Why:** the inspector has no internet. If the app had to ask a server for every screen's data, it wouldn't work at all in the field. So the phone holds the *real* copy of the data; a server copy comes later, in Phase 3.

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

## What Phase 1 deliberately does not do

No cameras, no GPS, no photos, no forms with different field types, no internet calls of any kind, no PDF export. All of that is real, and all of it is planned — just not yet. Phase 1's only job is: can an inspector create, edit and delete an inspection with zero internet connection, and still see exactly what they left when they come back? Everything else is a later phase building on top of that "yes."
