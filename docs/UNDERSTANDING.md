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

**Plain words:** the phone's system setting can be light or dark, and the app has to look correct — readable text, no white writing hiding on a white background — in both, because the user's phone might be in either at any moment. Building both from the start (one file of colours — `tokens.ts` — holding both palettes) means there's never a scramble later to retrofit a second look onto components that only ever expected one.

## The second migration — proving an upgrade doesn't erase anything

**Plain words:** the first migration built the database's tables from nothing — easy, because there was nothing there to lose. The real test is the _second_ migration: adding a new field (a `notes` field on projects) to an app that a device already has real, seeded data sitting inside. If that upgrade were done wrong, it could wipe the table clean and start over, silently deleting every project and inspection an inspector had already saved.

**What was actually done:** the new field was added in a way that doesn't demand anything from rows that existed before it — it's allowed to simply be empty for them, rather than requiring every old row be rewritten with a value it never had. That's _why_ it's allowed to be empty: it's the difference between "grow the filing cabinet by adding a drawer" and "empty the whole cabinet onto the floor and refile everything."

**Being honest about what's not yet confirmed:** having the growing-a-drawer _kind_ of migration is not the same as having _proven_, on a real phone, that a device with real saved data survives having this update installed over it. That check still needs an actual device — it's recorded as still outstanding in `docs/TEST-RESULTS-PHASE-1.md` rather than assumed to be fine because the code looks right.

## What Phase 1 deliberately does not do

No cameras, no GPS, no photos, no forms with different field types, no internet calls of any kind, no PDF export. All of that is real, and all of it is planned — just not yet. Phase 1's only job is: can an inspector create, edit and delete an inspection with zero internet connection, and still see exactly what they left when they come back? Everything else is a later phase building on top of that "yes."

## Why the web preview needed its own little proxy

**Plain words:** the app's phone database only fully works, in a web browser, if that browser has unlocked a fairly advanced capability that most browsers keep switched off by default, for safety reasons. Turning it on requires the app's server to send back two specific labels with every page it delivers, saying "yes, I understand the risks, unlock it for me." Our dev server doesn't send those labels by default, and — this took real digging to find — the one obvious place to add them turned out not to work, because a _different_ part of the same dev server hands out the actual page before that fix ever gets a chance to run.

**What fixed it:** instead of trying to edit the dev server from the inside, a small helper program was added that sits _in front of_ it — every request to the app goes through this helper first, which quietly stamps both labels onto the reply before passing it on to the browser, no matter which part of the dev server actually produced that reply.

**Why this doesn't mean the web preview fully works now:** even with both labels correctly in place, the phone-database library still needs the browser itself to support one more specific, fairly new capability for actually reading and writing files efficiently — and not every browser has it yet. Confirmed directly: the sandboxed browser used for building this project doesn't. That gap has since been patched (see below) so it degrades gracefully instead of hanging. Either way, this only ever affected the web preview used for double-checking screens during development — the real app, on an actual phone, was never touched by any of this.

## Patching someone else's code on purpose, carefully

**Plain words:** the missing browser capability above got fixed — not by changing anything of ours, but by making a small, deliberate edit to the phone-database library's own code, so that when it notices a browser doesn't have that capability, it quietly switches to a "remember things only for this session" mode instead of getting stuck. This kind of edit is called a _patch_, and it's kept as its own small, readable file (`patches/expo-sqlite+57.0.1.patch`) that gets automatically reapplied every time the project's dependencies are freshly installed — nobody has to remember to redo it by hand, and anyone reading the project can see exactly what was changed and why, in one place.

## The deeper problem, found by actually watching the code run instead of guessing

**Plain words:** even after every fix above, the web preview in this project's own sandboxed environment still didn't work — and this time, instead of guessing at another theory, the code was temporarily fitted with little "I got here" messages at each step, like leaving breadcrumbs, so it was possible to watch exactly how far things actually got before something went wrong.

