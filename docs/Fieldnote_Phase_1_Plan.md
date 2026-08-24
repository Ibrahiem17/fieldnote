# Fieldnote — Phase 1
## Foundation, Navigation & Offline Data Layer

**Muhammad Ibrahiem · ZYNVEX-CERT-1271**
**Window:** Mon 24 Aug 2026 → Sun 30 Aug 2026, submit by 4:00 PM
**Deliverable:** Installable dev build with complete offline CRUD surviving app restart.

---

# SECTION 0 — READ THIS FIRST

## 0.1 The teaching contract

This document follows one rule, and it applies to every phase document in this project:

> **No line of code, no command, and no concept appears without being explained.**

Every technical thing you meet is broken into four parts:

| Part | Question it answers |
|---|---|
| **What it is** | In plain words, as if to someone non-technical |
| **Why we need it** | What breaks in *this* project if we don't have it |
| **Syntax** | The shape of the code, piece by piece |
| **Use it yourself** | How you'd apply the same thing in a different project |

If you hit something in this document you can't explain out loud to another person, that's a gap — write it into `UNDERSTANDING.md` (Section 0.4.3) in your own words until you can.

### 0.1.1 A note on terminology

Some words appear before their full explanation. Every one is defined in the glossary at **Section 0.5**. When you meet a term you don't know, jump there first.

---

## 0.2 Understanding Claude Code

You'll build this with Claude Code, so you need to understand what it is and how it works — otherwise it writes code you don't understand, which defeats the purpose of the internship.

### 0.2.1 What Claude Code is

**What it is:** a coding assistant that runs in your terminal (the text window where you type commands). Unlike a chat window, it can *read your project's files, edit them, and run commands*. It works inside your actual project folder rather than looking at pasted snippets.

**Why it matters:** it sees your whole codebase. When you ask "why is my list slow," it can open the file and look instead of guessing.

**The risk:** it's fast enough that you can finish the week with a working app you don't understand. Section 0.2.6 is how you avoid that.

### 0.2.2 Installing it

Installation details change, so treat the official documentation as the authority rather than any tutorial — including this one:

- **Docs:** https://code.claude.com/docs/en/overview
- **Command reference:** https://code.claude.com/docs/en/commands

Once installed, start it by moving into your project folder and running it:

```bash
cd fieldnote      # move into the project folder
claude            # start Claude Code inside it
```

**Why `cd` first:** Claude Code reads the folder you launch it from. Launch from the wrong place and it can't see your project. Always launch from the project root — the folder containing `package.json`.

### 0.2.3 The commands you'll actually use

Commands start with `/` and are typed inside a running session. Type `/` alone to see what's available.

<cite index="13-1">Most commands are useful at a specific point in a session, from setting up a project to shipping a change.</cite> These are the ones that matter for Phase 1:

| Command | What it does | When you'll use it |
|---|---|---|
| `/init` | <cite index="13-1">Initializes the project with a `CLAUDE.md` guide</cite> | Day 1, once |
| `/memory` | <cite index="13-1">Edits `CLAUDE.md` files</cite> | Whenever you add a project rule |
| `/plan` | <cite index="13-1">Enters plan mode</cite> — proposes an approach before touching files | Before every non-trivial task |
| `/context` | <cite index="13-1">Visualizes current context usage as a colored grid</cite> | When answers start feeling vague |
| `/compact` | <cite index="13-1">Frees up context by summarizing the conversation so far</cite> | When `/context` shows you're nearly full |
| `/clear` | <cite index="13-1">Starts a new conversation with empty context</cite> | Starting a genuinely new task |
| `/diff` | <cite index="13-1">Opens an interactive diff viewer showing uncommitted changes</cite> | Before every commit |
| `/rewind` | <cite index="13-1">Rewinds the conversation and/or code to a previous point</cite> | When a change went badly wrong |
| `/permissions` | <cite index="13-1">Manages allow, ask, and deny rules for tool permissions</cite> | Day 1 setup |
| `/doctor` | <cite index="13-1">Runs a setup checkup that diagnoses issues and can fix them</cite> | When something's broken and you don't know why |

**The distinction that trips people up:** `/clear` wipes the conversation but keeps your `CLAUDE.md` rules. `/compact` keeps the conversation but shrinks it. Use `/clear` between unrelated tasks, `/compact` mid-task.

### 0.2.4 How CLAUDE.md works

**What it is:** a plain markdown file in your project root that Claude Code reads automatically at the start of every session. The project's permanent briefing.

**Why it matters:** without it, every session starts from zero and you re-explain your conventions each time. With it, Claude knows your rules before you type anything.

**How to create it:** run `/init` on Day 1 — <cite index="13-1">it initializes the project with a `CLAUDE.md` guide</cite> by scanning your project. Then refine by hand or with `/memory`.

**The critical warning:** this file loads into context on *every* session. Long, stale or vague content actively costs you, because it eats the room Claude needs for your actual code. Keep it short and current. When a rule stops being true, delete it that day.

### 0.2.5 Plan mode — your most important habit

**What it is:** `/plan` puts Claude into a mode where it researches and proposes an approach *without editing files*. You read it, approve or correct it, and only then does it write code.

**Why this matters more for you than for most people:** you're here to learn. If Claude silently writes 200 lines, you've gained a file and learned nothing. If it explains first, you get to think, disagree, and understand the result.

**The habit:**

```
/plan add the inspections table to the Drizzle schema
```

Read the plan. Ask *"why did you choose X over Y?"* **before** approving. That question is where the learning happens.

### 0.2.6 How to prompt it so you actually learn

The difference between finishing with a skill and finishing with a folder:

| Instead of | Ask |
|---|---|
| "Write the inspections repository" | "Write it, then explain each function and why the transaction wraps both writes" |
| "Fix this error" | "Explain what this error means and what caused it, then propose a fix" |
| "Add sync status" | "What are my options for tracking sync status? Compare them, then recommend one" |
| "Make the list faster" | "Profile this list, tell me what's actually slow, and explain why before changing anything" |

**The rule worth keeping:** never accept code you can't explain. If Claude writes something you don't follow, ask about that specific line before moving on. Two minutes now, versus a Phase 3 spent debugging a sync engine that might as well have been written by a stranger.

### 0.2.7 Permissions

Claude Code asks before running commands that change things. Run `/permissions` on Day 1 to review the rules.

**Keep confirmations on for anything destructive** — deleting files, force-pushing to git, resetting the database. The speed gained from auto-approving everything is not worth losing a day's work.

---

## 0.3 How this document is structured

| Section | Contents |
|---|---|
| 0 | The contract, Claude Code, the four documents, the standing rules, glossary |
| 1 | What Phase 1 is for, definition of done, scope |
| 2 | Every concept explained before you use it |
| 3 | Day-by-day plan (3.1 → 3.7), each ending with "see it running" |
| 4 | The database schema, column by column |
| 5 | The repository layer |
| 6 | Verification: acceptance checklist and formal test cases |
| 7 | Risks |
| 8 | Handoff to Phase 2 |

