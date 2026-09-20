import { friendlyAuthError } from "./friendlyError";

test("a wrong password says so plainly, without server jargon", () => {
  expect(friendlyAuthError("Invalid login credentials")).toContain("email or password isn't right");
});

test("an unconfirmed email says what to do next", () => {
  expect(friendlyAuthError("Email not confirmed")).toContain("confirm your email");
});

test("a duplicate account suggests signing in", () => {
  expect(friendlyAuthError("User already registered")).toContain("Try signing in");
});

test("a short password names the minimum", () => {
  expect(friendlyAuthError("Password should be at least 6 characters.")).toContain("at least 6 characters");
});

test("no signal explains that the first sign-in needs internet", () => {
  for (const raw of ["Network request failed", "fetch failed", "AuthRetryableFetchError: fetch failed", "timeout"]) {
    expect(friendlyAuthError(raw)).toContain("first time you sign in");
  }
});

test("rate limiting asks for a short wait", () => {
  expect(friendlyAuthError("Email rate limit exceeded")).toContain("wait a minute");
});

test("anything unrecognised gets a generic message, never the raw server text", () => {
  const text = friendlyAuthError("PGRST999: internal weirdness 0xDEADBEEF");
  expect(text).not.toContain("PGRST999");
  expect(text).toContain("Something went wrong");
  expect(friendlyAuthError(null)).toContain("Something went wrong");
});