**What that showed:** everything worked. The background worker that talks to the actual database genuinely finished its job successfully. The problem turned out to be the _hand-off_ at the very end — the worker tried to signal "I'm done, here's your answer" back to the main part of the app, using a very fast, low-level signalling method that depends on both sides of the conversation truly sharing the same small patch of memory. In this specific sandboxed browser, that sharing doesn't actually work the way it's supposed to — so the signal is sent, but never received, and the main part of the app eventually gives up waiting.

**Why this one can't be patched away like the last one:** the previous fix worked because the _library_ had a way to ask for something different (an ordinary, working alternative) when the fancy option wasn't available. This time, there is no ordinary alternative wired up anywhere in the chain — every single database operation, big or small, depends on that same hand-off working correctly. Fixing it would mean the _browser itself_ needs to support real shared memory between its background workers and the page correctly, which is not something any code in this project can reach in from the outside.

**Why this is likely a "this one tool" problem, not a "the whole internet" problem:** the specific browser capability that's broken here is old and extremely common — practically every modern browser released in the last several years gets it right, which is _not_ true of the newer, narrower one from the first fix. That makes it far more likely this is a quirk of the specific, stripped-down browser bundled with the tool used to build this project, rather than something a normal person's own browser would ever run into.

## Seeing the app work anyway, even where the real database can't

**Plain words:** since the real database genuinely cannot open in this project's own preview environment — confirmed, not guessed — the app was taught to notice that failure calmly instead of falling over, and quietly hand every screen a small set of realistic pretend data to show instead. Nobody has to look at a crash anymore; the actual Projects, Inspections and Settings screens — the real ones, not a copy — show up looking and behaving normally, just with a thin coloured strip at the top saying "Preview mode" so nobody mistakes it for the genuine article.

**Why the _real_ screens, not a separate pretend version:** a separate, hand-built stand-in screen would need someone to remember to update it, by hand, every single time the real screen changed — and the moment someone forgot, it would quietly start showing something misleading. Feeding pretend data into the _real_ screens instead means there is only ever one version of each screen to keep working, and it automatically keeps looking exactly like the real thing, forever, with no extra upkeep.

**Where the line is drawn:** typing a new inspection's title, or ticking through its status, genuinely works in this mode — those are stored in a small pretend notebook that lives only in that one browser tab and empties the moment the page reloads. A few actions that would only make sense with a real database — like the developer-only outbox counter — are shown honestly as empty, rather than making up a number that would mean nothing.

## Phase 2 — Dynamic form engine, Camera & GPS (summary)

Phase 2 adds a template-driven form renderer, photo attachments, signature capture, and GPS stamping. Templates are JSON documents stored in the `templates.schema_json` column; the renderer reads that JSON at runtime and turns it into sections and fields. Answers are stored in the `answers` table (one row per field), attachments live in the `attachments` table with `local_uri` paths, and every mutation appends an `outbox` row so Phase 3 can sync later.

Key runtime behaviors:

- Templates are immutable by `key`: when you change a template in the future, create a new `version` rather than renaming field `key`s.
- Hidden fields keep their answers but are excluded from validation — this prevents accidental data loss when conditional visibility toggles fields off.
- Photos are stored as files on-disk; the database stores paths only. Thumbnails are stored alongside full images.
- GPS capture records latitude, longitude and an `accuracy` in metres; a missing or poor-quality fix never blocks completing an inspection.

See `docs/DESIGN.md` for the template format and `docs/TEST-RESULTS-PHASE-2.md` for the acceptance checklist and test cases.

## Phase 3, Day 1 — logging in, and why the app has a second "who are you" system now

**What changed:** the app now asks you to sign in before showing anything. This has nothing to do with the phone's own database — it's a separate system for talking to a server, so that later (Day 2 onward) your inspections can travel to a shared copy other people or other devices can see.

**A token, in plain words:** think of it like a wristband at a festival. You show your ticket once at the gate (your email and password); they give you a wristband. For the rest of the day, you show the wristband, not your ticket, to get into anything. The wristband expires after a while (about an hour here) so a stolen one isn't useful for long — but there's also a second, longer-lived pass that quietly gets you a fresh wristband without asking you to prove your identity all over again. That's the access token and the refresh token. None of this is code you have to manage by hand — the library does it in the background.