**Sections 0.4, 0.6 and 6 are identical in every phase document.** They are the standing rules of the project, not Phase 1 specifics.

---

## 0.4 The four living documents

Create these in the project root **before writing any code**. Each has a different reader and a different job. They never overlap.

| File | Reader | Question it answers | Contains code? |
|---|---|---|---|
| `CLAUDE.md` | Claude Code | What are this codebase's rules? | No |
| `DESIGN.md` | Future you, and interviewers | *Why* is it built this way? | Rarely |
| `UNDERSTANDING.md` | You, having forgotten everything | What did I build, in plain words? | No |
| `BABY.md` | A complete beginner | What does each line of code actually say? | Yes, all of it |

**The distinction that matters most** is between the last two. `UNDERSTANDING.md` never shows code — it explains ideas ("deleting doesn't really delete, because…"). `BABY.md` is nothing but code, explained symbol by symbol ("`const` means a box whose name can't be pointed at something else"). One teaches the reasoning, the other teaches the language.

Where they should live:

```
fieldnote/
  CLAUDE.md              ← project root, so Claude Code finds it automatically
  README.md
  docs/
    DESIGN.md
    UNDERSTANDING.md
    BABY.md
```

`CLAUDE.md` must sit in the root — that's where Claude Code looks. The other three go in `docs/` to keep the root clean. Link to all of them from `README.md`.

Budget 30 minutes to create the skeletons. These are never "finished" — see the update protocol in 0.4.5.

### 0.4.1 DESIGN.md — the decisions record

**What it is:** a log of every choice that had a real alternative, with the reasoning.

**Why:** in an interview, "why did you do it that way?" is always the follow-up. The answer lives here. It also stops you re-litigating the same decision in week three.

```markdown
# Fieldnote — Design & Architecture

## Problem
Field inspectors work where there is no network. Most apps treat offline as an
error state. Fieldnote treats the device as the source of truth.

## Architecture
Screens → Repositories → Drizzle → SQLite
                                     ↓ (Phase 3)
                              Sync engine → Supabase

## Decision log

### D-001: Device-generated UUIDs instead of server auto-increment
- **Date:** 2026-08-27
- **Decision:** IDs are UUID v4 created on the phone.
- **Why:** An offline inspector must create records with permanent IDs.
  Server-issued IDs require a server, which we don't have offline.
- **Trade-off:** Larger keys, marginally slower indexes.
- **Rejected:** Auto-increment (impossible offline); server-reserved ID blocks
  (needs connectivity to refill, more complex).
```

**Update rule:** if you weighed two options, that's an entry. Write it the same day.

### 0.4.2 CLAUDE.md — the rules file

**What it is:** covered in Section 0.2.4. Generate the skeleton with `/init`, then shape it:

```markdown
# Fieldnote

Offline-first field inspection app. React Native (Expo), TypeScript strict.

## Commands
- `npm start` — dev server
- `npx tsc --noEmit` — typecheck; must pass before any commit
- `npm run db:generate` — generate a Drizzle migration

## Architecture rules — do not break these
- Screens call repositories. Repositories call Drizzle. Never skip a layer.
- No SQL or Drizzle imports inside `src/app/` or `src/components/`.
- Every mutation runs in a transaction and appends an `outbox` row.
- Reads always filter `deleted_at IS NULL`.
- Never hard-delete. Soft delete only.
- IDs are UUID v4 from `expo-crypto`, generated on device.
- Timestamps are epoch milliseconds (INTEGER), never ISO strings.

## Current phase
Phase 1 (24–30 Aug): foundation, navigation, offline data layer.
Out of scope: forms, camera, GPS, networking, sync, PDF.
If asked to build these, say they belong to a later phase.

## Teaching mode
I am learning React Native. Explain your reasoning before writing code.
When I ask for something, tell me the options and trade-offs first.
```

That last section is doing real work — it changes how Claude responds to you all week.

### 0.4.3 UNDERSTANDING.md — the plain-words file

**The most valuable of the three**, and the one you'll be tempted to skip.

**Hard rules:**
1. No unexplained jargon — every term gets a plain one-line definition on first use.
2. Explain the *why*, never the syntax. Not "we call `db.insert()`" but "we save it to the phone first so it works with no internet."
3. Use analogies. They're what you'll actually remember.
4. Write for someone who is not a developer.

```markdown
# Understanding Fieldnote

## What this app is
An app for people whose job is to inspect things — buildings, sites, equipment —
in places with no internet. They fill in a checklist, take photos, record where
they were. It saves on the phone. When they get signal, it uploads itself.

## Phase 1 — what I built and why

### The database on the phone
**What it is:** SQLite is a small database living inside the app on the phone —
like a filing cabinet the app carries around, rather than one it has to phone up
and ask about.

**Why:** the inspector has no internet. If the app had to ask a server for data,
it wouldn't work at all. So the phone holds the real copy; the server gets a copy
later.

### Why every record gets a random ID made on the phone
**Plain words:** every inspection needs a unique name-tag. Normally a server hands
these out in order — 1, 2, 3. But our inspector is offline, so nobody's there to
hand one out. Instead the phone invents a random tag so long it will never
accidentally match anyone else's.

### Why deleting doesn't really delete
**Plain words:** when you delete an inspection we don't erase it. We tick a box
saying "deleted on this date" and hide it from the list.

**Why:** if we truly erased it while offline, the server would never learn it had
existed and vanished — it would just reappear on the next sync. The tick-box is a
note we send later saying "this one is gone."

### The outbox
**Analogy:** a tray of letters waiting to be posted. Every change drops a note in
the tray. Nothing empties the tray yet — that's Phase 3's job. We fill it in
advance so the postman has work waiting.
```

**Update rule:** the same day you build something, add its entry. Never let it fall more than a day behind — writing it later means writing from memory, which is exactly what it exists to prevent.

### 0.4.4 BABY.md — the line-by-line file

**What it is:** every meaningful piece of code in the project, explained one symbol at a time, as if to someone who has never programmed.

**Why it exists:** `UNDERSTANDING.md` tells you *why* we soft-delete. It doesn't tell you what `?? "light"` means, or why some lines end in a semicolon, or what the arrow in `=>` does. Those are the things that actually stop a beginner from reading their own codebase.

**Who it's for:** a person joining this project with no React Native experience — and you, three weeks from now, staring at a line you wrote and don't recognise.

**Hard rules:**
1. **Explain every symbol**, including punctuation. Brackets, dots, arrows, colons.
2. **Assume zero knowledge.** Don't write "this is just a standard async function."
3. **Real code only** — copy the actual line from the project, never a made-up example.
4. **Say where it lives** — file path and what the surrounding code is for.
5. **No shortcuts.** "You'll understand this later" is banned.

