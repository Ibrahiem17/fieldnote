// src/app/(tabs)/index.tsx  →  route "/"
//
// The Projects tab. Phase 1 treats projects as read-only (seeded data) —
// only inspections get full create/edit/delete this phase (Section 5.1).
// Tapping a project opens its detail screen, which lists that project's
// inspections filtered.

import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Screen, Text, Card, EmptyState, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { listProjects } from "@/repositories/projects";
import type { Project } from "@/db/schema";

export default function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // Phase 4, Day 4: this screen had no user-visible error state before —
  // a load failure just left the list empty with no explanation.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return listProjects()
      .then((rows) => setProjectList(rows))
      .catch((e) => {
        console.error(e);
        setError("Couldn't load projects.");
      })
      .finally(() => setLoading(false));
  }, []);

  // useFocusEffect (not a plain useEffect) re-runs every time this screen
  // becomes visible again — including "came back from a project's detail
  // screen" — so a change made elsewhere is never left stale on this list.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().catch((e) => {
        if (!cancelled) console.error(e);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  return (
    <Screen padded={false}>
      {loading && projectList.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="Something went wrong" message={error}>
          <Button label="Try again" onPress={() => load()} />
        </EmptyState>
      ) : (
        <FlashList
          data={projectList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: theme.spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/projects/${item.id}`)}
              accessibilityLabel={item.name}
            >
              <Text variant="subtitle">{item.name}</Text>
              {item.clientName ? (
                <Text muted style={{ marginTop: 2 }}>
                  {item.clientName}
                </Text>
              ) : null}
              {item.address ? (
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  {item.address}
                </Text>
              ) : null}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No projects yet"
              message="Seed the database from Settings to get started."
            />
          }
        />
      )}
    </Screen>
  );
}