**Why the phone keeps this wristband somewhere special:** on a phone, that's the same encrypted vault the operating system uses for other sensitive things — nobody else's apps can read it, and it survives a restart. That's `expo-secure-store`. On the web, phones don't have that vault, so the browser's own ordinary storage is used instead — less protected, but every website already works this way, and this app was never meant to be used seriously in a browser anyway (see the whole "Preview mode" story earlier in this file).

**Row Level Security, as a plain idea:** imagine a filing cabinet with everyone's folders mixed together in one drawer, but a rule taped to the drawer that says "you may only ever pull out folders with your own name on them." It doesn't matter how the request is phrased or which app sends it — the rule lives on the cabinet itself, not on any one person's habits, so it can't be gotten around by simply asking a different way. That's what was actually tested here: not just "does the rule exist," but "if I genuinely try to reach into someone else's folder, does the cabinet actually stop me" — and it did, twice (reading someone else's row, and trying to insert a row while claiming to be them).

**Why signing out doesn't erase anything on the phone:** signing out only takes back your wristband — it says nothing at all about the inspections already saved on this device, because those live in a completely separate system (the phone's own SQLite database) that this sign-out code never touches. An inspector should be able to sign out, hand the phone to a colleague to sign in as themselves, and still have their own morning's work sitting there untouched for when they sign back in.

See `docs/SYNC.md` for the full, evolving sync protocol, and `docs/DESIGN.md` D-017/D-018 for why the server's clock (not the phone's) is the only one ever trusted to settle a disagreement, and for two real bugs found by actually trying to break this rather than just reading the rules.

## Phase 3, Day 2 — actually posting the letters, and why sending one twice is fine

**Back to the tray-of-letters picture from Phase 1's outbox section:** Day 1 built the tray and the letters have been piling up in it since Phase 1. Day 2 is the part where a postman finally exists, and the tray actually starts emptying.

**What "posting a letter" means here, concretely:** for each note sitting in the tray, the app tells the server, in plain words, "here's a change — apply it." It does this one letter at a time, oldest first, because some letters only make sense after an earlier one has already arrived — you can't deliver a letter about "inspection #4" to an office that has never heard of the project it belongs to. Oldest-first is what guarantees the project's own letter always gets there first, since it was always written and queued first, too.

**Why it's safe to accidentally send the very same letter twice:** imagine every letter has a serial number stamped on it before it's ever sealed. When it arrives, the office checks: "have I already filed a letter with this exact serial number?" If yes, it doesn't refile it — it just says "yes, got it already," and nothing changes twice. That serial number is the outbox note's own ID, which was already unique and already existed the moment the note was written — nothing new had to be invented to make this work. This is the entire reason a shaky connection isn't dangerous: if the reply gets lost on the way back and the phone tries again just to be safe, the office recognizes the resend and quietly does nothing extra, rather than accidentally applying the same change twice.

**Why a letter about "inspection #4" doesn't have to repeat everything about it:** an edit letter only needs to say what actually changed — "the title is now X" — not retype the entire inspection from scratch. The office is trusted to leave every other detail exactly as it already had it. This matters because most edits in this app are small (one field at a time), and forcing every letter to carry the whole record along with it would be needlessly wasteful.

**What doesn't exist yet, honestly:** if a letter can't be delivered right now — no signal, or the office is having a bad day — Day 2 just leaves it sitting in the tray to be tried again the next time someone manually asks. Waiting a little longer between each retry, and giving up on a letter that's failed too many times, is Day 3's job, not this one's.

## Phase 3, Day 3 — waiting longer each time, and knowing when to stop trying

**Why not just try again immediately when a letter fails to deliver?** Picture calling someone whose line is busy — calling back the very same instant almost never works, because whatever made it busy hasn't changed yet. Worse, if fifty phones are all in that same situation at once (say, everyone in a building just got signal back together) and all of them hammer the office immediately and repeatedly, the office can end up more overwhelmed by the retries than it ever was by the original letters. So instead, each failed letter waits a little longer before trying again than the time before — a bit longer, then longer still — giving whatever went wrong a real chance to clear up, and spreading everyone's retries out instead of bunching them together.

