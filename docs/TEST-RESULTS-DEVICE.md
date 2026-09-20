# Fieldnote — Real-device results (Samsung A51, Android 13)

Development build via EAS, driven over adb. Each row is something actually
observed on the phone (screenshot or logcat), not inferred from code.

| Date | Item | Result | Evidence / notes |
| --- | --- | --- | --- |
| 2026-09-20 | Dev build installs and launches | **Pass** | EAS build finished; `adb install` Success; sign-in screen rendered; no JS errors/crash in logcat. |
| 2026-09-20 | Cold start to first screen (dev client) | **Observed, not a valid perf number** | ~30–50 s including a first blank period. Dev client compiling the bundle over USB — production build must be measured separately (Day 3 protocol). |
| 2026-09-20 | Session survives force-stop (SecureStore) | **Pass** | Relaunched signed in without re-entering credentials. |
| 2026-09-20 | Settings screen reachable on a phone-height screen | **Fail → fixed → Pass** | Was unscrollable (D-033). After the ScrollView fix the Reseed button was reachable. |
| 2026-09-20 | Reseed on real SQLite | **Pass** | 8 projects, 2 templates, 500 inspections; finished in under ~7 s including the tap. |
| 2026-09-20 | Phase 1: data survives force-quit | **Pass** | `pidof` confirmed process dead after `am force-stop`; relaunch showed Projects 8 / Inspections 500. First Phase 1 device test ever run. |

