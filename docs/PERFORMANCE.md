# Fieldnote — Performance

Phase 4, Day 3's record: before/after numbers for the app's performance
work, measured only on real hardware (the Phase 4 plan's own rule, Section
5.1 — numbers from an emulator or the web preview are not meaningful and
don't belong here). Not filled in until Day 3.

This file created as an empty skeleton on Day 1, per the plan's own
instruction (Section 3.1.1).

## Day 3 — blocked, not skipped

**Status: no numbers below, and none invented.** The plan's own rule 5.1
is explicit and absolute: *"Real device only. Emulator numbers are
meaningless."* Rule 2.6 is equally explicit the other direction: *"never
optimise anything you haven't measured."* This sandbox has no physical
phone and no working Android emulator (the same Windows Hypervisor
Platform / admin-rights wall documented for Phase 3's device testing and
again for Phase 4 Days 1-2) — so there is no honest way to produce a
single baseline number, and per the plan's own rule, no honest way to
"optimise" anything without one either. Writing plausible-sounding numbers
here would be exactly the kind of fabrication this project's entire
documentation discipline exists to prevent — so this section states the
blocker plainly instead, the same way every other device-only gap in this
project (GPS accuracy, background execution, camera capture) has been
handled since Phase 2.

**What this means concretely:** no baseline was measured, no code was
changed for performance reasons, and no `before`/`after` table exists. The
5,000-record seed volume the plan's 3.3.1 calls for was not generated
either — seeding it would produce data with no way to measure anything
against it, which has no value on its own.

**Two candidate hypotheses, found by reading the code, NOT measured or
applied** — worth checking first, whenever a real device becomes
available, because they're the two things Phase 4's own plan (3.3.3)
names as "likely candidates":

1. **`src/app/(tabs)/inspections.tsx`'s `FlashList` has no
   `estimatedItemSize` prop set at all.** The plan's own Phase 1 syntax
   note (Section 3.6.1) says this should be "roughly how tall one row is
   in pixels" — it's simply absent here, not tuned to a wrong value.
2. **The list row is an inline JSX literal inside `renderItem`, not its
   own `React.memo`-wrapped component.** Every render of the screen (e.g.
   the status-filter chips changing) reconstructs every visible row from
   scratch; there's no way for React to skip re-rendering a row whose own
   data hasn't changed, because there's no separate component instance
   for it to skip.

Both are named here as **hypotheses to check**, not fixes to trust — per
the plan's own protocol (Section 2.6: measure, hypothesize, change one
thing, measure again, keep or revert), applying either one now, with
nothing to measure the result against, would be exactly the kind of
unverified "optimization" this project has rejected everywhere else.