**Why the wait isn't the same length for everyone, even at the same attempt number:** if every phone computed the exact same "wait 8 seconds" and they all started at the same moment, they'd all come back and hit the office at the same moment too — just delayed, not spread out. So a little randomness gets mixed into each wait — one phone might actually wait 6 seconds, another 8 — which is enough to scatter everyone's retries across a spread of time instead of a single instant.

**Why a letter doesn't get tried forever:** if something is genuinely, permanently wrong with a letter — not "the phone lines are busy," but "this address doesn't exist" — no amount of waiting and retrying will ever fix it. Continuing to try anyway would only run the phone's battery down and hide a real problem behind a queue that looks like it's still "working on it." So after enough failed attempts (or immediately, for a mistake that's obviously not going to un-happen with time), the app stops trying that one on its own and sets it aside clearly marked as failed — not thrown away, not hidden, just waiting for a person to notice and decide what to do about it.

**Why the app checks for a chance to post letters on its own now, instead of only when someone taps a button:** an inspector shouldn't have to remember to open Settings and tap "Sync" every time they walk back into signal — the app itself notices when the connection comes back, and when it's brought back to the front of the phone after being away, and quietly tries to catch up right then. The button still exists for "I want this to happen right now," but it's no longer the only way it happens.

## Phase 3, Day 4 — a bookmark for what you've already read, and why deleting still needs a note

**Sending letters was only half the job — the office has to be able to tell you things too.** A colleague on a second phone might create a new project, or finish a report, while you were somewhere with no signal yourself. When you get signal back, your own phone needs to ask the office "what's happened since I last checked?" — that's pulling.

**The bookmark, in plain words:** imagine reading a long shared logbook that other people also add entries to. Rather than re-reading the whole thing every time you check it, you keep a bookmark at the last entry you actually read, and next time you only read what's been added since. That bookmark is the "cursor" — one saved point in time, remembered on your own phone, saying "I'm caught up to here."

**Why the bookmark uses the office's clock, not your own watch:** if your watch is running fast or slow, "everything after 3:05 on my watch" might not line up at all with what the office actually wrote down at what it calls 3:05. The office's own clock, stamped onto every entry the moment it's written, is the one thing every reader can agree on — so the bookmark is always measured against that, never against whichever phone happens to be asking.

**Why a deletion needs its own note, instead of the row just quietly disappearing:** picture a shared list where someone crosses an item out with a single line, instead of tearing the page out. A person reading the list later can tell "this used to be here, and it's gone now" — which is a completely different, useful fact from an item simply never having existed at all, or from a page they haven't read yet. If deleted things just vanished with no trace, another phone catching up later would have no way to tell "this was removed" apart from "I just haven't reached that part yet" — and might, without meaning to, write it right back in.

**The exact trap this avoids, proven for real rather than just described:** phone A deletes something and lets the office know. Phone B, which made a small, unrelated edit to that same thing earlier — before it ever heard about the deletion — finally gets signal and sends its edit in. Does the office get confused and bring the deleted thing back? Tested directly against the real system, not just reasoned about on paper: it doesn't. The crossed-out line stays crossed out; B's edit still counts for what it actually says, but it doesn't erase the strike-through. Whoever reads the logbook next still sees, correctly, that the item is gone.

## Phase 3, Day 5 — when two people genuinely disagree

**The two-inspectors story:** picture two inspectors both walking the same building at the same time — one on the exterior, one inside. Both are filling in the same report on their own phones, with no signal to compare notes. The exterior inspector fills in the roof condition. The interior inspector fills in a note about the electrical panel. Neither has any idea the other is even working right now. When both phones finally get signal, both sets of answers should survive — there is no real disagreement here at all, just two people doing two different parts of one job. That's the ordinary, everyday case, and it resolves itself with nobody ever noticing it happened.