## Still to run on this device
Camera capture + real compressed size (<300 KB), GPS accuracy, permission denial,
airplane-mode sync, PDF render + share sheet, deep link with app closed,
swipe/pinch feel, TalkBack pass, performance protocol (note: seed makes 500
inspections; the plan's protocol wants 5,000).

| 2026-09-20 | Phase 2: conditional field (visibleIf) on a real keyboard | **Fail → fixed → Pass** | Typing "poor" stored "Poor" and hid the photo field. `select` is now tappable chips (D-034); tapping Poor shows "Photograph the damage / Add photo" on the phone. |
| 2026-09-20 | Data survives a lost USB/adb connection | **Pass** | After several disconnects and an app relaunch, 8 projects and the two user-created inspections were intact. |
| 2026-09-20 | Phase 2: camera capture + save | **Pass** | Two photos captured in-app, saved under `files/attachments/<inspection>/`, thumbnails rendered. |
| 2026-09-20 | Phase 2: photo under 300 KB, long edge 1600 | **Fail → fixed (re-measure pending)** | Measured 300,591 B and 178,847 B, both 1600 × 2844 (long edge 2844, not 1600). Cause + fix in D-035. |
| 2026-09-20 | Phase 2: photo under 300 KB, long edge 1600 (after D-035 fix) | **Pass (1 sample)** | New portrait photo: 900 × 1600, 123,551 B. Long edge is now exactly 1600. One sample of one scene — size still depends on scene detail because quality is fixed at 0.7, not size-targeted; a very busy scene could still approach the limit. Before the fix, two different scenes were 178,847 B and 300,591 B at 1600 × 2844. |
| 2026-09-20 | Phase 2: GPS capture failure handling | **Fail → fixed (D-036)** | A failed capture saved fake coordinates 12.34 / 56.78 (accuracy 9999) silently. Now alerts and saves nothing. |
| 2026-09-20 | Phase 2: real GPS fix | **Pending** | Not yet observed — the only value seen was the fake fallback. |
| 2026-09-20 | Phase 4: deep link `fieldnote://inspections/{id}` with app already running | **Pass (partial)** | Opened the right inspection. App-fully-closed case (TC-09) still untested. |
| 2026-09-20 | Phase 2: third template renders with zero renderer changes | **Pass (existing field types only)** | Temp "DEVICE TEST" template (gps + signature + text) rendered correctly; this is TC-31-style evidence for existing types, not a new field type. Template is temporary and uncommitted. |
| 2026-09-20 | Phase 2: real GPS fix | **Pass** | Real coordinates captured and persisted to SQLite (`answers.value_json`), replacing the earlier fake value. Reported accuracy 100 m: the code requests `LocationAccuracy.Balanced` (network-assisted), not `High`. Adequate for stamping a site; not for sub-10 m needs. Coordinates deliberately not recorded here. |
| 2026-09-20 | Phase 2: signature capture | **Fail → fixed (D-037), re-test pending** | No confirm button (library footer was hidden); failed save could create a placeholder attachment. Both fixed; on-device Save + saved-file check pending. |
| 2026-09-20 | Phase 2: signature capture (after D-037 native buttons) | **Pass** | Cancel/Clear/Save row visible; Save wrote an 88,282 B PNG under `files/attachments/<inspection>/`, attachment row `image/png`, `pending`, real `local_uri` (no placeholder), outbox entry queued. |
| 2026-09-20 | Sync: edits to a SEEDED inspection | **Expected dead-end (not a product bug)** | Reset & Reseed inserts inspections with no outbox rows, so the server never receives them; child rows (answer, attachment) then fail server-side with `..._inspection_id_fkey` and retry with backoff. Sync tests must use inspections created via New Inspection. |
| 2026-09-20 | Phase 2: location permission denied | **Pass** | Permission revoked, Android dialog shown, "Don't allow" chosen: the app showed its own denied alert, its Open Settings action opened Android settings, no crash/JS error in logcat, no fake value stored (both saved locations still real, none matches the old 12.34 placeholder). Limitation: I can't prove from timestamps alone that nothing was written during the denial — the newest write (157 s before I checked) lines up with the earlier granted capture. |
| 2026-09-20 | Offline: writes queue while offline | **Pass (from the DB, not from Settings)** | After the airplane-mode session the phone's outbox held 4 rows (inspection insert, answer, 2 attachments) — nothing was lost. The Settings screen did not visibly show a pending count to the tester; cause not yet determined. |
| 2026-09-20 | Sync: an app-created inspection reaches the server | **FAIL — root cause found (D-038), fix built, re-test pending** | Server rejected the inspection: `invalid input syntax for type uuid: "roof-inspection-v1"`; children then failed the FK. Local template ids were slugs and the server `templates` table was never populated. Fixed in code + migration `20260920000001_seed_templates.sql` (owner must run it). |
| 2026-09-20 | Photo: cancelling / failing the camera | **Fail → fixed (D-038)** | Saved two fake attachments (`file:///placeholder.jpg`, 12,345 B). Now cancel = nothing, error = alert, nothing saved. Camera not opening in airplane mode is likely a dev-build artifact (lazy imports fetched from Metro) — unconfirmed. |
| 2026-09-20 | Sync: an app-created project reaches the server (online) | **Pass** | Created with the real `createProject` (via a temporary dev button, uncommitted): phone showed `sync_status = synced`, outbox 0, pull cursor set from the server's clock; the tester confirmed in the Supabase dashboard exactly one matching `projects` row. First time an app-created record was independently confirmed on the server. |
| 2026-09-20 | Offline: create inspection with no network | **Pass (partial)** | Tester created "Airplane Sync Test" offline and read "3 pending" in Settings (inspection + 2 answers), matching the queue. The reconnect half (drain, server row, exactly-once) was interrupted — **pending**. |
| 2026-09-20 | Sync: template ids valid after D-038 | **Pass** | Re-run after the fix: the inspection now carries a valid template UUID and the `invalid input syntax for type uuid` error is gone; the next failure was the missing project (D-039). |

## Resume checklist (when the phone is back)
1. Reconnect: wireless debugging on → `adb mdns services` → `adb connect <ip:port>` → `adb reverse tcp:8081 tcp:8081` → start Metro (`npx expo start --dev-client --port 8081`) → force-stop + relaunch the dev client via `fieldnote://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`.
2. NEW: the Projects tab now has a **New Project** button (screen at `/projects/new`, added after this checklist's first draft) and the temporary Settings dev button was removed — first on-device run of that screen still pending: create a project, confirm it appears in the list, opens, and shows in Supabase → projects after Sync Now.
3. The phone already holds "Airplane Sync Test" (created offline, in "Sync Test Project 21:10:14"). Tap Settings → Sync Now (online) → I read the phone DB (outbox should be 0, inspection `synced`) → tester confirms exactly ONE "Airplane Sync Test" in Supabase → inspections (+ answers).
4. Then, still untested on the device: photo upload path, Generate Report (PDF render + share sheet), deep link with the app fully closed, performance, gesture feel, screen reader.

### Added to the resume checklist (built after the last device session, all unverified on a device)
- **Run the new migration in the Supabase SQL editor first:** `supabase/migrations/20260920000002_seed_safety_walk_template.sql` (the first one, `..._seed_templates.sql`, was already run). Then check Table Editor → templates shows **3** rows.
- Fresh-install behaviour: on a phone with no data (or after clearing app data), the app should offer all three templates in New Inspection with **no** reseed (`ensureBuiltInTemplates`, D-040).
- **Sync of typed answers:** in an inspection, type a text answer in several pauses, then Sync Now — the answer must appear in Supabase → answers (the D-041 data-loss bug).
- Number fields: type `3.3` (the dot must stay) and clear the box (it must not become 0).
- Site Safety Walk: Walk date auto-hyphens; an impossible date (e.g. 2026-02-30) is refused on save; Site location and Inspector signature are reachable; setting Hazard level to High reveals the hazard photo field.

- **Offline behaviour (D-042):** with airplane mode on, open and close the app several times over a few minutes, then check Settings → Sync: **pending** should stay at the number of queued items and **failed** must stay **0** (before the fix, ~8 foreground events dead-lettered everything). Turn airplane mode off → items should send once and reach Supabase.
- Take a photo while online, then drop the signal mid-sync: the photo should stay pending, not become "Not signed in".
| 2026-09-20 | "Add photo" seemed broken | **Diagnosed: works, but silent for several seconds** | Camera (`com.sec.android.app.camera`) took focus after the tap (confirmed with `dumpsys window`); dev build lazily loads camera modules from Metro with no on-screen change. Fixed with a busy button + module preloading (D-043). Not re-timed after the fix. |
| 2026-09-20 | Cancelling the camera saves nothing (D-038 fix) | **Pass** | Attachments on the inspection: 0 after tapping Add photo then Back. |
| 2026-09-20 | Fresh-install templates (D-040) | **Pass** | Phone gained "Site Safety Walk" (3 templates) with no reseed. |
| 2026-09-20 | Inspection screen: autosave line, "Finish up", Mark as complete | **Pass (happy path)** | Screen renders without JS errors; Mark as complete → green toast "Marked as complete ✓" and the section switched to Mark as submitted / Reopen. The error path (missing required answer) not yet exercised on the phone. |
| 2026-09-20 | Settings wording + "Upload now" | **Pass** | "2 waiting to upload" → tap → "Uploaded 2 changes and received 1 update from your account ✓", "Everything is uploaded ✓", outbox 2 → 0. |
| 2026-09-20 | New Project screen (D-039) | **Pass** | Created "Demo Site" through the real UI; its page opened with "New Inspection for this project". |
| 2026-09-20 | Third template renders on a device (zero engine changes, D-040) | **Pass (renders)** | Site Safety Walk showed every field type (GPS button, chips, date, number, switch, signature). Capturing values through it not yet done. |
| 2026-09-20 | Completion-error path | **Pass** | Missing required Hazard level → alert listing "Hazard level — needs an answer" + inline red "Required"; picking High cleared it. |
| 2026-09-20 | visibleIf on a device | **Pass** | Hazard level High revealed "Describe the hazard" and "Photograph the hazard". |
| 2026-09-20 | PDF report generation + share sheet | **Pass (generation), layout not inspected** | 29,881-byte valid PDF created in the app cache; Android ChooserActivity opened; no JS errors. The PDF's appearance still needs a human look. |
| 2026-09-20 | Full Site Safety Walk hand-run ("Test"): GPS, weather, walk date, crew size, hazard High, photo, signature, marked complete | **Pass (phone side)** | Read back from the phone's database: `site_location` (real GPS reading, accuracy 100 m), `hazard_level` high, `weather` clear, `walk_date` 2026-09-20 (typed date saved correctly), `crew_size` 2; inspection status `completed`, every row `synced`, outbox 0. Decimal number entry (`3.5`) not exercised. |
| 2026-09-20 | Photo capture + upload to storage | **Pass (phone side)** | `hazard_photos`: image/jpeg, **162,641 B** (under 300 KB), `synced`, `remote_url` set → the upload path ran. |
| 2026-09-20 | Signature capture + upload | **Pass (phone side)** | `inspector_signature`: image/png, 91,689 B, `synced`, `remote_url` set. |
| 2026-09-20 | Server side of the above | **Pending the tester's dashboard check** | Confirm in Supabase: `answers` (5 rows for "Test"), `attachments` (2), and Storage → the attachments bucket (2 files); inspection status `completed`. The assistant cannot read these (RLS; never uses the admin key). |
| 2026-09-21 | Required markers + "* required" legend | **Pass** | Site Safety Walk shows the legend and "Hazard level *". |
| 2026-09-21 | "Use today's date" | **Pass** | Filled 2026-09-20 (the phone's date). |
| 2026-09-21 | Edit project | **Pass** | Prefilled form titled "Edit project"; renamed "Scratch" → "Scratch Renamed", shown on its page. |
| 2026-09-21 | Delete project | **Pass (UI)** | Confirmation dialog, then "Project deleted" toast and gone from the list (empty throwaway project). Cascade with inspections and its sync to the server: unit-tested only. |
| 2026-09-21 | Changes upload by themselves (D-045) | **Pass** | Created "Auto check" in the UI; log `auto-sync (periodic): pushed 1` ~5 s later, project `synced`, outbox empty, no button pressed. Deleting it uploaded the same way. |
| 2026-09-21 | Remove sample data, keeping real work | **Pass** | Dry run on a copy of the phone's DB, then the button: "Removed 500 sample inspections and 8 sample projects"; 2 projects + 3 inspections remain (all `synced`), outbox 0. |
| 2026-09-21 | Upload banner rendering | **Superseded — see the next row** | Wording is unit-tested; not yet seen on screen because uploads now clear within seconds. Check: airplane mode on → create something → banner "You're offline. 1 change will upload when you have a signal." |
| 2026-09-21 | Upload banner + offline create → reconnect → upload (D-042, D-045) | **Pass** | The tester turned on airplane mode, created projects, and saw the banner at the top of the Projects tab; on reconnecting the items uploaded. Read back from the phone afterwards: projects "Banner test" and "Airplane mode" both `synced`, outbox empty. Server-side arrival left to the tester's dashboard check. |
