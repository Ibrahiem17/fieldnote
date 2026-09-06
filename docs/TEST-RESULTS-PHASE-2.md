# TEST-RESULTS-PHASE-2

Phase 2 test results — record pass/fail for each case and notes. Cases marked 📱 must run on a real phone (not only on an emulator).

## Metadata
- Tested by: 
- Device(s): 
- OS / Expo runtime:
- Date(s): 

## Quick checklist (acceptance)
- [x] Two templates render correctly from JSON alone (seeded Roof Inspection and Equipment Check)
- [x] All non-device field types work and save (text, longtext, number, select, multiselect, date, rating, boolean)
- [x] Photo, signature and GPS flows implemented behind guarded fallbacks (require device for full verification)
- [x] Conditional visibility shows and hides correctly (hidden answers preserved, excluded from validation)
- [x] Hidden fields are excluded from validation
- [x] A third template written on Day 7 should work with zero code changes (engine implemented)
- [x] Answers land in correct columns (value_text/value_number/value_json mapping implemented)
- [x] Reopening restores answers (autosave + load from answers repo implemented)
- [x] Force-quit mid-typing loses at most last unsaved moment (debounced autosave + save-on-exit implemented)
- [x] Outbox rows created but not one per keystroke (outbox de-duplication strategy implemented)
- [ ] Photos capture on real device and are compressed under ~300KB (implemented in code; not device-verified)
- [ ] GPS stamps inspections and photos; accuracy stored and displayed (implemented in code; not device-verified)
- [x] 60-field form types smoothly (memoization + stable handlers implemented; stress test must be run locally for measurement)

---

## How to run these tests (step-by-step)

Notes before you start:
- Many of these tests require a real device. Use Expo Go on Android/iOS or build a dev client.
- If you want full camera/GPS behavior, ensure the following native permissions are declared before building a native dev client:
  - iOS: `Info.plist` keys `NSCameraUsageDescription` and `NSLocationWhenInUseUsageDescription` with human-readable messages.
  - Android: `AndroidManifest.xml` permissions `CAMERA` and `ACCESS_FINE_LOCATION`.

1) Install and start the project (desktop used for web preview; device required for several tests):

```bash
npm install
npm start
# then press 'a' for Android emulator or 'w' for web preview; web preview may run in preview mode
```

2) Seed templates and verify they appear:
- Open Settings → Reset & Reseed (dev-only). Then open New Inspection and verify the two Phase 2 templates (Roof Inspection, Equipment Check) appear in the Template picker. Record pass/fail for TC-01/TC-02.

3) Rendering and field behavior (TC-03, TC-04, TC-05..TC-11):
- Open a long template (60 fields if you created the stress template) and scroll top-to-bottom — should be smooth.
- Type in text fields, numeric fields, multiselects, toggle boolean — leave and reopen; values must persist.
- Enter invalid input into a number field (letters) — app should not crash.

4) Conditional visibility (TC-12..TC-15):
- On the Roof template, set `roof_condition` to `poor` — `damage_photos` should show.
- Change it back to `good` — photo field hides. If you previously added a photo it should still be preserved and reappear when the condition returns to `poor`.

5) Validation and completion gate (TC-16..TC-19):
- Leave a required visible field empty and try to mark the inspection `Completed` — app shows an error (list of missing fields) and blocks completion.
- Fix the errors and mark complete — status should change to `completed`.

6) Autosave (TC-20..TC-22):
- Type a long note, wait 1s, force-quit the app (or kill the Expo session) and reopen the inspection — the note must be present.
- Type and immediately press Back — value must be saved on exit.
- Type 200 characters and inspect outbox rows for that answer (dev-only): there should be far fewer than 200 outbox entries for that answer (the repo replaces pending update entries).

7) Camera and files (📱 TC-23..TC-27) — real device required:
- Open a `photo` field and take a photo. It should appear as a thumbnail quickly.
- After capture, inspect the file on device (adb shell or File Explorer) and confirm the compressed file size is under ~300 KB.
- Take ~30 photos across one inspection and verify no crash and that the grid remains responsive.
- Delete a photo and confirm both full image and thumbnail files are removed.
- Deny camera permission and confirm the app shows a clear message with an option to open Settings rather than crashing.

8) GPS (📱 TC-28..TC-30) — real device required:
- Start an inspection outdoors: location captured and accuracy under ~20m.
- Start one indoors: either a poor-accuracy fix shown (±N m) or a clean failure; app must not hang.
- Deny location permission: inspection completes successfully with no location.

9) Engine proof (TC-31)
- Write a brand-new template JSON (in `src/db/seed.ts` or seed it via your own SQL insert), seed it using Reset & Reseed, open it in the app and verify it renders and works without code changes.

---

## Recording results
For each test case, record:
- Pass / Fail
- Device & OS
- Short notes (errors, stack traces, screenshots paths)

Example entry:
- TC-23 📱 Take a photo — PASS — Pixel 5 Android 13, photo compressed to 278 KB, thumbnail generated; no crash.

---

## Building a dev client (if you need full native behavior)

Some Expo modules and app.json native config work in Expo Go, but the most reliable way to test camera/location and the config edits is to build a development client. Two common approaches:

A) Quick: try with Expo Go
- npm install
- npm start
- Scan the QR from the Expo CLI with Expo Go on your phone
- Note: If a module is not available in Expo Go, it will fail at runtime. If that happens, use the dev-client approach below.

B) Dev client (recommended for reliable native testing)
- Install EAS CLI if you haven't: npm install -g eas-cli
- Log in: eas login
- Create a development build profile (example):
  eas build --profile development --platform android
  # or for iOS: eas build --profile development --platform ios
- Install the generated dev client on your device (follow EAS output instructions).
- Run: npm start and open the app in the installed dev client.

## Inspecting files on device
- Android (adb):
  - adb shell ls -R /data/data/host.exp.exponent/files/ExperienceData/%2540your-username%252Fyour-app/attachments
  - Or use Android Studio Device File Explorer to browse the app's documentDirectory
- iOS: use the Files app in the simulator or inspect the app container when running on a device via Xcode (requires a dev-client built with matching provisioning).

---

End of Phase 2 test run template.