**When it's a real disagreement:** now imagine both inspectors happen to look at the _same_ roof, one after the other, and each writes down a different condition — "Fair" from one, "Poor" from the other, twenty minutes apart. Somebody has to win, because the report can't say both. The rule here is simple and a little counterintuitive: whichever answer is _about to reach the office_ wins — not because it's "more correct," but because it's about to become the office's own record of what's true, and there's no fair way to ask "whose watch is right" when phones can't be trusted to agree on the time in the first place.

**The one time the app refuses to guess:** if those two answers arrive close enough together — within about a minute of each other — the app stops trusting either silent rule. Picture the difference between "Minor cracking" and "Structural damage, urgent" said almost in the same breath: guessing wrong here isn't a shrug, it's a real safety problem. So instead of picking one, the app sets both answers aside and asks a person to look at both and choose — the only case in the whole sync system where a human, not a rule, makes the call.

**Deletion always wins over an edit that hasn't caught up yet.** If one phone deletes a report and the office already knows about it, a second phone's small, unrelated edit to that same report — made before it ever heard about the deletion — doesn't bring it back. It's treated the same way regardless of which phone's clock says what, because a phone's own clock is exactly the thing this whole design refuses to trust for a decision like this.

**Being honest about where this isn't perfect yet:** the "how close together" check right now looks at the _whole report_ changing, not the _specific line_ someone else touched. That means, in a rare case, if one inspector edits the roof note and a different inspector edits something else on the same report within that same minute, the app might still pause and ask about the roof note even though nobody else actually touched it. Nothing gets lost when this happens — worst case, someone gets asked a question they didn't strictly need to answer — but it's a real, known rough edge, not something pretended away.

**Two real mistakes were found and fixed by actually testing this, not by reading the rules and assuming they were followed correctly.** The first time this was built, a small logic slip meant the "ask a person" case above never actually triggered — every close-together disagreement was silently guessed at instead, including the exact "urgent damage" example this whole rule exists to protect. The second mistake: even after that was fixed, a note only one inspector had ever touched could still occasionally get flagged as a "disagreement," simply because the office's older copy of it naturally looked different from a brand new edit that just hadn't arrived yet — not because anyone actually disagreed about anything. Both were caught by writing out the exact scenarios this document describes and checking, line by line, that the real code actually did what it was supposed to.

## Phase 3, Day 6 — sending the actual photo, not just a note that one exists

**Why a photo can't just sync like a project name.** Every other kind of edit in this app — a project's name, an inspection's notes — is small enough that sending it to the office IS the whole job, done in one step. A photo is different: it's a real FILE sitting on one specific phone, not a little bit of text. Syncing "there is a photo here" without the photo itself would be worse than not syncing at all — it would tell the office a picture exists that they can never actually see.

**So uploading a photo is really three separate jobs, done as one.** First, tell the office "there's a new photo, attached to this inspection, no file yet." Second, actually send the photo's bytes up to a separate photo-storage service (not the database — databases are bad at storing large files). Third, go back and tell the office "here's exactly where that photo landed." Only once all three have genuinely finished does the phone consider this photo "sent" — if the app gets closed, or the signal drops, partway through any of these three, nothing is marked done, and the next time the phone tries, it just does all three again from scratch. Doing all three again causes no harm — telling the office about a photo it already knows about, or re-sending the exact same bytes to the exact same spot, both just land as "yep, still true," not as a mistake or a duplicate.

**Where the photo actually lives.** Not inside the app's own database — a separate photo-storage service (part of the same Supabase account this app's whole backend already lives on) that's built for exactly this: files, not rows of text. Each phone's photos live in their own private folder there, named by that person's account — nobody else's account can see into it, the exact same privacy rule that already protects every project and inspection in the regular database.

**Why the office doesn't get handed a plain, permanent link to each photo.** A permanent, guessable link to a private inspection photo would mean anyone who ever saw that link — forwarded in a text message, pasted somewhere public by accident — could see the photo forever, with no way to take that back. Instead, the app remembers exactly where the photo is stored, privately, and only asks the photo service for a real, working, temporary link at the exact moment someone actually needs to look at the photo — a link that stops working again shortly after.

