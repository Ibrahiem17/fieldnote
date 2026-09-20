// src/auth/friendlyError.ts
//
// Turns what the auth server says ("Invalid login credentials", "fetch failed")
// into something a person can act on. Raw server text is never shown: it's
// either unhelpful or alarming, and it changes between server versions.

export function friendlyAuthError(raw: string | null | undefined): string {
  const message = (raw ?? "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "That email or password isn't right. Check them and try again.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email first: open the message we sent you, tap the link, then sign in here.";
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "There's already an account with that email. Try signing in instead.";
  }
  const shortPassword = /password should be at least (\d+)/.exec(message);
  if (shortPassword) {
    return `Choose a password with at least ${shortPassword[1]} characters.`;
  }
  if (message.includes("valid email") || message.includes("invalid email") || message.includes("unable to validate email")) {
    return "That doesn't look like a valid email address.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("failed to connect")
  ) {
    return "Can't reach the server. Check your internet connection: you need to be online the first time you sign in.";
  }
  return "Something went wrong signing in. Please try again.";
}