Example of the required depth:

````markdown
## src/db/schema.ts

```ts
export const inspections = sqliteTable("inspections", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});
```

Let's take this apart completely.

**`export`**
Means "other files are allowed to use this." Without it, this table
definition would be trapped in this one file, like writing something in a
notebook and locking the notebook in a drawer.

**`const`**
Makes a named box to keep something in. `const` specifically means the box
can never be pointed at a *different* thing later. There is also `let`,
which allows swapping — we avoid it because surprise swaps cause bugs.

**`inspections`**
The name we picked for the box. We chose it; the computer doesn't care.

**`=`**
"Put the thing on the right into the box on the left." It does NOT mean
"is equal to" — that trips up everyone coming from maths.

**`sqliteTable( ... )`**
A function. A function is a machine: you feed things in, it gives something
back. The round brackets `()` are the machine's mouth — what's inside is
what we're feeding it. This particular machine comes from Drizzle and
builds a table description.

**`"inspections"`** (the first thing we fed it)
Text wrapped in quotes is called a **string**. Quotes tell the computer
"these are letters, not an instruction." This string is the table's real
name inside the database.

**`{ ... }`** (the second thing we fed it)
Curly brackets make an **object** — a bag of labelled things. Each label is
a column.

**`id: text("id").primaryKey(),`**
Read it in three pieces:
- `id:` — the name we use in our TypeScript code. The colon `:` means
  "here comes the value for this label."
- `text("id")` — another machine. It builds a column that holds text, and
  is called `id` inside the database. Note we say `id` twice: once for our
  code, once for the database. They can differ, and later they will —
  `projectId` in code becomes `project_id` in the database.
- `.primaryKey()` — the dot `.` means "and then also do this to the thing
  I just made." `primaryKey()` marks this column as the row's unique
  name-tag. No two rows may share it.
- The comma `,` at the end separates this label from the next one, the same
  way commas separate items in a shopping list.

**`title: text("title").notNull(),`**
Same shape. `.notNull()` means this column is not allowed to be empty.
Every inspection must have a title.

**The final `});`**
The `}` closes the bag of columns. The `)` closes the machine's mouth. The
`;` ends the instruction, like a full stop. They must come in that order —
you close the inner thing before the outer thing, like closing a box before
closing the cupboard it sits in.
````

**Update rule:** every time you write code, add its explanation. See 0.4.5.

### 0.4.5 The documentation protocol — the rule that holds it together

> **No code is written without its documentation being updated in the same session. Not one line.**

This is the project's most important rule and the easiest to break. "I'll write it up later" is how you arrive at Phase 3 with a codebase you can't explain.

**After every piece of work, ask these four questions in order:**

| Question | If yes → update |
|---|---|
| Did I write or change code? | `BABY.md` — explain the new lines |
| Did I build something new? | `UNDERSTANDING.md` — what it does, in plain words |
| Did I choose between two options? | `DESIGN.md` — a decision entry with the trade-off |
| Did I set a new rule or convention? | `CLAUDE.md` — so it's enforced from now on |

**How to make this cheap** — put it in `CLAUDE.md` so Claude Code does most of the work:

```markdown
## Documentation protocol — mandatory
After ANY code change, before we move on, you must:
1. Add a line-by-line explanation of the new code to docs/BABY.md,
   explaining every symbol as if to a complete beginner.
2. If it's a new capability, add a plain-words entry to docs/UNDERSTANDING.md
   with no jargon and no code.
3. If a decision had alternatives, add an entry to docs/DESIGN.md with the
   trade-off and what was rejected.
4. If we set a convention, add it to this file.
Remind me if I try to move on without this.
```

That last line matters. It makes Claude Code the thing that nags you, instead of you having to remember.

**The commit rule:** a commit containing code changes but no documentation changes should not exist. If you see one in `git log`, fix it before moving on.

---

## 0.5 Glossary

Every term used in this document, in plain words.

| Term | Plain meaning |
|---|---|
| **Terminal** | The text window where you type commands instead of clicking |
| **Repository (git)** | A folder whose change history is tracked |
| **Repository (our code)** | The one layer allowed to touch the database — different meaning, unfortunately |
| **Package** | Someone else's code you install and use |
| **npm** | The tool that installs packages |
| **Dependency** | A package your project needs to run |
| **CRUD** | Create, Read, Update, Delete — the four basic data operations |
| **Schema** | The plan of what the database's tables and columns are called |
| **Migration** | A recipe for changing the database's shape without losing what's inside |
| **ORM** | A translator letting you write database operations in TypeScript instead of SQL |
| **Transaction** | A group of writes that all succeed or all fail — never half |
| **UUID** | A random ID so long it will never collide with another |
| **Epoch milliseconds** | Time stored as a plain number: milliseconds since 1 Jan 1970 |
| **Soft delete** | Marking a row deleted instead of erasing it |
| **Tombstone** | The marker left behind by a soft delete |
| **Index (database)** | A lookup shortcut making searches on a column fast |
| **Component** | A reusable piece of screen |
| **Props** | The inputs you pass to a component |
| **State** | Data a component remembers that can change |
| **Hook** | A React function starting with `use` that gives a component a capability |
| **Virtualization** | Only drawing the list rows currently on screen |
| **Native code** | The Swift/Kotlin layer underneath React Native |
| **Build** | The packaged app file you install on a phone |
| **Dev build** | A build including developer tools, for testing |
| **Simulator / emulator** | A fake phone running on your computer |
| **Test case** | A written recipe: do these steps, expect this result |
| **Regression** | Something that used to work and quietly broke |

---

## 0.6 Standing rules for every phase

These apply to Phases 1, 2, 3 and 4 alike. **The purpose of this project is to teach you mobile development — the app is the by-product.** These six rules are what keep that true.

### 0.6.1 Nothing is written without being explained

Section 0.1. If you can't explain a line out loud, it isn't finished.

### 0.6.2 Documentation updates with the code, always

Section 0.4.5. Four files, four questions, same session as the code.

### 0.6.3 Every part ends by seeing it run

At the end of each numbered part — not each day, each *part* — you run the app and look at it. Details in 0.6.5.

**Why this is a rule and not a suggestion:** code that typechecks is not code that works. A screen can compile perfectly and render as a blank white rectangle. Discovering that four days later, buried under other changes, costs hours. Discovering it in the same ten minutes costs nothing.

### 0.6.4 Every phase ends with formal test cases

Written test cases with steps and expected results, executed and recorded. Section 6 is Phase 1's set; every phase gets its own.

**Why written and not just "I clicked around":** clicking around tests what you remember to test, which is always the happy path. Written cases include the awkward ones — airplane mode, force-quit, empty states — which is where the bugs actually live.

