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

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { db } from "@/db/client";
import migrations from "../../drizzle/migrations";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MigrationGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

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
  const { success, error } = useMigrations(db, migrations);
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

  return (
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
}
