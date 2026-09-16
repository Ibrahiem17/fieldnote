// jest.config.js
//
// Phase 4, Day 5. Deliberately NOT using the `jest-expo` preset, despite
// it being the obvious default for an Expo project — installing it
// surfaced a genuine, confirmed upstream inconsistency: its peer
// dependency `@react-native/jest-preset` (pinned to match this project's
// exact `react-native@0.86.2`) still references a file
// (`react-native/src/setup-env.js`) that this version of the `react-native`
// npm package simply does not ship (confirmed: `node_modules/react-native/src/`
// contains only `private/` and `types/`, nothing else) — not something
// fixable from this project's own config. `jest-expo`'s whole job is
// mocking React Native's native-module layer so a rendered COMPONENT test
// doesn't need a real phone; per docs/DESIGN.md's Day 5 entry, nothing in
// this project's test suite renders a component at all (conflict
// resolution, backoff, and validation are pure functions; the one
// integration test exercises a repository, not a screen) — so the thing
// `jest-expo` exists to provide isn't needed here, and this project isn't
// blocked by a preset it doesn't actually use.
//
// `transform` reuses this project's own babel.config.js via babel-jest —
// the same `.sql`-import and Reanimated plugins the real app already
// relies on, so nothing needs a second, parallel babel setup.
//
// `moduleNameMapper` exists because Jest has its OWN module resolver,
// completely separate from Metro's — tsconfig.json's `@/*` path alias
// means nothing to Jest on its own; this line is what teaches Jest the
// same alias, so a test file can `import { x } from "@/lib/x"` exactly
// like the app itself does.
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