### 0.6.5 How to "see it running"

**Setting up the Android emulator on your PC** (do this once, on Day 1):

1. Install Android Studio.
2. Open it → **More Actions** → **Virtual Device Manager**.
3. Create a device — Pixel 6 or similar is fine.
4. Download a system image when prompted (this is the Android version it will run).
5. Press the ▶ play button to start it.

**What an emulator is:** a fake Android phone running in a window on your computer. It behaves like a real phone for most purposes.

**Running your app on it:**

```bash
npx expo start        # starts the development server
```

Then press `a` in the terminal to open it on the running Android emulator.

**The limits of an emulator — read this before trusting it:**

| Works fine | Unreliable or impossible |
|---|---|
| Screens, navigation, layout | Camera (fake image only) |
| Database, CRUD, lists | Real GPS |
| Light/dark mode | Background tasks |
| Airplane-mode toggling | True performance measurement |

So: **emulator for daily checking, real phone for anything that touches hardware.** Phase 1 is mostly emulator-safe. Phase 2 (camera, GPS) and Phase 3 (background uploads) need a real device — an emulator will lie to you about both.

**What to record at each checkpoint:**
- A screenshot, saved into `docs/screenshots/phase-1/`
- One line in your commit message about what you can now see working

At the end of each phase, a 60-second screen recording of the whole flow.

### 0.6.6 Never accept code you can't explain

Section 0.2.6. If Claude Code writes something you don't follow, ask about that specific line before moving on. This is the rule that decides whether you finish the internship with a skill or with a folder.

---

# SECTION 1 — WHAT PHASE 1 IS FOR

## 1.1 Why foundation before features

Phase 1 ships nothing a user would notice. It builds what the other three phases stand on:

- **Phase 2's** form engine writes into the `answers` and `attachments` tables defined here.
- **Phase 3's** sync engine drains the `outbox` table defined here, and depends entirely on the ID strategy, timestamps and delete semantics chosen here.
- **Phase 4's** performance work is measured against the lists built here.

**The highest-stakes decision this week is the database schema.** Get IDs, timestamps or deletes wrong and Phase 3 is unbuildable without a rewrite — during your hardest week. Section 4 explains why each column exists.

## 1.2 Definition of done

Phase 1 is complete when all seven are true:

1. A dev build is installed on a **physical phone**, not just a simulator.
2. The app navigates between Projects, Inspections and Settings.
3. SQLite is live, with a migration that has run at least twice.
4. All six tables exist with the exact columns in Section 4.
5. Inspections can be created, read, updated and deleted **entirely offline**.
6. Force-quitting and reopening shows the same data.
7. The Inspections list renders 500 seeded records smoothly.

## 1.3 Scope

### 1.3.1 In scope

Project setup · TypeScript strict · linting · folder structure · Expo Router navigation · theme tokens and dark mode · reusable UI primitives · SQLite + Drizzle schema · migrations · repository layer · seed script · Projects and Inspections lists · create/edit/delete inspection · EAS dev build on a real device.

### 1.3.2 Out of scope — do not start these

| Deferred | Phase |
|---|---|
| Dynamic form rendering, field types | 2 |
| Camera, photos, GPS | 2 |
| Supabase, auth, any network call | 3 |
| Sync logic, retry, conflicts | 3 |
| PDF export, animations, tests, CI | 4 |

> Scope creep in week 1 is the most common way this project dies. If you're building a form field type, stop — that's Phase 2.

---

# SECTION 2 — CONCEPTS, EXPLAINED BEFORE YOU USE THEM

Read this before Day 1. Each concept follows the four-part contract from 0.1.

## 2.1 React Native

**What it is:** a way to write phone apps for both iPhone and Android using JavaScript, instead of writing each app twice in two different languages.

**Why we need it:** you're one person with four weeks. Writing Swift for iOS and Kotlin for Android separately isn't possible in that time.

**How it works underneath:** your JavaScript runs in an engine on the phone and sends instructions to the *real* native buttons and lists. You aren't drawing fake buttons in a webpage — you're controlling genuine iOS and Android components.

**Use it yourself:** any project needing one app on both platforms.

## 2.2 Expo, and dev builds versus Expo Go

**What it is:** a toolkit on top of React Native handling the painful parts — building, native permissions, ready-made camera and GPS libraries.

**The distinction that will bite you:**

| | Expo Go | Dev build |
|---|---|---|
| What it is | A pre-made app from the store | *Your* app, built with your own native code |
| Custom native code | ✗ Can't load it | ✓ Yes |
| Setup cost | Zero | ~30 minutes |

**Why we must use dev builds:** Phase 3 needs background uploads, which need custom native configuration. Expo Go cannot load that. Choosing Expo Go now means hitting a wall in week three and rebuilding.

**Syntax:**

```bash
npx expo prebuild
```

`npx` = run a tool without permanently installing it. `expo prebuild` = generate the real `ios/` and `android/` folders. Afterwards you have actual native projects you can open and edit.

## 2.3 TypeScript

**What it is:** JavaScript with labels saying what kind of value each thing holds.

**Plain example:**

```ts
// JavaScript — nothing stops this nonsense
inspection.titel = "Roof check";   // typo; silently creates a new field

// TypeScript — refuses before the app ever runs
inspection.titel = "Roof check";   // Error: 'titel' does not exist. Did you mean 'title'?
```

**Why we need it:** with six tables and dozens of fields, typos are inevitable. TypeScript catches them as you type rather than in front of your supervisor.

**Syntax:**

```ts
type Inspection = {
  id: string;                   // must be text
  title: string;
  completedAt: number | null;   // a number OR nothing — "| null" allows empty
};
```

`type` names a shape. `field: kind` declares each field. `|` means "either this or that". A `?` after a name would mean the field is optional.

**"Strict mode"** means TypeScript refuses to let you be lazy — notably, it forces you to handle the case where something might be empty. Turn it on now; turning it on later means fixing hundreds of errors at once.

## 2.4 Expo Router

**What it is:** navigation decided by your folder structure. A file at `app/settings.tsx` automatically becomes the `/settings` screen. No separate route configuration.

**Why we need it:** less wiring, and it gives us deep links free — which Phase 4 needs to open a specific inspection from outside the app.

**Syntax:**

```
src/app/
  (tabs)/
    index.tsx          → the first tab
    inspections.tsx    → the second tab
  inspections/
    [id].tsx           → /inspections/anything
```

Square brackets mean "a changing value." `[id].tsx` handles `/inspections/abc123`, and the screen reads which one:

```ts
import { useLocalSearchParams } from "expo-router";

const { id } = useLocalSearchParams();   // pulls "abc123" out of the URL
```

Parentheses like `(tabs)` group files for layout **without** appearing in the URL.

