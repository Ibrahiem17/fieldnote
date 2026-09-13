// src/auth/AuthProvider.tsx
//
// Phase 3's equivalent of src/theme/ThemeProvider.tsx: one React Context
// that knows whether anyone is logged in, set up once at the root of the
// app, read anywhere via useAuth(). Nothing outside this file ever calls
// supabase.auth directly — same "one layer owns this" idea Phase 1 applied
// to the database (src/repositories/*), applied here to auth state.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type AuthState = {
  /** null until the very first session check finishes — see `loading`. */
  session: Session | null;
  /** true only while checking SecureStore for a session that survived an app restart. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // `getSession()` reads whatever session Supabase already restored from
    // SecureStore (via the adapter in src/lib/supabase.ts) — this is what
    // makes "force-quit and reopen: still logged in" (plan TC-03) work at
    // all, without this app writing a single line of restore logic itself.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });

    // Fires on every future change: sign in, sign out, and — the one that
    // matters most for Phase 3 — a silent token refresh. `autoRefreshToken`
    // (src/lib/supabase.ts) does the actual refresh; this listener is just
    // how the rest of the app finds out a new session exists.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Returning a plain string (not throwing) matches this project's
    // existing pattern of screen-level `setError(...)` state — see
    // src/app/inspections/new.tsx's title-required check.
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    // Email confirmation is left at Supabase's project default (usually
    // "on"): a real deployment shouldn't silently skip it. In that case
    // `signUp` succeeds but `session` stays null until the confirmation
    // link is clicked — the login screen's own error message tells the
    // user to check their email rather than this file guessing at UX for
    // a setting it doesn't control.
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // This clears the Supabase session ONLY. It must never touch local
    // SQLite — plan Section 3.1.3: "a sign-out that clears the session but
    // does not delete local data." Nothing below calls into src/db at all,
    // which is the actual guarantee: there's no code path here that could.
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() was called outside <AuthProvider> — check src/app/_layout.tsx");
  }
  return ctx;
}
