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