## 2.5 SQLite

**What it is:** a complete database living in a single file inside your app. No server, no network.

**Analogy:** a filing cabinet the app carries in its backpack, rather than one it must phone up and ask about.

**Why we need it:** the inspector has no signal. The phone must hold the real data.

**Why not AsyncStorage:** AsyncStorage is a box of labelled sticky notes — fine for "dark mode: on," useless for "give me every incomplete inspection for project X, newest first." We need real queries. "AsyncStorage" is also the exact thin answer every other candidate gives in interviews.

## 2.6 Drizzle ORM

**What it is:** ORM = Object-Relational Mapper. A translator letting you write database operations in TypeScript instead of raw SQL, with your table definitions checked by the compiler.

**Compare:**

```sql
-- Raw SQL: a typo in "titl" fails only when it runs
SELECT * FROM inspections WHERE project_id = ? AND deleted_at IS NULL;
```

```ts
// Drizzle: a typo fails immediately, in your editor
await db.select().from(inspections)
  .where(and(eq(inspections.projectId, id), isNull(inspections.deletedAt)));
```

**Syntax, piece by piece:**

- `db.select()` — start a SELECT
- `.from(inspections)` — the table, referring to your TypeScript definition
- `.where(...)` — the filter
- `eq(a, b)` — "equals"
- `isNull(x)` — "is empty"
- `and(...)` — combine conditions
- `await` — wait for it to finish, because database reads take time

**Use it yourself:** any TypeScript project with a real database.

## 2.7 Migrations

**What it is:** a recipe for changing your database's shape without losing the data inside it.

**Why we need it:** you *will* be wrong about the schema. In week two you'll need a column that doesn't exist. Without migrations your only option is deleting everything and starting over — impossible once a real inspector has data on their phone.

**Analogy:** adding a drawer to a filing cabinet without emptying it onto the floor.

**How it works:**
1. You change `schema.ts`
2. You run a generate command
3. Drizzle compares old and new, writes a numbered migration file
4. The app applies pending migrations on startup

**Why Day 4 makes you write a *second* migration:** the first proves nothing — an empty database "migrates" fine. Only the second, applied to a database with rows already in it, proves upgrades don't destroy data.

## 2.8 The repository layer

**What it is:** a rule about where database code may live. Screens never touch the database. They call functions in `src/repositories/`, and only those touch Drizzle.

**Why we need it — this is the important one:** in Phase 3, every change must also drop a note in the outbox so it can be synced. If ten screens write to the database directly, you must find and fix all ten, and any you miss becomes data that silently never syncs. With one door, you change the door.

**Analogy:** one desk in the office may open the filing cabinet. Everyone else asks that desk. When the rule changes, you retrain one person.

**Syntax:**

```ts
// ✗ Never — inside a screen
const rows = await db.select().from(inspections);

// ✓ Always
import { listInspections } from "@/repositories/inspections";
const rows = await listInspections({ projectId });
```

## 2.9 The outbox pattern

**What it is:** a table where every change to your data also gets recorded as a to-do note. Later, something reads the notes and sends them to the server.

**Analogy:** a tray of letters waiting to be posted. Writing the letter and putting it in the tray happen together. The postman comes later.

**Why we need it:** the inspector edits five inspections in a tunnel. There's no internet, so nothing can be sent. We need a durable, ordered record of *what changed* so we can replay it later. Knowing only the final state isn't enough — order and intent matter.

**Why build it in Phase 1 when nothing reads it:** retrofitting it in Phase 3 means revisiting every mutation in the codebase during your hardest week. Ten extra minutes now.

---

# SECTION 3 — DAY BY DAY

Budget ~12 hours across the week. Every day ends with something running on the device.

## 3.0 The rhythm of every day

Every numbered part below (3.1.1, 3.1.2, …) ends the same way:

**▶ SEE IT RUN** — open the emulator, look at what you just built, take a screenshot into `docs/screenshots/phase-1/`.

**📝 DOCUMENT IT** — the four questions from 0.4.5, in the same session.

Then, in the **last 10 minutes of the day**:

1. Re-read today's `BABY.md` additions — is every symbol explained?
2. Confirm `UNDERSTANDING.md` covers everything new, in plain words
3. Log any weighed decision in `DESIGN.md`
4. Add any new convention to `CLAUDE.md`
5. Commit — the message says *what changed and why*

Ten minutes. Skipping it is how you reach Phase 3 unable to explain your own sync queue.

---

## 3.1 Day 1 — Mon 24 Aug · Documents, setup, dev build (3 hrs)

### 3.1.1 Create the four documents (30 min)

Create `CLAUDE.md` in the root, and `DESIGN.md`, `UNDERSTANDING.md`, `BABY.md` in `docs/`, from the Section 0.4 skeletons. Do this first, so the rules exist before the code does.

Paste the documentation protocol (0.4.5) into `CLAUDE.md` now — it's what makes Claude Code enforce the rest.

### 3.1.2 Create the project (20 min)

```bash
npx create-expo-app@latest fieldnote
cd fieldnote
```

`create-expo-app` scaffolds a working app. `@latest` takes the current version. `fieldnote` is the folder it creates.

### 3.1.3 Turn on strict TypeScript (10 min)

In `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- `extends` — start from Expo's settings rather than writing them all yourself
- `strict: true` — Section 2.3; forces you to handle empty values
- `paths` — lets you write `@/repositories/inspections` instead of `../../../repositories/inspections`

### 3.1.4 Set up Claude Code (20 min)

```bash
claude
```

Then inside the session:

```
/init            # generates a starter CLAUDE.md by scanning the project
/memory          # open it and paste in your rules from Section 0.4.2
/permissions     # review what Claude may do without asking
```

### 3.1.5 Generate the native projects (20 min)

```bash
npx expo prebuild
```

**Then actually open `ios/` and `android/` and look.** Find these four files — you'll edit all of them later:

| File | What it's for | Edited in |
|---|---|---|
| `ios/…/Info.plist` | iOS permissions and settings | Phase 2 (camera, GPS), Phase 3 (background) |
| `android/…/AndroidManifest.xml` | Android permissions | Phase 2, Phase 3 |
| `android/…/build.gradle` | Android build config | Phase 3 |
| `ios/Podfile` | iOS dependencies | Rarely |

### 3.1.6 Build and install on your phone (60 min)

```bash
npm install -g eas-cli
eas init
eas build --profile development --platform android
```

Android first — faster, and no Apple developer account needed.

### 3.1.7 Set up the emulator (20 min)

Follow Section 0.6.5. You need this working before Day 2, because every part from here ends by looking at the app.

**▶ SEE IT RUN** — the starter app on both the emulator and your physical phone.
**📝 DOCUMENT IT** — `BABY.md` gets `tsconfig.json` explained; `UNDERSTANDING.md` gets "what Expo is and why we're not using Expo Go."

**Done when:** the app opens on your physical phone *and* the emulator, and hot reload works.

---

## 3.2 Day 2 — Tue 25 Aug · Theme and UI primitives (2 hrs)

### 3.2.1 Design tokens (30 min)

**What tokens are:** every colour, spacing and font size defined once in one file, referred to by name everywhere else.

**Why:** changing your blue in one place instead of forty. It also stops the slow drift into eleven slightly different greys.

```ts
// src/theme/tokens.ts
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const colors = {
  light: { bg: "#FFFFFF", text: "#111827", primary: "#2563EB", border: "#E5E7EB" },
  dark:  { bg: "#0B1220", text: "#F9FAFB", primary: "#60A5FA", border: "#1F2937" },
};

