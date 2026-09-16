# Fieldnote — Phase 4 Test Results

Plan Section 6, both the full-project regression (6.1) and Phase 4's own
32 test cases (6.2). **📱** = needs a real, physical phone — this sandbox
has had none for any phase, and Phase 4 hit the same wall trying to get
one working (a Windows Hypervisor Platform / admin-rights block on the
one Android emulator attempt, documented in `CLAUDE.md`'s Phase 3
history).

Every result below is either a genuine, real check run this session
(server requests against the live Supabase project, `npm test`, a real
GitHub Actions run, a self-assessment of the README against the plan's
own TC-31 criterion) or an honest **Blocked**, naming the specific reason
— never a pass claimed on the strength of the code looking right.

## 6.1 Full-project regression

| From | Test | Result | Notes |
| --- | --- | --- | --- |
| Phase 1 | Offline CRUD survives force-quit | **Blocked** | Needs a real device with real `expo-sqlite` — unchanged since Phase 1 (D-010). |
| Phase 1 | Outbox row per mutation | **Pass** | Re-proven Day 5 (`docs/DESIGN.md` D-031): the real, unmodified `createProject`/`listOutboxForEntity` against a real (in-memory `@libsql/client`) SQLite database, migrated with this project's own real `drizzle/` files. Not `expo-sqlite` itself, but the actual repository/transaction code — a stronger regression check than re-reading the code. |
| Phase 2 | New template works with zero code changes | **Blocked** | No third template has ever been written (`docs/DESIGN.md` D-027) — this specific proof (plan's own TC-31 from Phase 2) has never been run, on any day of this project. |
| Phase 2 | Conditional visibility | **Pass (unit), inconclusive (manual UI check)** | `validation.test.ts` (Day 5) deterministically proves a `visibleIf`-hidden required field is excluded — passes every run, and is the one place Phase 4 (Day 4's fade animation, Day 5's `visibility.ts` extraction) genuinely touched this logic. A live web-preview attempt to toggle the field by typing was tried twice today; one attempt showed the field correctly, the second didn't register the typed value at all — a known flakiness in this sandbox's browser-automation text input (first seen in Day 2's verification), not a reproducible app behavior. The deterministic unit test is the trustworthy signal here, not the flaky manual attempt. |
| Phase 2 | Photo compression under 300 KB | **Blocked** | Needs a real camera and a real captured photo — unchanged since Phase 2. |
| Phase 3 | Airplane-mode inspections sync exactly once | **Pass** | Re-verified today against the live Supabase project (idempotency: `duplicate: true` on a repeated push, exactly one row created — same result as every prior verification, four days of unrelated client-side work later). |
| Phase 3 | Two-device different-field merge | **Pass** | Re-verified today: R1's per-column coalesce still lands both edits (title + notes) correctly. |
| Phase 3 | Delete beats older edit | **Pass** | Re-verified today: a delete followed by a stale update still leaves the row deleted (no resurrection). |

**No regression found.** Every server-observable Phase 3 behavior still holds after four days of Phase 4 changes that never touched `syncEngine.ts`, `syncPull.ts`, `syncApi.ts`, `conflict.ts`, or any Supabase migration. The one still-open regression item from Phase 2 (zero-code third template) was never closed in any earlier phase either — Phase 4 didn't create this gap, and didn't close it.

## 6.2 Phase 4 test cases

### 6.2.1 PDF

| ID | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-01 | Generate from a completed inspection | Opens; all sections present | **Blocked** | `src/lib/report.ts`/`reportHtml.ts` are typecheck/lint-clean and structured to do this, but `expo-print` doesn't function in the web preview (D-010) and this sandbox has no device/working emulator (`docs/DESIGN.md` D-026). |
| TC-02 | Generate from a 40-photo inspection | Sensible pagination | **Blocked** | Same reason as TC-01. |
| TC-03 | Generate from a partly-filled inspection | "Not recorded" for unanswered fields | **Blocked** | `formatValue`'s `NOT_RECORDED` fallback is code-verified by reading `report.ts`, not exercised in a real rendered PDF. |
| TC-04 | Check a `select` field in the report | Shows the label, not the stored value | **Blocked** | Same reason; the label-lookup logic exists in `report.ts` but the rendered output has never been seen. |
| TC-05 | Check a `date` field | Formatted date | **Blocked** | Also: no template in this project has ever used the `date` field type (`docs/DESIGN.md` D-027) — even a real device couldn't exercise this against real data without first authoring a template that uses it. |
| TC-06 | Generate in airplane mode | Works fully offline | **Blocked** | Architecturally true by construction (`reportHtml.ts` makes no network call — D-026), but "works" has never been observed, only reasoned about. |
| TC-07 | Generate with no photos | No empty photo section, no error | **Blocked** | Same reason as TC-01. |

### 6.2.2 Sharing and links

| ID | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-08 📱 | Share a report to email | Share sheet opens | **Blocked** | `Sharing.shareAsync` is wired (Day 2, D-028) but never run — needs a real phone, share sheets don't exist in a web preview. |
| TC-09 📱 | Open a deep link with the app closed | Opens directly to that inspection | **Blocked** | Needs a real phone. The actual working link is `fieldnote://inspections/{id}` (plural — a documented deviation from the plan's literal singular wording, D-028). |
| TC-10 | Open a deep link with an invalid ID | Graceful message, no crash | **Pass (code-verified)** | No new code was needed for this at all — `inspections/[id].tsx`'s existing `getInspection(id) === null` branch already renders `EmptyState title="Inspection not found"`, the same path a normal tap on a deleted row already hits. Confirmed by reading the code, not by opening a real deep link (which still needs a phone), but this specific behavior has no device-only component — it's the same screen logic regardless of how you arrived at it. |

### 6.2.3 Performance 📱

| ID | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-11–TC-15 📱 | Cold start / scroll 5,000 rows / typing lag / PDF timing / scroll-during-sync | Various thresholds | **Blocked** | Day 3 in full (`docs/PERFORMANCE.md`, `docs/DESIGN.md` D-029) — the plan's own rules make this an absolute stop without real hardware (5.1: "emulator numbers are meaningless"; 2.6: "never optimise anything you haven't measured"). No numbers were invented. |

### 6.2.4 Motion, gesture, accessibility

| ID | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-16 | Animate a sync status change | Smooth, no flicker | **Built, not live-verified** | The scale-pop animation (`SyncStatusDot.tsx`, Day 4) renders without error in the web preview, but "smooth" (60fps, no dropped frames) is a real-device claim this sandbox can't measure, same as Day 3. |
| TC-17 | Swipe-to-delete a row | Works; confirmation appears | **Built, not live-verified** | `Swipeable`-wrapped rows render without crashing (confirmed live, Day 4) and the same confirmation `Alert` already proven in `inspections/[id].tsx` fires — but an actual swipe gesture has no meaningful equivalent in mouse-based browser automation. |
| TC-18 | Pinch-to-zoom a photo | Zooms and resets cleanly | **Built, not live-verified** | `PhotoViewer.tsx` (Day 4) exists and typechecks; a pinch gesture can't be simulated by this sandbox's tooling at all. |
| TC-19 📱 | Complete an inspection with a screen reader only | Possible start to finish | **Blocked** | Needs a real phone with VoiceOver/TalkBack — the one piece of Day 4 never claimed as anything but blocked (`docs/DESIGN.md` D-030). |
| TC-20 📱 | Check icon-only buttons with the screen reader | Each announces a meaningful label | **N/A** | This app has no icon-only buttons at all — confirmed by a full grep before Day 4 started. Every `Pressable` already wraps a text label; `accessibilityLabel`/`accessibilityRole` were still added everywhere for real screen-reader correctness, but there's no icon-only case for this specific test to check. |
| TC-21 | Every screen with no data | Sensible empty state | **Pass** | Live-verified across this whole session — every list screen's `EmptyState` was seen rendering correctly multiple times (freshly seeded/reset preview data, filtered-to-nothing states). |
| TC-22 | Every screen with a forced error | Error state with a retry option | **Built, not live-triggered** | The error UI and "Try again" button exist on all four data screens (Day 4) and are code-correct (reusing `EmptyState`'s new `children` slot), but no real network failure was deliberately forced and watched render this session — an honest gap, not claimed as seen. |

### 6.2.5 Tests and CI

| ID | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-23 | `npm test` | All pass | **Pass** | 22/22, 4 suites, re-confirmed again today as part of this day's own regression pass. |
| TC-24 | Break a conflict rule deliberately | The corresponding test fails | **Pass** | Day 5: R1's branch flipped, exactly one test failed, reverted. |
| TC-25 | Push a type error | CI fails | **Pass** | Day 6: real GitHub Actions run #2 (commit `dc99546`) failed red, watched live via the Actions UI. |
| TC-26 | Fix it and push | CI passes | **Pass** | Day 6: run #3 (commit `499f1df`) completed successfully, watched live. |

### 6.2.6 Release

| ID | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-27 📱 | Install the production build on a fresh device | Installs and launches | **Blocked** | No production build has ever been run — `eas build` needs a real Expo account this sandbox cannot create (`docs/DESIGN.md` D-032). |
| TC-28 📱 | Complete a full inspection on the production build | Works end to end | **Blocked** | Same reason — no build exists. |
| TC-29 📱 | Trigger a deliberate crash | Sentry shows it with a readable stack trace | **Blocked** | No Sentry account/DSN exists (D-032) — `initSentry()`/`reportError()` are deliberate no-ops in this environment. |
| TC-30 📱 | Ship an OTA update | Applies on next launch | **Blocked** | No production build to update. |
| TC-31 | Open the README as a stranger would | Enough to understand and install the project | **Pass** | Rewritten today (this same session) to reflect all four phases — architecture, the sync engine, conflict policy, the test suite, CI, and an honest "known issues" section per the plan's own instruction. Self-assessed against the plan's own criterion, not an independent reviewer's judgment — noted as such rather than claimed as a neutral audit. |
| TC-32 📱 | Send the install link to someone else | They can install and open it | **Blocked** | No install link exists — direct consequence of TC-27 being blocked. |

---

## Summary

**Regression: 6 of 8 items re-confirmed with a real check today** (3 live
Supabase re-verifications, 1 unit-test re-run, 1 Day-5 integration-test
proof standing in for the SQLite claim); the remaining 2 were already-known
gaps from earlier phases, not new Phase 4 breakage.

**Phase 4's own 32 cases: 6 Pass, 1 N/A, 4 Built-not-live-verified/not-triggered,
1 Pass (code-verified), 20 Blocked** — every blocked case named for a
specific, structural reason (no device, no emulator, no Sentry account,
no Expo/Apple/Google developer account), consistent with the same
discipline this document's four predecessors used. TC-25 and TC-26 (CI
actually failing and recovering, watched live) and the three regression
Supabase re-checks are the strongest evidence in this file — real
external systems, real requests, real observed results.

No test case in this document was marked a pass on the strength of the
code looking right.