**What "syncing in the background" honestly means here, and what it doesn't.** Phones can be told: "every so often, even if nobody has the app open, quietly check if there's anything new to send." That's real, and it's built. What it is NOT is a guarantee — the phone's operating system decides how often "every so often" actually is, based on things like how much battery is left and how often someone actually opens the app, and it can simply decide not to bother for a while. Building something stronger than that — truly reliable uploads that keep going even while the app is fully closed — needs a much deeper level of access to how the phone works than this kind of app is normally built with, and genuinely can't be tested at all without a real, physical phone in hand. Rather than pretend to have built that and hope it works, the honest choice was to build the reliable, real part (checking in occasionally) and write down clearly what was deliberately left out and why.

## Phase 3, Day 7 — a gap found while getting ready to test, not a new feature

**Why photos needed one more piece of work before the "two inspectors" story could actually be true.** Everything about syncing a photo (Day 6) covered getting a photo FROM a phone TO the office. It never covered the office telling a *different* phone that photo exists. Without that second half, two inspectors on two phones would never actually see each other's photos, no matter how well the upload itself worked — a real gap, found by checking "does this app actually do what Section 5's rules promise?" before trying to test it, not by something breaking.

**The fix: photos now come back down too, the same way projects and inspection notes already did.** A phone asks the office "what's changed since I last asked?" and photos are now part of that answer, same as everything else.

**One extra wrinkle photos have that nothing else in this app does.** A project's name has exactly one true value, wherever it's asked from. A photo is different — one specific phone has the actual picture file sitting on it; every other phone only ever has a *pointer* to where that picture lives in the cloud, not the picture itself. So when a photo's information comes back down to a phone that didn't take it, that phone now honestly says "I know this photo exists, I just don't have the actual file on me" — instead of the earlier, wrong approach, which would have quietly copied down the ORIGINAL phone's own private file location as if it meant something here too, which it never would have.

## Phase 4, Day 1 — turning an inspection into a document someone can print, email, or keep

**What a "report" actually is here.** Everything up to now lived inside the app — an inspector fills in a form, takes photos, gets a signature, and it all sits in the phone's database (and, since Phase 3, the office's copy too). None of that is something you can attach to an email or hand to a client. A report is that same information, turned into one file — a PDF — that looks the same and opens the same on any computer or phone, with or without this app installed.

**Why the app writes a web page to make a PDF, instead of "drawing" one directly.** There are two ways software makes a PDF. One way is to place every word and photo by exact position — "put this sentence 2 inches from the top" — which means the app has to work out line-wrapping, page breaks, and image sizing all by itself. The other way is to write the report as an ordinary web page (the same kind of thing a browser shows), and let the phone's own built-in printing tool turn that page into a PDF. Web pages already know how to wrap text and break onto a new page sensibly — so this app takes the second, much less error-prone route.

**The catch: this "web page" is never actually shown in a browser, and that removes some things you'd normally expect.** There's no fetching a font from the internet, no separate style file, no photo referenced by "go find this file on disk" — everything the report needs (every style rule, every photo, the signature) has to already be sitting inside that one page, before it's handed off to be turned into a PDF. A photo becomes a long block of text (called base64) that literally *is* the picture, spelled out in a way a web page can embed directly.

**Why some things the original plan described aren't in the report yet, on purpose.** A few things this plan asked for don't exist anywhere else in the app yet — a "star rating" answer type, or a way to write a caption under a specific photo. Rather than invent brand-new pieces of the app just so the report has something to show, the report only shows what the app genuinely already collects — a section's photos are labeled with that section's own name, and there's simply no rating type to format, because nothing in this app has ever produced one. Building those would be adding a new feature partway through a week that's explicitly about finishing, not adding.

**Why there's no little map picture, even though the plan mentions one.** A map image means asking a map service over the internet for a picture of that location — but this report also has to work with the phone in airplane mode, generating entirely offline. Those two requirements can't both be true at once, so the map picture is left out, and the report just shows the plain coordinates instead.

## Phase 4, Day 2 — handing a report to someone else, and how the app already knew what a link means