export const radius = { sm: 6, md: 10, lg: 16 };
```

`export` makes it importable elsewhere. `const` means it can't be reassigned.

### 3.2.2 Theme provider (30 min)

```ts
import { useColorScheme } from "react-native";

const scheme = useColorScheme();          // "light" or "dark", from phone settings
const theme = colors[scheme ?? "light"];  // ?? means "if empty, use this instead"
```

### 3.2.3 UI primitives (60 min)

Build your own — no UI library: `Screen`, `Text`, `Button`, `Card`, `Input`, `EmptyState`, `Badge`.

**Why not a component library:** you'd learn the library, not React Native. Building seven small components teaches you flexbox, props and styling properly.

**▶ SEE IT RUN** — a demo screen showing all seven primitives. Toggle the emulator between light and dark mode and watch them change. Screenshot both.
**📝 DOCUMENT IT** — `BABY.md`: the tokens file and one full component, every symbol. `UNDERSTANDING.md`: what design tokens are and why one file beats forty.

**Done when:** a demo screen shows every primitive in both light and dark mode.

---

## 3.3 Day 3 — Wed 26 Aug · Navigation skeleton (1.5 hrs)

### 3.3.1 The file structure

```
src/app/
  _layout.tsx              # wraps everything: theme + database
  (tabs)/
    _layout.tsx            # the tab bar
    index.tsx              # Projects list
    inspections.tsx        # Inspections list
    settings.tsx           # Settings
  projects/[id].tsx        # one project
  inspections/
    [id].tsx               # one inspection
    new.tsx                # create
```

`_layout.tsx` is special: it wraps every screen in its folder. The root one holds things needed *everywhere* — the theme, the database connection.

### 3.3.2 Wire it with fake data (60 min)

Hardcode placeholder arrays. Today's point is that navigation works; real data arrives Day 5.

**▶ SEE IT RUN** — tap through every screen on the emulator. Check the back button, check the tab bar, check headers. Record a short clip of the full walk-through.
**📝 DOCUMENT IT** — `BABY.md`: `_layout.tsx` and one `[id].tsx` screen, including what the square brackets do. `UNDERSTANDING.md`: how folder structure becomes navigation.

**Done when:** you can reach every screen by tapping, with correct headers and back behaviour.

---

## 3.4 Day 4 — Thu 27 Aug · Database and migrations (3 hrs) ← the hardest day

### 3.4.1 Install (15 min)

```bash
npx expo install expo-sqlite expo-crypto
npm install drizzle-orm
npm install -D drizzle-kit
```

`npx expo install` (rather than `npm install`) picks versions known to work with your Expo version. Use it for anything Expo-related.

`-D` means a development-only dependency — `drizzle-kit` generates migration files on your computer and never ships inside the app.

### 3.4.2 Write the schema (60 min)

Full schema in Section 4. The syntax:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const inspections = sqliteTable("inspections", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
});
```

Line by line:

- `sqliteTable("inspections", {...})` — first argument is the real table name in the database; second describes the columns
- `text("id")` — a text column called `id` in the database
- `id:` on the left — what *you* call it in TypeScript. `projectId` in code, `project_id` in the database: JavaScript convention on one side, SQL convention on the other
- `.primaryKey()` — this column uniquely identifies the row
- `.notNull()` — cannot be empty
- `deletedAt` has no `.notNull()`, so it *can* be empty — which is exactly what "not deleted" means

### 3.4.3 Run migrations on startup (60 min)

The app must apply pending migrations before showing any screen, with a loading state until ready.

> The Drizzle + Expo SQLite integration has changed more than once. Follow the current official Drizzle documentation for the exact hook — not a blog post, and not this document, which may be out of date by the time you read it.

### 3.4.4 Prove migrations work (30 min)

Add a column — say `inspections.notes` — and generate a second migration. Install over the existing app and confirm your rows survived.

**▶ SEE IT RUN** — on the emulator, watch the app show its loading state, apply migrations, then open. Add the second migration and confirm your rows are still there afterwards. This is the most important thing you'll see all week.
**📝 DOCUMENT IT** — `BABY.md`: the whole schema file, every column, every chained method. `UNDERSTANDING.md`: what a migration is, using the filing-cabinet analogy. `DESIGN.md`: D-001 (UUIDs), D-002 (soft deletes), D-003 (integer timestamps).

**Done when:** two migrations have run in sequence on a device and existing data survived.

---

## 3.5 Day 5 — Fri 28 Aug · Repository layer and seed data (2 hrs)

### 3.5.1 Repositories (60 min)

One file per entity. Full contract in Section 5.

### 3.5.2 Seed script (45 min)

8 projects, 3 templates, 500 inspections with varied statuses and dates.

**Why 500 and not 5:** with five rows every list is fast and you learn nothing. Phase 4 measures performance against realistic volume, and you want to know *now* if something is slow.

### 3.5.3 Reset button (15 min)

A dev-only "Reset & reseed database" button in Settings. You'll use it constantly.

**▶ SEE IT RUN** — tap reset on the emulator, then check the row counts in the console. Screenshot the populated Settings screen.
**📝 DOCUMENT IT** — `BABY.md`: one full repository function, line by line, including `async`, `await` and the transaction. `UNDERSTANDING.md`: why only one layer may open the filing cabinet.

---

## 3.6 Day 6 — Sat 29 Aug · Offline CRUD and lists (3 hrs)

### 3.6.1 The lists (60 min)

Projects and Inspections, both on FlashList.

**What FlashList is:** a list that only draws the rows currently on screen. With 500 inspections, a plain list builds all 500; FlashList builds the ~10 you can see and recycles them as you scroll.

```tsx
<FlashList
  data={inspections}
  renderItem={({ item }) => <InspectionRow inspection={item} />}
  estimatedItemSize={72}
/>
```

`estimatedItemSize` is roughly how tall one row is in pixels. FlashList uses it to guess scrollbar size before measuring. Get it roughly right; it needn't be exact.

### 3.6.2 Create, edit, delete (90 min)

