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

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { db, dbInitError } from "@/db/client";
import migrations from "../../drizzle/migrations";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>{dbInitError ? <PreviewModeApp /> : <MigrationGate />}</ThemeProvider>
    </SafeAreaProvider>
  );
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

  if (!success) {
    // Migrations are still running. This is the loading state Section
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