**What "sharing" adds on top of yesterday's PDF.** Yesterday's button proved the report file was real by opening it in a print preview. That's not the same as being able to email it, text it, or save it into another app — sharing hands the finished file to the phone's own "send this somewhere" menu, the same one every app on the phone already uses. The inspector doesn't need Fieldnote to know how to talk to Gmail or WhatsApp; the phone's share menu already knows how to talk to all of them, and the app just has to ask for it.

**What a deep link actually is, and why almost none of it needed building.** A normal link opens a website. A deep link opens one specific screen *inside an app*, as if you'd tapped your way there by hand — `fieldnote://inspections/abc123` should feel, to the phone, exactly like tapping that same inspection in the list. The genuinely surprising part: this app didn't need any extra code to make that work. Every screen in this app is already named by where its file lives (`inspections/[id]` is a real folder and file on disk) — and that's the exact same information a deep link needs to know which screen to open. Registering the app's own web-address-style name (`fieldnote://`) was the only setup step, and that had already been done earlier for unrelated reasons. The file structure IS the map of every link the app can ever open.

**Why the link this app actually uses says "inspections" and not "inspection."** The original plan wrote the link with the word singular. But every other part of this app — the tab, the list screen, the folder on disk — already says "inspections," plural, consistently. Rather than build an extra layer just to also accept the singular spelling, the app keeps the one spelling it already uses everywhere else, and that difference from the plan's wording is written down rather than silently ignored.

**Why "what if the link points at nothing" needed zero new code.** Tapping a deleted or made-up inspection already showed a plain "Inspection not found" message — built back in an earlier phase, for the ordinary case of a row disappearing from a list. A deep link that points at nothing hits that exact same check, the exact same way. Nothing about *how* someone arrived at a screen changes what happens once they're there — which is exactly why building screens around "what data do I have" instead of "how did the user get here" pays off later, in ways you don't always see coming.

**Why today's report finally looks like it came from this app.** Yesterday's report used a generic, unrelated shade of blue, picked without thinking too hard about it, because getting a real PDF to exist at all was the day's actual goal. Today it borrows the exact same colours, sizes and weights the rest of the app already uses everywhere else — the same "one source of truth for every colour" idea from the very first week of this project (the theme tokens file), just read from a different kind of code (building a document instead of drawing a screen).

## Phase 4, Day 4 — motion that means something, and catching the crash a try/catch can't

**What a "worklet" is, without the jargon.** Normally, everything your app's JavaScript does happens on one single thread — one lane of traffic. If that lane gets backed up (a sync running, a big list rendering), anything else waiting on it — including an animation — stutters or freezes along with it. A worklet is a small piece of code specially marked so it can run on a *second*, separate lane reserved just for drawing to the screen. That's why the little sync-status dot can still smoothly pop when its status changes, even in the middle of a real sync doing real work.

**Why swipe-to-delete needed a whole new library, when tapping a button didn't.** A tap is simple: touch down, touch up, in roughly the same spot — the phone already knows how to tell every app about that. A swipe is a whole gesture unfolding over time — how far did the finger move, in which direction, how fast — and deciding "is this a swipe, or a scroll, or nothing at all?" is genuinely complicated to get right. Gesture Handler is a library that's already solved that problem, so this app doesn't have to.

**Why the app now has exactly one class instead of a function, when every other piece of it is a function.** There's a very specific kind of failure — an error happening *while the screen is being built*, not while responding to a tap — that only one particular, older style of writing a component can catch at all. It's the one place in this whole project where "just use a function like everywhere else" genuinely isn't an option.

**What that new catching component actually buys the app.** Before today, if something genuinely unexpected went wrong while a screen was drawing itself, the whole app would just go blank or show a scary red error screen, with no way back except force-quitting and reopening. Now, that same failure shows a plain "something went wrong" message with a button that tries again — the difference between an app that visibly breaks and one that visibly, calmly recovers.