Create (title, project, template, status), edit, and soft-delete with confirmation.

### 3.6.3 Filters and empty states (30 min)

Filter by project and status. Every list gets an empty state.

**▶ SEE IT RUN** — the real payoff of the week. On the emulator: turn on airplane mode, create an inspection, edit it, delete it, force-quit the app, reopen it, confirm everything is exactly as you left it. Record this as a clip — it's your Phase 1 demo.
**📝 DOCUMENT IT** — `BABY.md`: the FlashList usage and the create-inspection flow. `UNDERSTANDING.md`: what virtualization is, and why the app works with no internet.

**Done when:** you can create, edit and delete an inspection **in airplane mode**.

---

## 3.7 Day 7 — Sun 30 Aug · Verify, document, submit (2 hrs — finish by 2 PM)

### 3.7.1 Run the test cases (45 min)

Execute every test case in Section 6.2, on a physical device, and record pass/fail for each in `docs/TEST-RESULTS-PHASE-1.md`. Any failure gets fixed before submission — or, if you can't fix it in time, written down honestly as a known issue.

### 3.7.2 Documentation review (30 min)

Read `UNDERSTANDING.md` start to finish as though you'd never seen the project. Anything you can't follow, rewrite more simply.

Then open `BABY.md` beside your actual code and check every file is covered. **The test:** pick a random line from your project. Is it explained? If not, `BABY.md` isn't done.

Confirm `DESIGN.md` covers UUIDs, soft deletes and the outbox, and that `CLAUDE.md` matches the conventions you actually settled on.

### 3.7.3 README and demo (30 min)

What the app is, how to run it, a schema diagram, links to all four documents. Record 60 seconds of the CRUD flow in airplane mode.

### 3.7.4 Submit (15 min)

Tag the commit `phase-1`. Submit via the Google Form **before 4:00 PM**.

---

# SECTION 4 — THE DATABASE SCHEMA

## 4.1 Columns every table carries

| Column | Type | Why it exists |
|---|---|---|
| `id` | TEXT (UUID v4) | **Generated on the device.** An offline inspector must create records with permanent IDs. Server-issued IDs need a server. |
| `created_at` | INTEGER | Ordering and display |
| `updated_at` | INTEGER | Phase 3 compares these to resolve conflicts |
| `deleted_at` | INTEGER, nullable | Soft delete. A hard delete can't be synced — the server never learns the row is gone, so it reappears. |
| `sync_status` | TEXT | `local` / `pending` / `syncing` / `synced` / `failed` / `conflict`. All `local` in Phase 1; Phase 3 drives it. |

**Why timestamps are numbers, not text:** epoch milliseconds are a plain integer. Comparing and sorting is trivial and there's no timezone ambiguity. Text dates invite bugs where `"2026-08-30"` sorts oddly against `"2026-8-30"`.

## 4.2 The six tables

### 4.2.1 `projects` — a site or client engagement
`id, name, client_name, address, latitude, longitude` + the common columns

### 4.2.2 `templates` — a reusable checklist definition
`id, name, version, schema_json` + common

`schema_json` holds the JSON that Phase 2's form engine renders. Store as TEXT, parse on read. Phase 1 only displays the name.

### 4.2.3 `inspections` — one visit to one site
`id, project_id, template_id, title, status, inspector_name, started_at, completed_at, latitude, longitude, notes` + common

`status`: `draft` / `in_progress` / `completed` / `submitted`

### 4.2.4 `answers` — one row per answered field
`id, inspection_id, field_key, value_text, value_number, value_json` + common

Nothing writes here until Phase 2. **Create it now anyway** — adding it later means another migration during your busiest week.

### 4.2.5 `attachments` — photos and signatures
`id, inspection_id, field_key, local_uri, remote_url, mime_type, byte_size, width, height` + common

`local_uri` is a **file path**, never image bytes. Storing base64 blobs in SQLite will wreck both performance and memory.

### 4.2.6 `outbox` — the sync queue
`id, entity_type, entity_id, operation, payload_json, attempts, last_error, next_attempt_at, created_at`

`operation`: `insert` / `update` / `delete`

## 4.3 Indexes

```
inspections(project_id)     -- filtering by project
inspections(status)         -- filtering by status
inspections(updated_at)     -- sorting by recency
answers(inspection_id)
attachments(inspection_id)
outbox(next_attempt_at)     -- Phase 3: "what's due to retry?"
```

**What an index is:** a book's index versus reading every page. Without one, finding all inspections for a project means scanning all 500 rows.

**Why not index everything:** every index makes writes slower and the file bigger. Index what you filter and sort on, nothing else.

---

# SECTION 5 — THE REPOSITORY LAYER

## 5.1 The contract

```ts
// src/repositories/inspections.ts

export async function listInspections(filter?: {
  projectId?: string;
  status?: InspectionStatus;
}): Promise<Inspection[]>

export async function getInspection(id: string): Promise<Inspection | null>
export async function createInspection(input: NewInspection): Promise<Inspection>
export async function updateInspection(id: string, patch: Partial<Inspection>): Promise<Inspection>
export async function softDeleteInspection(id: string): Promise<void>
```

Reading the signatures:

- `async` — this takes time; callers must `await` it
- `filter?:` — the `?` makes the whole argument optional
- `Promise<Inspection[]>` — eventually returns a list of inspections
- `Inspection | null` — an inspection, or nothing if that ID doesn't exist
- `Partial<Inspection>` — any subset of the fields, so you can update just the title
- `Promise<void>` — finishes, returns nothing

## 5.2 The rule every mutation follows

Every function that changes data must, in **one transaction**:

1. Generate the UUID (creates only)
2. Set `updated_at = Date.now()`
3. Write the row
4. Append the matching `outbox` entry

**Why one transaction:** if the row saved but the outbox note failed, that change would never sync — silent data loss, and the worst kind of bug because nothing looks wrong. A transaction means both happen or neither does.

## 5.3 The rule every read follows

Always filter out soft-deleted rows:

```ts
.where(isNull(inspections.deletedAt))
```

Forget this once and deleted inspections reappear in a list. Put it in `CLAUDE.md` so Claude Code enforces it too.

---

# SECTION 6 — VERIFICATION

Two layers. **6.1** is a quick self-check you run continuously. **6.2** is the formal test pass at the end of the phase, recorded and submitted.

## 6.1 Acceptance checklist

Run every item on a physical device before submitting.

**Build and navigation**
- [ ] Dev build installs and launches on a real phone
- [ ] All five screens reachable; back navigation correct
- [ ] Light and dark mode both render correctly

**Database**
- [ ] Migrations `0000` and `0001` both applied; data survived the upgrade
- [ ] All six tables present with the columns in Section 4
- [ ] Indexes from 4.3 created

