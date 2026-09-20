# Release readiness

What is done, what was checked, and what still needs a person with an account. Written to be
honest: "done" means built **and** looked at on a real phone; anything else is labelled.

## What ships in this build (v1.1.0)

| Item | State |
| --- | --- |
| Android production build (APK, signed with the project's EAS keystore) | Built with `eas build --profile production`; the previous build (1.0.0) was installed and run on a Samsung A51 with Metro off. The 1.1.0 build's own check is recorded in `TEST-RESULTS-DEVICE.md`. |
| App icon (hard hat + check), adaptive icon layers, themed (monochrome) icon | Drawn by `scripts/make-brand-assets.mjs` (`npm run assets:brand`); guarded by `brandAssets.test.ts`. |
| Splash screen (cream, the app mark, fades out once fonts and sign-in check are ready) | Configured via `expo-splash-screen` in `app.json`; needs a native build — see the device results. |
| In-app "How to use" tab, opens once on first launch | Words in `src/lib/guideContent.ts` (tested for developer jargon); one-time flag in `src/lib/guideSeen.ts`. |
| Automated checks | `tsc` 0 errors, ESLint clean, Jest green, CI green on every push. |

## What still needs you (I can't do these — they need an account or a decision)

1. **Google Play** — needs a Google Play developer account (one-time fee). When you have it:
   change the `production` profile's `android.buildType` to `"app-bundle"` (Play requires a bundle,
   not an APK), run `eas build --profile production --platform android`, then `eas submit`.
   You also need store listing text, screenshots, a content rating questionnaire and a
   **privacy-policy URL** (the app collects an email + password for sign-in, photos, GPS
   coordinates and signatures, all uploaded to the user's own account).
2. **Apple App Store / TestFlight** — needs an Apple Developer account and a Mac-free EAS iOS build
   with Apple credentials. The iOS side has **never been run** (no device), so expect a first pass
   of fixes.
3. **Crash reporting (Sentry)** — `@sentry/react-native` is installed and wired but does nothing
   until you create a free Sentry project and set `EXPO_PUBLIC_SENTRY_DSN` in `.env` **and** as an
   EAS environment variable (production), then rebuild.
4. **Outdated Expo packages (~17 a few patch versions behind)** — deliberately not upgraded the
   night before a demo. Do it as its own step: `npx expo install --check`, upgrade, rebuild, and
   re-run the full device checklist in `TEST-RESULTS-DEVICE.md`.
5. **Supabase check** — confirm in the dashboard that the "Test" inspection's 5 answers,
   2 attachments and 2 storage files arrived (I cannot read your project as you; row-level security
   correctly blocks me).

## Known limits (true today, not hidden)

- A photo taken on one phone cannot yet be **displayed** on another phone after syncing (the file is in
  storage, the app only shows local files).
- Two "Notes" fields appear in some templates; dates are typed (with a "Use today's date" button).
- Not measured on a device: performance numbers, gesture feel, screen-reader (TalkBack) behaviour,
  the deep link with the app fully closed.
- Light mode only; dark mode was deliberately not built.
- iOS: never run.

## How a release is made

```bash
npm run typecheck && npm run lint && npm test
npm run assets:brand            # only if the icon/splash artwork changed
eas build --profile production --platform android
# install: adb install -r fieldnote.apk   (then check on the phone)
git tag v1.1.0 && git push --tags
```