**Why a form field fading in and out is the same kind of thing the plan meant by a "step transition," even though this app has no steps.** The plan imagined a form that's broken into pages you move between one at a time. This app's form isn't built that way — it's one long scrolling form, with fields that show or hide themselves depending on what you've already answered (built back in an earlier phase). Both are really the same underlying idea: something appearing on screen because of what the user just did, rather than always being there. Making that moment fade smoothly, instead of snapping instantly, is the same improvement either way — it just happens to a field here, instead of a whole page.

## Phase 4, Day 5 — proving the sync rules with code instead of two phones

**What an automated test actually is.** It's a small script that runs a real piece of the app's own code, then checks the result against what should have happened — automatically, every time, without a person clicking through the app by hand. The value isn't just "catching bugs now" — it's catching a bug *later*, the day someone changes the sync logic for an unrelated reason and accidentally breaks a rule that was working fine for months.

**Why this project tests logic instead of screens.** A screen test means simulating a tap, waiting for React to redraw, and checking what text appears — slow to write, and it breaks any time the screen's *layout* changes even slightly, even if the actual behavior underneath is still completely correct. This project's riskiest logic — deciding who wins when two people edit the same thing offline — doesn't live in a screen at all. It's a plain function: given some inputs, it returns a decision. Testing that directly is faster to write, faster to run, and only breaks when the actual *decision* changes, not when a button moves three pixels.

**Why the conflict-resolution rules got tested before anything else.** Every other bug in this app, worst case, shows something wrong on screen — annoying, but visible, and fixable once someone notices. A wrong conflict decision is different: it can throw away a real thing someone typed, silently, with nothing on screen ever hinting it happened. That's exactly the kind of bug a person clicking through the app by hand would never catch, and exactly the kind of bug that's cheap to catch with seven lines of code checking a plain function's output.

**What "mocking" the database means here, in plain words.** This project's real database only knows how to run on a phone (or a phone simulator) — a plain computer running a test script can't open it at all. Rather than teach the test to somehow pretend to be a phone, it swaps in a *different*, real database — one that plain computers CAN run — for just the moment the test needs it, then hands it to the exact same "create a project" code the real app uses. The code being tested never finds out it's talking to a stand-in; it just does its job, for real, against a database that happens to live only in memory for the length of one test.

## Phase 4, Day 6 — a robot that checks your work every time, and why "it works on my machine" isn't proof

**What CI actually is.** Every time this project's code gets pushed to GitHub, a completely fresh, empty computer spins up somewhere, downloads a brand-new copy of the code, installs everything from scratch, and runs the same three checks that get run by hand before every commit. If something only worked because of a leftover file, a half-remembered manual step, or a setting that happened to already be right on this one machine, that fresh computer won't have any of that — and the check fails, out loud, where everyone can see it. "It works on my machine" has been the single most common lie in software for decades, not because anyone's dishonest, but because it's so easy to accidentally believe.

**What a crash reporter does that `console.error` can't.** `console.error` writes a message to a log only the person sitting at that exact computer, at that exact moment, will ever see. Once an app is out in the world on someone else's phone, that log is gone the second they close the app — nobody who built it ever finds out anything broke at all, unless the person hits the same bug badly enough to complain. A crash reporting service sits between "an unexpected error happened" and "the person who built the app finds out" — automatically sending the details somewhere the team can actually see them, on every phone, all the time, without asking anyone to do anything.

**Why this project's crash reporting exists in the code but genuinely can't be turned on here.** Setting one up for real means signing up for an account with a real company and being handed a private key (a "DSN") that says "reports go here, into my project." That's not something that can happen inside an automated coding session — it needs an actual person, actually creating an actual account. So the code that WOULD send a report is fully built and sitting ready, but with no key to send reports to, it simply stays quiet — not broken, just not switched on yet.

**OTA updates versus a new store build, in plain words.** Sometimes fixing a bug only means changing this app's own JavaScript — and that kind of fix can be pushed straight to everyone's phones within minutes, without them ever visiting an app store. Other changes — adding a new native capability, changing a permission the app asks for — physically can't work that way, because they need a new copy of the underlying native app itself, which only an app store can hand out, and which takes real review time. Knowing which kind of change you're making decides how fast a fix can actually reach someone.