**Offline CRUD**
- [ ] Create an inspection **in airplane mode** → appears in list
- [ ] Edit it → change persists
- [ ] Delete it → gone from list, but row still present with `deleted_at` set
- [ ] Force-quit and relaunch → all data intact
- [ ] Every mutation created a matching `outbox` row

**Lists**
- [ ] 500 seeded inspections scroll without stutter
- [ ] Filter by project and by status both work
- [ ] Every list has an empty state

**Code quality**
- [ ] No Drizzle or SQL calls anywhere in `src/app/` or `src/components/`
- [ ] `npx tsc --noEmit` passes with zero errors

**Documentation**
- [ ] `DESIGN.md` has entries for UUIDs, soft deletes and the outbox
- [ ] `CLAUDE.md` lists stack, commands, rules and current phase
- [ ] `UNDERSTANDING.md` explains every Phase 1 concept in plain words
- [ ] `BABY.md` covers every file written this phase, symbol by symbol
- [ ] All four read as current — nothing describes something you later changed
- [ ] README committed, commit tagged `phase-1`

## 6.2 Phase 1 test cases

**What a test case is:** a written recipe — do these exact steps, expect this exact result. Not "check the list works," but steps someone else could follow and get the same answer.

**Why written down:** clicking around only tests what you remember to test, which is always the path where everything goes right. Written cases force you through airplane mode, force-quits and empty states — where the bugs actually are.

**How to run this:** create `docs/TEST-RESULTS-PHASE-1.md`, copy the table, and fill in Pass/Fail plus notes. Automated tests arrive in Phase 4; Phase 1 is manual, executed on a **physical device**.

### 6.2.1 Setup and build

| ID | Steps | Expected result |
|---|---|---|
| TC-01 | Install the dev build on a physical phone, open it | App launches, no crash, no red error screen |
| TC-02 | Open the app on the emulator | Same behaviour as on the phone |
| TC-03 | Change a line of text in a screen, save | Hot reload updates within ~2 seconds |
| TC-04 | Run `npx tsc --noEmit` | Zero errors |

### 6.2.2 Navigation and theme

| ID | Steps | Expected result |
|---|---|---|
| TC-05 | Tap each of the three tabs | Correct screen each time; tab highlights |
| TC-06 | Open a project, then press back | Returns to the Projects list, not to a blank screen |
| TC-07 | Set the phone to dark mode with the app open | Colours change; text remains readable, no white-on-white |
| TC-08 | Rotate the phone (if rotation is enabled) | Layout doesn't overlap or clip |

### 6.2.3 Database and migrations

| ID | Steps | Expected result |
|---|---|---|
| TC-09 | Delete the app, reinstall, open it | Migrations run, app opens to an empty state, no crash |
| TC-10 | Seed data, then install a build containing migration `0001` over the top | App opens; previously seeded rows are still present |
| TC-11 | Inspect the database; list its tables | All six tables present: projects, templates, inspections, answers, attachments, outbox |

### 6.2.4 Offline CRUD — the core of the phase

| ID | Steps | Expected result |
|---|---|---|
| TC-12 | Turn on airplane mode. Create an inspection with a title and project | Saves without error; appears at the top of the list |
| TC-13 | Still offline: edit that inspection's title | New title shows in both detail and list |
| TC-14 | Still offline: delete it, confirm | Disappears from the list |
| TC-15 | Inspect the database row for the deleted inspection | Row still exists, with `deleted_at` set to a number |
| TC-16 | Force-quit the app entirely, reopen it (still offline) | All data exactly as left; deleted item still absent |
| TC-17 | Check the `outbox` table after TC-12, 13 and 14 | Exactly three rows: one `insert`, one `update`, one `delete` |
| TC-18 | Turn airplane mode off | Nothing breaks and nothing uploads — there's no sync engine yet, and that's correct for Phase 1 |

### 6.2.5 Lists and edge cases

| ID | Steps | Expected result |
|---|---|---|
| TC-19 | Seed 500 inspections, scroll the list fast top to bottom | Scrolling stays smooth; no blank rows lingering |
| TC-20 | Filter by a project | Only that project's inspections show |
| TC-21 | Filter by a status with no matching records | Empty state message appears, not a blank screen |
| TC-22 | Reset the database, open the Inspections list | Empty state appears with a clear message |
| TC-23 | Create an inspection with an empty title | Either blocked with a clear message, or saved with a sensible fallback — but never a crash |
| TC-24 | Create an inspection with a very long title (200+ characters) | Text wraps or truncates; layout doesn't break |

### 6.2.6 Recording the results

For each: **Pass**, **Fail**, or **Blocked**, with a note. A failing test isn't a disaster — an *unrecorded* failing test is. If you can't fix something before the deadline, list it under "Known issues" in the README. Supervisors respect a documented known issue far more than a surprise.

---

# SECTION 7 — RISKS

| Risk | Likelihood | Mitigation |
|---|---|---|
| EAS build or native config eats Day 1 | High | Start early; Android first |
| Drizzle + Expo SQLite wiring is fiddly | High | Full 3 hrs on Day 4; current official docs only |
| Schema needs changing mid-project | Medium | That's what migrations are for — but get IDs, timestamps, soft deletes right now |
| Claude Code writes code you don't understand | Medium | Section 0.2.6. Never accept a line you can't explain |
| Temptation to start Phase 2 early | Medium | Re-read 1.3.2 |
| No physical device | Low | Emulator acceptable for Phase 1 only; Phases 2–3 need real hardware |

**If you fall behind:** cut dark mode, cut filters, cut project detail. **Never cut the schema or the outbox writes** — Phase 3 cannot survive without them.

---

# SECTION 8 — HANDOFF TO PHASE 2

## 8.1 Hooks left deliberately in place

| Hook | Phase 2 uses it for |
|---|---|
| `templates.schema_json` | Source JSON for the form renderer |
| `answers` table | Destination for every filled field |
| `attachments` table | Photo and signature references |
| `inspections.status` | Advancing `draft → in_progress → completed` |
| Repository layer | Adding answer/attachment repositories in the same style |
| `outbox` writes | Already correct, so Phase 3 needs no retrofit |

## 8.2 Documents to update before Phase 2

| File | Update |
|---|---|
| `CLAUDE.md` | Change "current phase" to Phase 2; move forms/camera/GPS into scope |
| `DESIGN.md` | New entries for form-schema format and image compression targets |
| `UNDERSTANDING.md` | New plain-words sections for the form engine, photos, GPS |
| `BABY.md` | Continues line-by-line from where Phase 1 stopped |
| `TEST-RESULTS-PHASE-1.md` | Archive it; Phase 2 starts a new results file |

That `CLAUDE.md` phase update is what stops Claude Code helpfully building your sync engine three weeks early and blowing up your scope.

**Phase 2 begins Mon 31 Aug:** the JSON-driven form engine, camera capture and GPS stamping.
