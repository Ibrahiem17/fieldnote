Device Test Runbook — Phase 2

Last updated: 2026-09-06T15:34:42+05:00

Purpose

Steps and exact commands to run Phase 2 device verification locally, including building a dev client, taking photos, inspecting files on device, and running GPS/signature checks.

Quick checklist

- [ ] npm install
- [ ] npm run typecheck
- [ ] npm run lint
- [ ] Build dev client (EAS) or use Expo Go for quick checks
- [ ] Install dev client on a physical device
- [ ] Run the TC-23..TC-31 device tests from docs/TEST-RESULTS-PHASE-2.md and record results

1) Install and typecheck

Windows / macOS / Linux (terminal):

```bash
npm install
npm run typecheck   # ensure tsc is installed in devDependencies
npm run lint
```

If `npm run typecheck` fails because tsc isn't installed globally, run `npm install` first and retry.

2) Build a dev client (recommended)

Install EAS CLI (one-time):

```bash
npm install -g eas-cli
eas login
```

Create a dev build (Android example):

```bash
eas build --profile development --platform android
# follow EAS output to install the generated APK on your device
```

iOS dev client requires appropriate Apple provisioning; follow EAS docs.

3) Run the app on a device

- Open the installed dev client on your phone (or use Expo Go if the modules you need are present there).
- In the app, Reset & Reseed (Settings) to ensure the Phase 2 templates (Roof Inspection, Equipment Check) are present.

4) Camera & image checks (TC-23..TC-27)

- Open a `photo` field, take a photo, and observe the thumbnail appears.
- Use Android Studio Device File Explorer or adb to inspect files. Example (Android):

```bash
# find app package name from app.json expo.slug or your experience; adjust path accordingly
adb shell ls -R /data/data/<your.app.package>/files/attachments
# or inspect the ExperienceData path when using Expo Go/Dev Client
adb shell ls -R /data/data/host.exp.exponent/files/ExperienceData/%2540your-username%252Fyour-app/attachments
```

- Verify the full image and thumbnail exist at:

```
{documentDirectory}/attachments/{inspectionId}/{attachmentId}.jpg
{documentDirectory}/attachments/{inspectionId}/thumbs/{attachmentId}.jpg
```

- Confirm compressed file sizes are under ~300 KB. On Android you can pull a file:

```bash
adb pull /data/data/<your.app.package>/files/attachments/<inspectionId>/<attachmentId>.jpg ./sample.jpg
ls -lh sample.jpg
```

- Test deleting a photo from the app: both image and thumbnail should be removed.

- Deny camera permission when prompted and verify the app shows a path to open Settings rather than crashing.

5) GPS checks (TC-28..TC-30)

- Start an inspection outdoors and confirm a location with accuracy < ~20m is stored (attach to inspection and to photos).
- Start an inspection indoors and verify the code times out gracefully (approx 10s) and records either a poor-accuracy value or no location.
- Deny location permission and confirm inspections complete successfully with no location recorded.

6) Signature canvas (TC-31)

- Open a signature field, draw a signature, save — verify a PNG file was created under attachments and an attachment row exists.
- If React Native WebView is missing in your runtime, build a dev client that includes `react-native-webview`.

7) Stress test (60-field template)

- Seed or create a large template with ~60 fields and open it. Scroll, type, and ensure the UI remains responsive.

8) Reporting results

- Add entries to docs/TEST-RESULTS-PHASE-2.md with device, OS, and pass/fail per TC.
- Take screenshots and include file paths in your notes.

Troubleshooting

- If a native module fails to load in Expo Go, use an EAS dev build that includes the native modules.
- For iOS permission issues, ensure Info.plist keys are present in app.json and rebuild the dev client.

Contact

If anything in the runbook is unclear, open an issue on the repository and tag the Phase 2 owner.
