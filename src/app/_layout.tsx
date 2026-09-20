// src/app/_layout.tsx
//
// The root layout: Expo Router treats this file specially — it wraps every
// screen in the app, so anything every screen needs (the theme, the
// database being ready) is set up exactly once, here.
//
// What has to happen, in order, before any screen renders:
//   1. Pending migrations run against the SQLite file (Section 2.7).
//   2. Only once that's finished do we show navigation — otherwise a screen
//      could query a table that doesn't exist yet.
//
// Preview mode (docs/DESIGN.md D-013): if the database couldn't open at all
// (`dbInitError` set — a confirmed browser limitation in this project's
// sandboxed web preview, D-010, never Android/iOS or a normal browser),
// there is nothing for `useMigrations` to run against. `RootLayout` picks
// between two entirely separate components below based on that one flag,
// decided once at module load — never mid-render — so each component is
// free to call whichever hooks make sense for its own case.

import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { db, dbInitError } from "@/db/client";
import migrations from "../../drizzle/migrations";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { Text, ToastProvider } from "@/components";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import LoginScreen from "@/auth/LoginScreen";
import { startAutoSync } from "@/lib/syncTriggers";
import { initSentry, reportError } from "@/lib/sentry";
import { ensureBuiltInTemplates } from "@/repositories/templates";

// Phase 4, Day 6: called once, at module load — before any component
// renders, so a crash during the very first render is still covered.
// A no-op with no DSN configured (src/lib/sentry.ts) — this sandbox's
// permanent state, since no real Sentry account exists to create one.
initSentry();

export default function RootLayout() {
  return (
    // Phase 4, Day 4: every gesture in this app (Gesture Handler's
    // Swipeable, the photo viewer's pinch/pan) needs exactly one
    // GestureHandlerRootView somewhere above it in the tree — it's what
    // lets Gesture Handler intercept touches before React Native's normal
    // responder system does. Placed at the very root so it never matters
    // which screen a gesture gets added to later.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>
              <ToastProvider>
                <AuthGate />
              </ToastProvider>
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The outermost gate: nothing below this — not even preview mode — renders
 * until we know whether there's a session. `loading` is only ever true for
 * the brief moment AuthProvider is checking SecureStore for a session that
 * survived an app restart (plan TC-03); after that it's a plain yes/no.
 */
function AuthGate() {
  const { session, loading } = useAuth();
  const theme = useTheme();

  // Connectivity/foreground auto-sync (plan Section 3.3.3) — only ever
  // worth starting once someone's actually signed in; there's nothing to
  // push before that. The `session` object itself changes reference on
  // every token refresh, so the effect keys on whether one exists at all
  // (`Boolean(session)`), not the object itself — starting and stopping
  // the listeners on every silent refresh would be pure churn.
  useEffect(() => {
    if (!session) return;
    return startAutoSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above: keyed on presence, not identity
  }, [Boolean(session)]);

  // Background sync registration (plan Section 3.6.3, docs/DESIGN.md
  // D-024) — native only, and a genuinely DYNAMIC import, not a static one:
  // src/lib/backgroundSync.ts calls expo-task-manager's `defineTask` at
  // module-load time, and this project doesn't assume that's safe to even
  // LOAD on web just because it usually degrades gracefully (D-018 was the
  // opposite lesson, for a different native module). Skipping the import
  // entirely on web is what actually guarantees that code never runs there
  // — not a runtime Platform check inside a statically-imported module.
  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    let cancelled = false;
    import("@/lib/backgroundSync")
      .then((m) => {
        if (!cancelled) return m.registerBackgroundSync();
      })
      .catch((e) => console.error("[backgroundSync] registration failed", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above: keyed on presence, not identity
  }, [Boolean(session)]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return dbInitError ? <PreviewModeApp /> : <MigrationGate />;
}

const AppNavigator = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="projects/[id]" options={{ headerShown: true, title: "Project" }} />
    <Stack.Screen name="inspections/[id]" options={{ headerShown: true, title: "Inspection" }} />
    <Stack.Screen
      name="inspections/new"
      options={{ headerShown: true, title: "New Inspection", presentation: "modal" }}
    />
    <Stack.Screen
      name="projects/new"
      options={{ headerShown: true, title: "New Project", presentation: "modal" }}
    />
  </Stack>
);

/**
 * Blocks rendering of the real app until every pending migration has run.
 *
 * `useMigrations` is a Drizzle hook: feed it the open `db` connection and
 * the generated migrations bundle, and it applies whichever migrations
 * haven't run yet, in order, tracking which ones already have inside a
 * hidden table Drizzle manages itself. `success`/`error` mirror how that
 * went; `error` is not undefined until it fails.
 */
function MigrationGate() {
  // `db!` — safe here specifically: this component only ever renders when
  // `dbInitError` is null, which is exactly the condition under which
  // `db` is guaranteed non-null (src/db/client.ts).
  const { success, error } = useMigrations(db!, migrations);
  const theme = useTheme();
  // The built-in templates must exist before any screen can list them, so the
  // app only opens once they've been ensured (docs/DESIGN.md D-040).
  const [templatesReady, setTemplatesReady] = useState(false);

  useEffect(() => {
    if (!success) return;
    ensureBuiltInTemplates()
      .catch((e) => {
        // Not fatal: the app still works, New Inspection just has fewer
        // templates to offer. Loud in dev, reported in production.
        console.error("ensureBuiltInTemplates failed:", e);
        reportError(e);
      })
      .finally(() => setTemplatesReady(true));
  }, [success]);

  useEffect(() => {
    if (error) {
      // A migration failing is not a normal error to swallow — it means the
      // database may be in a half-changed state. Loud in dev is correct;
      // Phase 4's Sentry wiring will make this loud in production too.
      console.error("Migration failed:", error);
    }
  }, [error]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.bg,
          padding: theme.spacing.lg,
        }}
      >
        {/* Intentionally plain RN Text/View here, not our themed
            primitives — if the database is broken we want the least
            possible code between the crash and this message. */}
        <View>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (!success || !templatesReady) {
    // Migrations (or the built-in template check) are still running. This is the loading state Section
    // 3.4.3 requires — without it a screen could flash empty before its
    // table exists.
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <AppNavigator />;
}

/**
 * Renders the real navigation and screens — unmodified, same routes, same
 * components — with a persistent banner making clear that every repository
 * underneath is quietly serving sample data from src/db/mockStore.ts
 * instead of a real database (see that file, and D-013 in docs/DESIGN.md).
 * No migrations to wait for here: there's no real database to migrate.
 */
function PreviewModeApp() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          backgroundColor: theme.colors.warning,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <Text variant="caption" style={{ color: theme.colors.bg, textAlign: "center" }}>
          Preview mode — sample data, changes are not saved (see docs/DESIGN.md D-013)
        </Text>
      </View>
      <AppNavigator />
    </View>
  );
}
