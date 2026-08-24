// src/app/(tabs)/index.tsx  →  route "/"
//
// The Projects tab. Phase 1 treats projects as read-only (seeded data) —
// only inspections get full create/edit/delete this phase (Section 5.1).
// Tapping a project opens its detail screen, which lists that project's
// inspections filtered.

import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Screen, Text, Card, EmptyState } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { listProjects } from "@/repositories/projects";
import type { Project } from "@/db/schema";

export default function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // useFocusEffect (not a plain useEffect) re-runs every time this screen
  // becomes visible again — including "came back from a project's detail
  // screen" — so a change made elsewhere is never left stale on this list.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listProjects()
        .then((rows) => {
          if (!cancelled) setProjectList(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen padded={false}>
      <FlashList
        data={projectList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md }}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/projects/${item.id}`)}>
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
          loading ? null : (
            <EmptyState
              title="No projects yet"
              message="Seed the database from Settings to get started."
            />
          )
        }
      />
    </Screen>
  );
}
